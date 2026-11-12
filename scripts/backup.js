// @ts-check
/**
 * The backups of myordbok-app (shared/backup.js, backup/worker.js): list
 * them, copy one off Cloudflare, and put back rows that are gone. Node
 * standard library only; R2 and D1 are reached through wrangler.
 *
 *   list                              the backups kept, newest first
 *   pull --out DIR [--backup NAME]    a backup (the newest unless NAME) into
 *                                     DIR, as NAME.sql.gz; one already there
 *                                     is left alone, so a daily cron copies
 *                                     each one once
 *   restore --table T [--where SQL] [--backup NAME | FILE] [--show N]
 *                                     the rows of T in the backup (the newest
 *                                     unless NAME; or a .sql / .sql.gz FILE)
 *                                     that myordbok-app no longer has
 *
 * Restore only adds rows that are missing. It never changes or deletes a
 * row: one that is in both but differs (edited since, or its id taken by a
 * newer row) is reported and left as it is now. The backup is loaded into
 * an in-memory SQLite database, so --where is any SQLite condition on the
 * backup's copy of the table, e.g. "id = 42" or "user_id = 7 AND created_at
 * > 1794000000". Rows that point at rows myordbok-app no longer has (a
 * comment of a deleted member) stop the restore; restore those first.
 *
 * Options:
 *   --apply   restore (otherwise only report what would be)
 *   --local   the local database and bucket of `wrangler dev`
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { BACKUP_DATABASE, BACKUP_INDEX, backupKey, isBackupName } from '../shared/backup.js';
import { wranglerRunner } from './data.js';

/** @typedef {import('./data.js').Runner} Runner */
/** @typedef {import('../shared/backup.js').BackupIndex} BackupIndex */
/** @typedef {Record<string, unknown>} Row */

const BUCKET = 'myordbok';
/** Rows per live lookup, to keep each command well under argument limits. */
const CHUNK = 200;
/**
 * Never restored: sign-ins would come back to life (sessions), and the
 * rest belong to D1 and the migrations.
 */
const REFUSED = new Set(['sessions', 'd1_migrations', '_cf_KV', 'sqlite_sequence']);

// ---------------------------------------------------------------- SQL text

/** @param {string} name */
export const ident = (name) => `"${name.replaceAll('"', '""')}"`;

/**
 * A value as an SQL literal.
 * @param {unknown} v
 */
export function literal(v) {
	if (v === null || v === undefined) return 'NULL';
	if (typeof v === 'number') {
		if (!Number.isFinite(v)) throw new Error(`Not a storable number: ${v}`);
		return String(v);
	}
	if (typeof v === 'bigint') return String(v);
	if (typeof v === 'boolean') return v ? '1' : '0';
	if (v instanceof Uint8Array) return `X'${Buffer.from(v).toString('hex')}'`;
	if (typeof v === 'string') return `'${v.replaceAll("'", "''")}'`;
	throw new Error(`Not an SQL value: ${typeof v}`);
}

/**
 * The condition matching these rows by their primary key.
 * @param {string[]} pk
 * @param {Row[]} rows
 */
export function keyMatch(pk, rows) {
	if (pk.length === 1) return `${ident(pk[0])} IN (${rows.map((r) => literal(r[pk[0]])).join(', ')})`;
	return `(${pk.map(ident).join(', ')}) IN (VALUES ${rows.map((r) => `(${pk.map((c) => literal(r[c])).join(', ')})`).join(', ')})`;
}

/**
 * @param {string[]} pk
 * @param {Row} row
 */
const keyOf = (pk, row) => pk.map((c) => literal(row[c])).join('\u0000');

/**
 * @template T
 * @param {T[]} list
 * @param {number} size
 */
function chunks(list, size) {
	/** @type {T[][]} */
	const out = [];
	for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
	return out;
}

// ---------------------------------------------------------------- restore

/**
 * @typedef {object} RestorePlan
 * @property {string} table
 * @property {string[]} pk
 * @property {string[]} columns  Restored: in the backup and in the table now.
 * @property {string[]} dropped  In the backup, no longer in the table (left out).
 * @property {number} matched  Rows of the backup matching --where.
 * @property {Row[]} missing  Gone from myordbok-app: these are restored.
 * @property {number} same  Still there, unchanged.
 * @property {Array<{ backup: Row, now: Row }>} changed  Still there under the same key, different now.
 * @property {Array<{ column: string, table: string, to: string, values: unknown[] }>} unresolved  References to rows myordbok-app no longer has.
 */

/**
 * What restoring table rows from the backup would do; changes nothing.
 * @param {DatabaseSync} backup
 * @param {Runner} live
 * @param {string} table
 * @param {string} [where]
 * @returns {RestorePlan}
 */
export function planRestore(backup, live, table, where = '') {
	if (REFUSED.has(table)) throw new Error(`${table} is never restored${table === 'sessions' ? ': it would sign people back in' : ''}.`);
	const info = /** @type {Array<{ name: string, pk: number }>} */ (/** @type {unknown} */ (backup.prepare('SELECT name, pk FROM pragma_table_info(?)').all(table)));
	if (!info.length) {
		const tables = backup.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((r) => r.name);
		throw new Error(`The backup has no table ${table}. It has: ${tables.filter((t) => !REFUSED.has(String(t))).join(', ')}`);
	}
	const pk = info.filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk).map((c) => c.name);
	if (!pk.length) throw new Error(`${table} has no primary key: rows cannot be matched.`);
	const now = live.query('APP', `SELECT name FROM pragma_table_info(${literal(table)})`).map((r) => String(r.name));
	if (!now.length) throw new Error(`${BACKUP_DATABASE} has no table ${table} now.`);
	const lost = pk.filter((c) => !now.includes(c));
	if (lost.length) throw new Error(`${table}'s key (${lost.join(', ')}) is not in the table now: rows cannot be matched.`);
	const columns = info.map((c) => c.name).filter((c) => now.includes(c));
	const dropped = info.map((c) => c.name).filter((c) => !now.includes(c));

	/** @type {Row[]} */
	let rows;
	try {
		rows = /** @type {Row[]} */ (backup.prepare(`SELECT * FROM ${ident(table)}${where ? ` WHERE ${where}` : ''} ORDER BY ${pk.map(ident).join(', ')}`).all());
	} catch (err) {
		throw new Error(`--where does not work on the backup's ${table}: ${err instanceof Error ? err.message : err}`);
	}

	/** @type {Map<string, Row>} */
	const current = new Map();
	for (const part of chunks(rows, CHUNK)) {
		for (const r of live.query('APP', `SELECT ${columns.map(ident).join(', ')} FROM ${ident(table)} WHERE ${keyMatch(pk, part)}`)) current.set(keyOf(pk, r), r);
	}
	/** @type {Row[]} */
	const missing = [];
	/** @type {RestorePlan['changed']} */
	const changed = [];
	let same = 0;
	for (const row of rows) {
		const there = current.get(keyOf(pk, row));
		if (!there) missing.push(row);
		else if (columns.every((c) => literal(row[c]) === literal(there[c]))) same++;
		else changed.push({ backup: row, now: there });
	}

	// What the missing rows point at must be there, or come back with them.
	/** @type {RestorePlan['unresolved']} */
	const unresolved = [];
	const keys = /** @type {Array<{ table: string, from: string, to: string | null }>} */ (/** @type {unknown} */ (backup.prepare('SELECT "table", "from", "to" FROM pragma_foreign_key_list(?)').all(table)));
	for (const fk of keys) {
		if (!columns.includes(fk.from)) continue;
		if (!fk.to) throw new Error(`${table}.${fk.from} references ${fk.table} without naming a column; this tool needs one.`);
		const to = fk.to;
		const coming = fk.table === table ? new Set(missing.map((r) => literal(r[to]))) : new Set();
		const wanted = [...new Map(missing.filter((r) => r[fk.from] !== null && r[fk.from] !== undefined).map((r) => [literal(r[fk.from]), r[fk.from]])).entries()].filter(([lit]) => !coming.has(lit));
		if (!wanted.length) continue;
		const found = new Set();
		for (const part of chunks(wanted, CHUNK)) {
			for (const r of live.query('APP', `SELECT ${ident(to)} AS v FROM ${ident(fk.table)} WHERE ${ident(to)} IN (${part.map(([lit]) => lit).join(', ')})`)) found.add(literal(r.v));
		}
		const absent = wanted.filter(([lit]) => !found.has(lit)).map(([, v]) => v);
		if (absent.length) unresolved.push({ column: fk.from, table: fk.table, to, values: absent });
	}
	return { table, pk, columns, dropped, matched: rows.length, missing, same, changed, unresolved };
}

/**
 * The INSERT statements restoring the missing rows. Plain INSERT: a row
 * added under the same key since the plan fails the restore instead of
 * being overwritten.
 * @param {RestorePlan} plan
 */
export function restoreSql(plan) {
	const cols = plan.columns.map(ident).join(', ');
	return `${plan.missing.map((r) => `INSERT INTO ${ident(plan.table)} (${cols}) VALUES (${plan.columns.map((c) => literal(r[c])).join(', ')});`).join('\n')}\n`;
}

/**
 * A row in one line, for the report.
 * @param {Row} row
 * @param {string[]} columns
 */
function brief(row, columns) {
	const text = columns
		.map((c) => {
			const v = row[c];
			const s = v === null || v === undefined ? 'NULL' : v instanceof Uint8Array ? `<${v.length} bytes>` : String(v).replace(/\s+/g, ' ');
			return `${c}=${s.length > 40 ? `${s.slice(0, 39)}…` : s}`;
		})
		.join('  ');
	return text.length > 200 ? `${text.slice(0, 199)}…` : text;
}

/**
 * @param {RestorePlan} plan
 * @param {number} show
 * @param {(line: string) => void} log
 */
export function reportPlan(plan, show, log) {
	log(`${plan.table}: ${plan.matched} row(s) in the backup match; ${plan.same} still there unchanged, ${plan.changed.length} changed since, ${plan.missing.length} missing.`);
	if (plan.dropped.length) log(`  Columns no longer in the table, left out: ${plan.dropped.join(', ')}`);
	if (plan.missing.length) {
		log(`  Missing, to restore:`);
		for (const r of plan.missing.slice(0, show)) log(`    ${brief(r, plan.columns)}`);
		if (plan.missing.length > show) log(`    … and ${plan.missing.length - show} more (--show N)`);
	}
	if (plan.changed.length) {
		log(`  Changed since the backup, left as they are now (same key, other values: edited, or the id taken by a newer row):`);
		for (const { backup, now } of plan.changed.slice(0, show)) {
			const diff = plan.columns.filter((c) => literal(backup[c]) !== literal(now[c]));
			log(`    ${plan.pk.map((c) => `${c}=${backup[c]}`).join(' ')}: ${diff.join(', ')}`);
		}
		if (plan.changed.length > show) log(`    … and ${plan.changed.length - show} more`);
	}
	for (const u of plan.unresolved) {
		const values = u.values.slice(0, 20).map((v) => literal(v)).join(', ');
		log(`  ${u.column} points at ${u.table}.${u.to} that ${BACKUP_DATABASE} no longer has: ${values}${u.values.length > 20 ? ', …' : ''}`);
		log(`    Restore those first: --table ${u.table} --where "${u.to} IN (${values})"`);
	}
}

/**
 * Restores the missing rows of the plan.
 * @param {Runner} live
 * @param {RestorePlan} plan
 * @param {boolean} apply
 * @param {(line: string) => void} log
 */
export function applyRestore(live, plan, apply, log) {
	if (plan.unresolved.length) throw new Error('Nothing restored: some rows point at rows that are gone (above). Restore those first.');
	if (!plan.missing.length) return log('Nothing to restore.');
	if (!apply) return log(`Dry run: ${plan.missing.length} row(s) would be added to ${plan.table} (${live.where}). Add --apply to restore them.`);
	const file = join(tmpdir(), `myordbok-restore-${process.pid}.sql`);
	writeFileSync(file, restoreSql(plan));
	try {
		live.file('APP', file);
	} finally {
		rmSync(file, { force: true });
	}
	log(`Restored ${plan.missing.length} row(s) into ${plan.table} (${live.where}).`);
}

// ---------------------------------------------------------------- R2

/**
 * @param {boolean} local
 * @param {string} key
 * @param {string | null} file  Written there, or returned as text when null.
 */
function r2Get(local, key, file) {
	const args = ['wrangler', 'r2', 'object', 'get', `${BUCKET}/${key}`, local ? '--local' : '--remote', ...(file ? ['--file', file] : ['--pipe'])];
	try {
		return execFileSync('npx', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
	} catch (err) {
		const e = /** @type {{ stderr?: string }} */ (err);
		const said = String(e.stderr ?? err).match(/✘ \[ERROR\] (.+)/);
		throw new Error(`Reading ${BUCKET}/${key} (${local ? 'local' : 'remote'}) failed: ${said ? said[1].trim() : String(e.stderr ?? err).trim()}`);
	}
}

/**
 * @param {boolean} local
 * @returns {BackupIndex}
 */
function readIndex(local) {
	const text = r2Get(local, BACKUP_INDEX, null);
	try {
		return JSON.parse(text);
	} catch {
		throw new Error(`${BUCKET}/${BACKUP_INDEX} is not the backup index. Has a backup run yet? (make backup-now APPLY=1)`);
	}
}

/**
 * The backup's name: the one given, or the newest.
 * @param {boolean} local
 * @param {string | undefined} given
 */
function chooseBackup(local, given) {
	if (given && given !== 'latest') {
		if (!isBackupName(given)) throw new Error(`Not a backup name: ${given} (like 2026-11-15-2017; make backup-list shows them)`);
		return given;
	}
	const newest = readIndex(local).backups[0];
	if (!newest) throw new Error('No backups are kept yet.');
	return newest.name;
}

/**
 * The SQL of a backup: a local .sql or .sql.gz file, or a backup in R2.
 * @param {boolean} local
 * @param {string | undefined} given
 * @param {(line: string) => void} log
 */
function backupSql(local, given, log) {
	if (given && /\.sql(\.gz)?$/.test(given)) {
		const path = resolve(given);
		if (!existsSync(path)) throw new Error(`No such file: ${path}`);
		log(`Backup: ${path}`);
		const data = readFileSync(path);
		return path.endsWith('.gz') ? gunzipSync(data).toString('utf8') : data.toString('utf8');
	}
	const name = chooseBackup(local, given);
	const file = join(tmpdir(), `myordbok-backup-${process.pid}.sql.gz`);
	try {
		r2Get(local, backupKey(name), file);
		log(`Backup: ${name} (${BUCKET}/${backupKey(name)})`);
		return gunzipSync(readFileSync(file)).toString('utf8');
	} finally {
		rmSync(file, { force: true });
	}
}

/**
 * A backup as an in-memory database.
 * @param {string} sql
 */
export function loadBackup(sql) {
	// A dump creates tables in the order they were made, not the order they
	// reference each other: the references are checked by planRestore instead.
	const db = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
	try {
		db.exec(sql);
	} catch (err) {
		db.close();
		throw new Error(`The backup does not load as SQLite: ${err instanceof Error ? err.message : err}`);
	}
	return db;
}

// ---------------------------------------------------------------- commands

/**
 * @param {boolean} local
 * @param {(line: string) => void} log
 */
function list(local, log) {
	const index = readIndex(local);
	if (!index.backups.length) return log('No backups are kept yet.');
	log(`Backups of ${BACKUP_DATABASE} (${local ? 'local' : BUCKET}), newest first; index updated ${index.updated}:`);
	for (const b of index.backups) log(`  ${b.name}   ${(b.bytes / 1024).toFixed(1).padStart(9)} KiB gzipped`);
	log(`Kept: every backup of the last ${index.keep_days} days, and never fewer than ${index.keep}.`);
}

/**
 * @param {boolean} local
 * @param {string | undefined} given
 * @param {string} out
 * @param {(line: string) => void} log
 */
function pull(local, given, out, log) {
	const name = chooseBackup(local, given);
	const dir = resolve(out);
	mkdirSync(dir, { recursive: true });
	const path = join(dir, `${name}.sql.gz`);
	if (existsSync(path)) return log(`${path} is already there.`);
	const part = `${path}.part`;
	r2Get(local, backupKey(name), part);
	// Checked before it takes the real name: a broken copy is never kept as a backup.
	gunzipSync(readFileSync(part));
	renameSync(part, path);
	log(`${path}`);
}

/**
 * @param {string[]} args
 * @param {string} name
 */
function option(args, name) {
	const i = args.indexOf(name);
	if (i < 0) return undefined;
	const v = args[i + 1];
	if (v === undefined || v.startsWith('--')) throw new Error(`${name} needs a value`);
	return v;
}

async function main() {
	const args = process.argv.slice(2);
	const local = args.includes('--local');
	const apply = args.includes('--apply');
	const log = (/** @type {string} */ line) => console.log(line);
	const given = option(args, '--backup') || undefined;
	switch (args[0]) {
		case 'list':
			return list(local, log);
		case 'pull': {
			const out = option(args, '--out');
			if (!out) throw new Error('Give --out DIR, outside this repository');
			return pull(local, given, out, log);
		}
		case 'restore': {
			const table = option(args, '--table');
			if (!table) throw new Error('Give --table NAME (e.g. comments)');
			const show = Number(option(args, '--show') ?? 10);
			if (!Number.isInteger(show) || show < 0) throw new Error('--show must be a whole number');
			const backup = loadBackup(backupSql(local, given, log));
			try {
				const live = wranglerRunner({ local });
				const plan = planRestore(backup, live, table, option(args, '--where') ?? '');
				reportPlan(plan, show, log);
				return applyRestore(live, plan, apply, log);
			} finally {
				backup.close();
			}
		}
		default:
			throw new Error('Commands: list, pull, restore (see the top of scripts/backup.js)');
	}
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	main().catch((err) => {
		console.error(`backup: ${err.message}`);
		process.exit(1);
	});
}
