// @ts-check
/**
 * Dictionary releases and workspace edits. Node standard library only; D1 is
 * reached through wrangler. Dry run unless --apply.
 *
 * Three D1 databases, each with one fixed role:
 *
 *   myordbok-app         APP         what the app writes: members, reactions,
 *                                    comments, workspace edits, which database each
 *                                    site reads (dict_release)
 *   myordbok-dataset     DATASET     every new build lands here first; beta
 *                                    reads it, so beta previews the next release
 *   myordbok-dictionary  DICTIONARY  what production readers get
 *
 * The dataset (TSV, private repository) is the source of truth. The app never
 * writes to the dictionary: workspace edits wait in dict_edits, are exported
 * here as the dataset's own patch files, applied and merged in the dataset,
 * and come back with the next release.
 *
 *   setup                       create the databases that are missing and write
 *                               their ids into wrangler.toml (once)
 *   status                      the build in each database, what each site reads,
 *                               edits by status
 *   publish --file BUILD.sql    import into myordbok-dataset, check it, beta
 *                               previews it, mark merged edits
 *   promote --file BUILD.sql    the build beta previews goes to production:
 *                               production reads myordbok-dataset while the same
 *                               build is imported into myordbok-dictionary and
 *                               checked, then reads myordbok-dictionary again
 *   stats   --file BUILD        a build's statistics → myordbok-app (build_stats),
 *                               shown in the workspace; publish does it too
 *   export  --out DIR           approved edits → TSV files for the dataset scripts
 *   switch  --env beta|production --to dataset|dictionary
 *                               point one site at one database (repairs only)
 *   grant   --email ADDRESS --role member|editor|admin
 *                               give a member a role, by the email they signed
 *                               in with (the first admin; later, admins do it
 *                               in the app)
 *
 * Common options:
 *   --apply   make the change (otherwise only report)
 *   --local   use the local databases of `wrangler dev` instead of Cloudflare
 *
 * The real dataset never enters this repository: --out and --file point
 * outside it (exports/ is ignored by git for convenience).
 */
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { statsOfFile, statsSql } from './stats.js';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const NULL = '\\N';
const CRLF = '\r\n';
const ENVS = /** @type {const} */ (['beta', 'production']);
/** IDs per IN (…) list, to keep each command well under argument limits. */
const CHUNK = 400;
/** The database_id values wrangler.toml ships with, before `make data-setup`. */
const PLACEHOLDER_ID = /^0{8}-0{4}-0{4}-0{4}-0{10}[0-9a-f]{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Every D1 database, by binding. */
export const DATABASES = Object.freeze({
	APP: 'myordbok-app',
	DATASET: 'myordbok-dataset',
	DICTIONARY: 'myordbok-dictionary',
});

/** @typedef {'dataset' | 'dictionary'} Dict  One of the two dictionary databases. */

/** Binding of each dictionary database. */
const BINDING = /** @type {const} */ ({ dataset: 'DATASET', dictionary: 'DICTIONARY' });

/**
 * How long a Worker may keep using the database it read before a switch
 * (worker/lib/dict.js caches it for 30 seconds), plus a margin.
 */
export const SWITCH_WAIT_MS = 35_000;

/**
 * The [[…d1_databases]] blocks of wrangler.toml.
 * @param {string} toml
 */
function d1Blocks(toml) {
	return toml.split(/^(?=\[\[)/m).filter((b) => /^\[\[(env\.\w+\.)?d1_databases\]\]/.test(b));
}

/**
 * Bindings whose database_id is a placeholder or not a UUID at all.
 * @param {string} toml
 * @returns {string[]}  e.g. ["DATASET (myordbok-dataset): 00000000-…"], once per binding.
 */
export function badDatabaseIds(toml) {
	const found = new Set();
	for (const block of d1Blocks(toml)) {
		const binding = /^binding\s*=\s*"([^"]+)"/m.exec(block)?.[1];
		const name = /^database_name\s*=\s*"([^"]+)"/m.exec(block)?.[1];
		const id = /^database_id\s*=\s*"([^"]*)"/m.exec(block)?.[1] ?? '';
		if (binding && (PLACEHOLDER_ID.test(id) || !UUID.test(id))) found.add(`${binding} (${name ?? '?'}): "${id}"`);
	}
	return [...found];
}

/**
 * wrangler.toml with the database_id of the given bindings replaced in every
 * environment. Comments on those lines are dropped; nothing else changes.
 * @param {string} toml
 * @param {Record<string, string>} ids  By binding.
 */
export function setDatabaseIds(toml, ids) {
	for (const id of Object.values(ids)) if (!UUID.test(id)) throw new Error(`Not a database id: ${id}`);
	return toml
		.split(/^(?=\[\[)/m)
		.map((block) => {
			const binding = /^binding\s*=\s*"([^"]+)"/m.exec(block)?.[1];
			if (!binding || !(binding in ids) || !/^\[\[(env\.\w+\.)?d1_databases\]\]/.test(block)) return block;
			return block.replace(/^database_id\s*=.*$/m, `database_id = "${ids[binding]}"`);
		})
		.join('');
}

/** Columns of the patch files, per dictionary (the dataset's edit scripts). */
export const FIELDS = Object.freeze({
	emd: ['word', 'wrte', 'sense', 'exam', 'wrkd', 'synset', 'delete'],
	med: ['wrte', 'sense', 'exam', 'wrkd', 'usg', 'ref', 'etymology', 'variant', 'reference', 'ipa', 'mlc', 'delete'],
});

/** Current values of senses, by dictionary: one row per sense id. */
const CURRENT_SQL = {
	emd: (/** @type {string} */ ids) =>
		`SELECT s.id, w.word, s.wrte, s.sense, s.exam, s.wrkd, s.synset
		 FROM emd_sense s JOIN eng_word w ON w.id = s.wrid WHERE s.id IN (${ids})`,
	med: (/** @type {string} */ ids) =>
		`SELECT s.id, w.word, w.ipa, w.mlc, s.wrte, s.sense, s.exam, s.wrkd, s.usg, s.ref, s.etymology, s.variant, s.reference
		 FROM med_sense s JOIN mya_word w ON w.id = s.wrid WHERE s.id IN (${ids})`,
};

// ---------------------------------------------------------------- values

/**
 * A database value as it appears in the dataset's TSV.
 * @param {unknown} v
 */
export function tsvValue(v) {
	if (v === null || v === undefined) return NULL;
	const s = String(v);
	if (/[\t\r\n]/.test(s)) throw new Error(`Value holds a tab or line break: ${JSON.stringify(s.slice(0, 60))}`);
	return s;
}

/**
 * @param {string[]} header
 * @param {unknown[][]} rows
 */
export function tsv(header, rows) {
	return [header, ...rows.map((r) => r.map(tsvValue))].map((r) => r.join('\t') + CRLF).join('');
}

/**
 * SQL string literal.
 * @param {unknown} v
 */
export function sqlValue(v) {
	if (v === null || v === undefined) return 'NULL';
	if (typeof v === 'number' && Number.isFinite(v)) return String(v);
	return `'${String(v).replaceAll("'", "''")}'`;
}

/** @param {number[]} ids */
function idList(ids) {
	for (const id of ids) if (!Number.isInteger(id)) throw new Error(`Not an id: ${id}`);
	return ids.join(', ');
}

// ---------------------------------------------------------------- export

/**
 * @typedef {object} Edit  A row of dict_edits.
 * @property {number} id
 * @property {'emd' | 'med'} dict
 * @property {'edit' | 'add' | 'delete'} action
 * @property {number | null} sense_id
 * @property {string | null} field
 * @property {string | null} old_value
 * @property {string | null} new_value
 * @property {string} word
 * @property {string | null} data
 * @property {number} created_at
 */

/**
 * @typedef {object} ExportPlan
 * @property {Record<string, { header: string[], rows: unknown[][] }>} files  By file name.
 * @property {number[]} exported   dict_edits ids written to a file.
 * @property {Array<{ id: number, reason: string }>} conflicts
 */

/**
 * Turns approved edits into the dataset's input files.
 *
 *   emd_patch.tsv / med_patch.tsv   id field old new      (emd_edit.py / med_edit.py)
 *   emd_new.tsv                     word wrte sense exam synset   (emd_add.py)
 *   emd_more.tsv                    same, for existing words      (emd_add.py --existing)
 *   med_new.tsv                     word wrte sense exam ipa mlc  (med_add.py)
 *   med_more.tsv                    same, ipa/mlc \N              (med_add.py --existing)
 *
 * An edit whose old value no longer matches the dictionary is a conflict,
 * as is a second edit of the same field that does not start where the first
 * ended. Edits of one field that chain (a→b, then b→c) become one line
 * (a→c), because a patch may name each id and field once.
 *
 * @param {Edit[]} edits  Approved edits.
 * @param {{ emd: Map<number, Record<string, unknown>>, med: Map<number, Record<string, unknown>> }} current
 *   Current values of the senses the edits name, by sense id.
 * @param {{ emd: Set<string>, med: Set<string> }} existing  Headwords that already have senses.
 * @returns {ExportPlan}
 */
export function planExport(edits, current, existing) {
	/** @type {ExportPlan['conflicts']} */
	const conflicts = [];
	/** @type {number[]} */
	const exported = [];
	/** @type {ExportPlan['files']} */
	const files = {};
	/** @param {string} name @param {string[]} header @param {unknown[]} row */
	const put = (name, header, row) => {
		files[name] ??= { header, rows: [] };
		files[name].rows.push(row);
	};

	const sorted = [...edits].sort((a, b) => a.created_at - b.created_at || a.id - b.id);

	for (const dict of /** @type {const} */ (['emd', 'med'])) {
		const mine = sorted.filter((e) => e.dict === dict);

		// Deletions first: no other line may name a deleted id.
		const deleted = new Set();
		for (const e of mine.filter((x) => x.action === 'delete')) {
			const row = current[dict].get(Number(e.sense_id));
			if (!row) conflicts.push({ id: e.id, reason: `sense ${e.sense_id} no longer exists` });
			else if (deleted.has(e.sense_id)) conflicts.push({ id: e.id, reason: `sense ${e.sense_id} is already deleted by another edit` });
			else {
				deleted.add(e.sense_id);
				put(`${dict}_patch.tsv`, ['id', 'field', 'old', 'new'], [e.sense_id, 'delete', row.word, null]);
				exported.push(e.id);
			}
		}

		// Field edits, chained per (id, field).
		/** @type {Map<string, { first: Edit, old: unknown, value: string | null, ids: number[] }>} */
		const chains = new Map();
		for (const e of mine.filter((x) => x.action === 'edit')) {
			const field = String(e.field);
			if (!FIELDS[dict].includes(field) || field === 'delete') {
				conflicts.push({ id: e.id, reason: `field ${field} cannot be edited in ${dict}` });
				continue;
			}
			if (deleted.has(e.sense_id)) {
				conflicts.push({ id: e.id, reason: `sense ${e.sense_id} is deleted by another edit` });
				continue;
			}
			const key = `${e.sense_id}\t${field}`;
			const chain = chains.get(key);
			if (!chain) {
				const row = current[dict].get(Number(e.sense_id));
				if (!row) {
					conflicts.push({ id: e.id, reason: `sense ${e.sense_id} no longer exists` });
					continue;
				}
				const now = row[field] ?? null;
				if (tsvValue(now) !== tsvValue(e.old_value)) {
					conflicts.push({ id: e.id, reason: `sense ${e.sense_id} ${field} is now ${JSON.stringify(now)}, the edit expected ${JSON.stringify(e.old_value)}` });
					continue;
				}
				chains.set(key, { first: e, old: now, value: e.new_value, ids: [e.id] });
			} else if (tsvValue(chain.value) === tsvValue(e.old_value)) {
				chain.value = e.new_value;
				chain.ids.push(e.id);
			} else {
				conflicts.push({ id: e.id, reason: `sense ${e.sense_id} ${field} is changed by edit ${chain.ids.at(-1)} to ${JSON.stringify(chain.value)} first` });
			}
		}
		for (const chain of chains.values()) {
			if (tsvValue(chain.old) === tsvValue(chain.value)) {
				exported.push(...chain.ids); // changed and changed back: nothing to write
				continue;
			}
			put(`${dict}_patch.tsv`, ['id', 'field', 'old', 'new'], [chain.first.sense_id, chain.first.field, chain.old, chain.value]);
			exported.push(...chain.ids);
		}

		// Additions.
		for (const e of mine.filter((x) => x.action === 'add')) {
			/** @type {Record<string, unknown>} */
			let d;
			try {
				d = JSON.parse(String(e.data));
			} catch {
				conflicts.push({ id: e.id, reason: 'data is not JSON' });
				continue;
			}
			const isNew = !existing[dict].has(e.word);
			if (dict === 'emd') {
				const row = [e.word, d.wrte, d.sense, d.exam ?? null, d.synset ?? null];
				put(isNew ? 'emd_new.tsv' : 'emd_more.tsv', ['word', 'wrte', 'sense', 'exam', 'synset'], row);
			} else {
				if (isNew && (!d.ipa || !d.mlc)) {
					conflicts.push({ id: e.id, reason: `new headword ${e.word} needs ipa and mlc` });
					continue;
				}
				const row = [e.word, d.wrte, d.sense, d.exam ?? null, isNew ? d.ipa : null, isNew ? d.mlc : null];
				put(isNew ? 'med_new.tsv' : 'med_more.tsv', ['word', 'wrte', 'sense', 'exam', 'ipa', 'mlc'], row);
			}
			exported.push(e.id);
		}
	}
	// Every value must travel as TSV.
	for (const f of Object.values(files)) tsv(f.header, f.rows);
	return { files, exported, conflicts };
}

/**
 * Edits of one field exported together left as one patch line (a→b→c became
 * a→c), so only the last of them can be found in a build. Returns that last
 * edit of each (export, sense, field), carrying the ids of the whole chain;
 * other edits pass through.
 * @template {Edit & { export_id: number }} E
 * @param {E[]} edits
 * @returns {Array<E & { chain?: number[] }>}
 */
export function latestOfChains(edits) {
	/** @type {Map<string, E & { chain: number[] }>} */
	const last = new Map();
	/** @type {E[]} */
	const other = [];
	const sorted = [...edits].sort((a, b) => a.created_at - b.created_at || a.id - b.id);
	for (const e of sorted) {
		if (e.action !== 'edit') {
			other.push(e);
			continue;
		}
		const key = `${e.export_id}\t${e.sense_id}\t${e.field}`;
		const chain = [...(last.get(key)?.chain ?? []), e.id];
		last.set(key, { ...e, chain });
	}
	return [...other, ...last.values()];
}

/**
 * Whether an exported edit is in a published dictionary.
 * @param {Edit} e
 * @param {Record<string, unknown> | undefined} row  Current values of e.sense_id; undefined if gone.
 * @param {boolean} added  For 'add': the headword now has a sense with that text.
 */
export function isMerged(e, row, added) {
	if (e.action === 'delete') return !row;
	if (e.action === 'add') return added;
	return !!row && tsvValue(row[String(e.field)] ?? null) === tsvValue(e.new_value);
}

/**
 * Checks of an imported build: every table holds the rows its meta says.
 * @param {Record<string, string>} meta
 * @param {Record<string, number>} counts  Rows per table, counted.
 * @returns {string[]}  Problems; empty when the build is complete.
 */
export function verifyBuild(meta, counts) {
	/** @type {string[]} */
	const problems = [];
	if (!meta.built) problems.push('meta has no built value');
	const expected = Object.entries(meta).filter(([k]) => k.startsWith('rows.'));
	if (!expected.length) problems.push('meta has no rows.* counts');
	for (const [key, value] of expected) {
		const table = key.slice(5);
		if (counts[table] !== Number(value)) problems.push(`${table}: ${counts[table] ?? 'missing'} rows, meta says ${value}`);
	}
	return problems;
}

// ---------------------------------------------------------------- D1

/**
 * @typedef {object} Runner
 * @property {(binding: string, sql: string) => Record<string, unknown>[]} query  Rows of the last statement.
 * @property {(binding: string, path: string) => void} file  Run a .sql file.
 * @property {string} where  For messages: "local" or "remote".
 */

/**
 * @param {{ local: boolean }} opts
 * @returns {Runner}
 */
export function wranglerRunner({ local }) {
	const target = local ? ['--local'] : ['--remote', '--env', 'beta'];
	/** @param {string[]} args */
	const run = (args) =>
		execFileSync('npx', ['wrangler', 'd1', 'execute', ...args, ...target], {
			encoding: 'utf8',
			maxBuffer: 256 * 1024 * 1024,
			stdio: ['ignore', 'pipe', 'inherit'],
		});
	return {
		where: local ? 'local' : 'remote',
		query(binding, sql) {
			const out = JSON.parse(run([binding, '--json', '--command', sql]));
			return out.at(-1)?.results ?? [];
		},
		file(binding, path) {
			run([binding, '--yes', '--file', path]);
		},
	};
}

/** @param {Dict} dict */
const nameOf = (dict) => DATABASES[BINDING[dict]];

/**
 * meta of a dictionary database, or null when it holds no build.
 * @param {Runner} db
 * @param {Dict} dict
 * @returns {Record<string, string> | null}
 */
function metaOf(db, dict) {
	const tables = db.query(BINDING[dict], "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'meta'");
	if (!tables.length) return null;
	return Object.fromEntries(db.query(BINDING[dict], 'SELECT key, value FROM meta').map((r) => [String(r.key), String(r.value)]));
}

/**
 * Which database each site reads.
 * @param {Runner} db
 * @returns {Partial<Record<'beta' | 'production', { reads: Dict, build: string, switched_at: number, switched_by: string }>>}
 */
function siteReads(db) {
	return Object.fromEntries(db.query('APP', 'SELECT env, reads, build, switched_at, switched_by FROM dict_release').map((r) => [String(r.env), /** @type {any} */ (r)]));
}

/**
 * @param {Runner} db
 * @param {'beta' | 'production'} env
 * @param {Dict} dict
 * @param {string} build
 */
function point(db, env, dict, build) {
	db.query(
		'APP',
		`INSERT INTO dict_release (env, reads, build, switched_by) VALUES (${sqlValue(env)}, ${sqlValue(dict)}, ${sqlValue(build)}, ${sqlValue(operator())})
		 ON CONFLICT (env) DO UPDATE SET reads = excluded.reads, build = excluded.build, switched_at = unixepoch(), switched_by = excluded.switched_by`,
	);
}

/** Who runs the command, for the records. */
function operator() {
	try {
		return execFileSync('git', ['config', 'user.name'], { encoding: 'utf8' }).trim() || 'unknown';
	} catch {
		return 'unknown';
	}
}

/**
 * The build a .sql file carries, read from its meta rows.
 * @param {string} text
 * @returns {string | null}
 */
export function buildOfFile(text) {
	return /\('built',\s*'([^']*)'\)/.exec(text)?.[1] ?? null;
}

/**
 * Checks a freshly imported database: every table holds the rows its meta
 * says. Throws with every problem found.
 * @param {Runner} db
 * @param {Dict} dict
 * @returns {Record<string, string>}  Its meta.
 */
function checkImport(db, dict) {
	const meta = metaOf(db, dict);
	if (!meta) throw new Error(`${nameOf(dict)} has no meta table after the import`);
	/** @type {Record<string, number>} */
	const counts = {};
	for (const key of Object.keys(meta).filter((k) => k.startsWith('rows.'))) {
		const table = key.slice(5);
		if (!/^\w+$/.test(table)) throw new Error(`Odd table name in meta: ${table}`);
		counts[table] = Number(db.query(BINDING[dict], `SELECT count(*) AS n FROM ${table}`)[0]?.n);
	}
	const problems = verifyBuild(meta, counts);
	if (problems.length) throw new Error(`${nameOf(dict)} failed its checks:\n  ${problems.join('\n  ')}`);
	return meta;
}

/**
 * Current values of the given senses.
 * @param {Runner} db
 * @param {Dict} dict
 * @param {'emd' | 'med'} lang
 * @param {number[]} ids
 */
function currentRows(db, dict, lang, ids) {
	/** @type {Map<number, Record<string, unknown>>} */
	const out = new Map();
	const unique = [...new Set(ids)];
	for (let i = 0; i < unique.length; i += CHUNK) {
		for (const r of db.query(BINDING[dict], CURRENT_SQL[lang](idList(unique.slice(i, i + CHUNK))))) out.set(Number(r.id), r);
	}
	return out;
}

/**
 * Headwords among `words` that already have senses.
 * @param {Runner} db
 * @param {Dict} dict
 * @param {'emd' | 'med'} lang
 * @param {string[]} words
 */
function existingWords(db, dict, lang, words) {
	const sql = {
		emd: (/** @type {string} */ list) => `SELECT DISTINCT w.word FROM eng_word w JOIN emd_sense s ON s.wrid = w.id WHERE w.word IN (${list})`,
		med: (/** @type {string} */ list) => `SELECT DISTINCT w.word FROM mya_word w JOIN med_sense s ON s.wrid = w.id WHERE w.word IN (${list})`,
	};
	const out = new Set();
	const unique = [...new Set(words)];
	for (let i = 0; i < unique.length; i += CHUNK) {
		const list = unique.slice(i, i + CHUNK).map(sqlValue).join(', ');
		for (const r of db.query(BINDING[dict], sql[lang](list))) out.add(String(r.word));
	}
	return out;
}

/**
 * Refuses to go on while production reads myordbok-dataset, which only
 * happens when a promotion stopped half way.
 * @param {Runner} db
 */
function requirePromotionFinished(db) {
	if (siteReads(db).production?.reads === 'dataset') {
		throw new Error(
			`Production reads ${DATABASES.DATASET}: a promotion did not finish. ` +
				'Run make data-promote FILE=… APPLY=1 with the build beta previews to finish it.',
		);
	}
}

// ---------------------------------------------------------------- commands

/**
 * @param {Runner} db
 * @param {string} out
 * @param {boolean} apply
 * @param {(line: string) => void} log
 */
export async function exportEdits(db, out, apply, log) {
	requirePromotionFinished(db);
	const live = metaOf(db, 'dictionary');
	if (!live?.built) throw new Error(`${DATABASES.DICTIONARY} holds no build yet; publish and promote one first`);
	const preview = metaOf(db, 'dataset');
	if (preview?.built && preview.built !== live.built) {
		throw new Error(
			`Beta previews build ${preview.built}, production has ${live.built}. ` +
				'Promote it first (make data-promote), so edits are checked against what readers see.',
		);
	}
	const edits = /** @type {Edit[]} */ (
		/** @type {unknown} */ (db.query('APP', "SELECT id, dict, action, sense_id, field, old_value, new_value, word, data, created_at FROM dict_edits WHERE status = 'approved' ORDER BY created_at, id"))
	);
	if (!edits.length) {
		log('No approved edits to export.');
		return;
	}
	/** @param {'emd' | 'med'} lang */
	const ids = (lang) => edits.filter((e) => e.dict === lang && e.sense_id !== null).map((e) => Number(e.sense_id));
	/** @param {'emd' | 'med'} lang */
	const words = (lang) => edits.filter((e) => e.dict === lang && e.action === 'add').map((e) => e.word);
	const plan = planExport(
		edits,
		{ emd: currentRows(db, 'dictionary', 'emd', ids('emd')), med: currentRows(db, 'dictionary', 'med', ids('med')) },
		{ emd: existingWords(db, 'dictionary', 'emd', words('emd')), med: existingWords(db, 'dictionary', 'med', words('med')) },
	);

	for (const [name, f] of Object.entries(plan.files)) log(`${name}: ${f.rows.length} line(s)`);
	for (const c of plan.conflicts) log(`conflict: edit ${c.id}: ${c.reason}`);
	if (!apply) {
		log(`Dry run against ${DATABASES.DICTIONARY}, build ${live.built} (${db.where}). Add --apply to write the files and mark the edits.`);
		return;
	}

	const counts = Object.fromEntries(Object.entries(plan.files).map(([name, f]) => [name, f.rows.length]));
	const [created] = db.query('APP', `INSERT INTO dict_exports (created_by, counts) VALUES (${sqlValue(operator())}, ${sqlValue(JSON.stringify(counts))}) RETURNING id`);
	const exportId = Number(created.id);
	const dir = resolve(out, `export-${String(exportId).padStart(4, '0')}`);
	await mkdir(dir, { recursive: true });
	for (const [name, f] of Object.entries(plan.files)) await writeFile(join(dir, name), tsv(f.header, f.rows));

	for (let i = 0; i < plan.exported.length; i += CHUNK) {
		db.query('APP', `UPDATE dict_edits SET status = 'exported', export_id = ${exportId} WHERE id IN (${idList(plan.exported.slice(i, i + CHUNK))})`);
	}
	for (const c of plan.conflicts) {
		db.query('APP', `UPDATE dict_edits SET status = 'conflict', review_note = ${sqlValue(c.reason)} WHERE id = ${c.id}`);
	}
	log(`Wrote ${dir}. In the dataset, run each file through its script (dry run first):`);
	const how = {
		'emd_patch.tsv': 'scripts/emd_edit.py',
		'emd_new.tsv': 'scripts/emd_add.py',
		'emd_more.tsv': 'scripts/emd_add.py --existing',
		'med_patch.tsv': 'scripts/med_edit.py',
		'med_new.tsv': 'scripts/med_add.py',
		'med_more.tsv': 'scripts/med_add.py --existing',
	};
	for (const name of Object.keys(plan.files)) log(`  python3 ${how[/** @type {keyof how} */ (name)]} ${join(dir, name)}`);
	log('Then build (scripts/db_build.py --apply) and run make data-publish FILE=…/build/myordbok.sql.');
}

/**
 * A build goes into myordbok-dataset and beta previews it.
 * @param {Runner} db
 * @param {string} file
 * @param {boolean} apply
 * @param {(line: string) => void} log
 */
export function publish(db, file, apply, log) {
	if (!existsSync(file)) throw new Error(`${file} not found; build the dataset first (scripts/db_build.py --apply)`);
	requirePromotionFinished(db);
	const built = buildOfFile(readFileSync(file, 'utf8'));
	if (!built) throw new Error(`${file} has no ('built', …) row in meta; is it a dataset build?`);
	const before = metaOf(db, 'dataset');
	log(`${DATABASES.DATASET}: build ${before?.built ?? '(empty)'} → ${built} (${db.where}). Beta will preview it; production is not touched.`);
	if (!apply) {
		log('Dry run. Add --apply to import, check, and show it on beta.');
		return;
	}

	log(`Importing ${file} into ${DATABASES.DATASET} …`);
	db.file(BINDING.dataset, file);
	const meta = checkImport(db, 'dataset');
	log(`${DATABASES.DATASET} holds build ${meta.built} (source ${meta.source ?? '?'}); every table matches its count.`);
	point(db, 'beta', 'dataset', meta.built);
	log(`Beta previews it (within 30 seconds). Check https://beta.myordbok.com, then: make data-promote FILE=${file} APPLY=1`);
	markMerged(db, 'dataset', meta.built, log);
	writeStats(db, file, true, log);
}

/**
 * A build's statistics into myordbok-app, worked out here from the file.
 * @param {Runner} db
 * @param {string} file
 * @param {boolean} apply
 * @param {(line: string) => void} log
 */
export function writeStats(db, file, apply, log) {
	if (!existsSync(file)) throw new Error(`${file} not found`);
	const stats = statsOfFile(file);
	log(`Statistics of build ${stats.build}: English ${stats.en.headwords} headwords, ${stats.en.senses} meanings (${stats.en.awaiting} awaiting review); Myanmar ${stats.my.headwords} headwords, ${stats.my.senses} meanings.`);
	if (!apply) {
		log('Dry run. Add --apply to keep them in myordbok-app for the workspace.');
		return;
	}
	const path = join(tmpdir(), `myordbok-stats-${process.pid}.sql`);
	writeFileSync(path, statsSql(stats));
	try {
		db.file('APP', path);
	} finally {
		rmSync(path, { force: true });
	}
	log(`Kept in myordbok-app (${db.where}); the workspace shows them.`);
}

/**
 * The build beta previews goes to production, without a moment where
 * production has nothing to read.
 * @param {Runner} db
 * @param {string} file  The same build that was published.
 * @param {boolean} apply
 * @param {(line: string) => void} log
 * @param {{ waitMs?: number }} [opts]
 */
export async function promote(db, file, apply, log, opts = {}) {
	const waitMs = opts.waitMs ?? SWITCH_WAIT_MS;
	if (!existsSync(file)) throw new Error(`${file} not found`);
	const preview = metaOf(db, 'dataset');
	if (!preview?.built) throw new Error(`${DATABASES.DATASET} holds no build; run make data-publish first`);
	const built = buildOfFile(readFileSync(file, 'utf8'));
	if (built !== preview.built) {
		throw new Error(`${file} holds build ${built ?? '(none)'}, beta previews ${preview.built}. Promote the build beta previews.`);
	}
	const live = metaOf(db, 'dictionary');
	const reads = siteReads(db);
	if (live?.built === built && reads.production?.reads === 'dictionary') {
		log(`Production already has build ${built}. Nothing to do.`);
		return;
	}
	log(`Production: build ${live?.built ?? '(none)'} → ${built} (${db.where}).`);
	log(`  1. production reads ${DATABASES.DATASET}, which holds this build`);
	log(`  2. the build is imported into ${DATABASES.DICTIONARY} and checked`);
	log(`  3. production reads ${DATABASES.DICTIONARY} again`);
	if (!apply) {
		log('Dry run. Add --apply to promote.');
		return;
	}

	if (reads.production?.reads !== 'dataset') {
		point(db, 'production', 'dataset', preview.built);
		log(`1. Production reads ${DATABASES.DATASET}.`);
		if (waitMs > 0) {
			log(`   Waiting ${Math.round(waitMs / 1000)} s until no Worker reads ${DATABASES.DICTIONARY} …`);
			await sleep(waitMs);
		}
	} else {
		log(`1. Production already reads ${DATABASES.DATASET} (an earlier promotion stopped here).`);
	}

	log(`2. Importing ${file} into ${DATABASES.DICTIONARY} …`);
	db.file(BINDING.dictionary, file);
	const meta = checkImport(db, 'dictionary');
	if (meta.built !== preview.built) throw new Error(`${DATABASES.DICTIONARY} holds build ${meta.built} after the import, expected ${preview.built}`);
	log(`   ${DATABASES.DICTIONARY} holds build ${meta.built}; every table matches its count.`);

	point(db, 'production', 'dictionary', meta.built);
	log(`3. Production reads ${DATABASES.DICTIONARY} again (within 30 seconds). Done.`);
}

/**
 * Exported edits that the new build contains become merged.
 * @param {Runner} db
 * @param {Dict} dict
 * @param {string} built
 * @param {(line: string) => void} log
 */
function markMerged(db, dict, built, log) {
	const edits = /** @type {Array<Edit & { export_id: number }>} */ (
		/** @type {unknown} */ (db.query('APP', "SELECT id, dict, action, sense_id, field, old_value, new_value, word, data, created_at, export_id FROM dict_edits WHERE status = 'exported'"))
	);
	if (!edits.length) return;
	/** @type {number[]} */
	const merged = [];
	for (const lang of /** @type {const} */ (['emd', 'med'])) {
		const mine = edits.filter((e) => e.dict === lang);
		const rows = currentRows(db, dict, lang, mine.filter((e) => e.sense_id !== null).map((e) => Number(e.sense_id)));
		const senseTable = lang === 'emd' ? 'emd_sense' : 'med_sense';
		const wordTable = lang === 'emd' ? 'eng_word' : 'mya_word';
		for (const e of latestOfChains(mine)) {
			let added = false;
			if (e.action === 'add') {
				const sense = JSON.parse(String(e.data)).sense;
				added = db.query(BINDING[dict], `SELECT 1 FROM ${senseTable} s JOIN ${wordTable} w ON w.id = s.wrid WHERE w.word = ${sqlValue(e.word)} AND s.sense = ${sqlValue(sense)} LIMIT 1`).length > 0;
			}
			if (isMerged(e, rows.get(Number(e.sense_id)), added)) merged.push(...(e.chain ?? [e.id]));
		}
	}
	for (let i = 0; i < merged.length; i += CHUNK) {
		db.query('APP', `UPDATE dict_edits SET status = 'merged' WHERE id IN (${idList(merged.slice(i, i + CHUNK))})`);
	}
	db.query(
		'APP',
		`UPDATE dict_exports SET merged_source = ${sqlValue(built)}, merged_at = unixepoch()
		 WHERE merged_at IS NULL AND id IN (SELECT export_id FROM dict_edits WHERE export_id IS NOT NULL)
		 AND NOT EXISTS (SELECT 1 FROM dict_edits e WHERE e.export_id = dict_exports.id AND e.status = 'exported')`,
	);
	log(`Edits merged by this build: ${merged.length} of ${edits.length} exported. The rest stay exported until a build contains them.`);
}

/**
 * Points one site at one database. Repairs only: publish and promote do this
 * themselves.
 * @param {Runner} db
 * @param {'beta' | 'production'} env
 * @param {Dict} dict
 * @param {boolean} apply
 * @param {(line: string) => void} log
 */
export function switchSite(db, env, dict, apply, log) {
	const meta = metaOf(db, dict);
	if (!meta?.built) throw new Error(`${nameOf(dict)} holds no build`);
	const now = siteReads(db)[env];
	log(`${env}: ${now ? nameOf(now.reads) : '(nothing)'} → ${nameOf(dict)} (build ${meta.built}, ${db.where}).`);
	if (now?.reads === dict && now.build === meta.built) {
		log('Nothing to do.');
		return;
	}
	if (!apply) {
		log('Dry run. Add --apply to switch.');
		return;
	}
	point(db, env, dict, meta.built);
	log(`${env} reads ${nameOf(dict)} (within 30 seconds).`);
}

/**
 * @param {Runner} db
 * @param {(line: string) => void} log
 */
export function status(db, log) {
	const reads = siteReads(db);
	/** @type {Dict[]} */
	const dicts = ['dictionary', 'dataset'];
	const width = Math.max(...dicts.map((d) => nameOf(d).length));
	/** @type {Record<string, string>} */
	const builds = {};
	for (const dict of dicts) {
		const meta = metaOf(db, dict);
		builds[dict] = meta?.built ?? '';
		const readers = ENVS.filter((env) => reads[env]?.reads === dict);
		log(`${nameOf(dict).padEnd(width)}  ${meta?.built ? `build ${meta.built}, source ${meta.source ?? '?'}` : 'empty'}${readers.length ? `  ← ${readers.join(', ')}` : ''}`);
	}
	if (reads.production?.reads === 'dataset') log('A promotion did not finish: run make data-promote FILE=… APPLY=1.');
	else if (builds.dataset && builds.dataset !== builds.dictionary) log('Beta previews a build production does not have yet: make data-promote FILE=… APPLY=1 when it looks right.');
	const counts = db.query('APP', 'SELECT status, count(*) AS n FROM dict_edits GROUP BY status ORDER BY status');
	log(`edits: ${counts.length ? counts.map((r) => `${r.status} ${r.n}`).join(', ') : 'none'}`);
}

// ---------------------------------------------------------------- command line

/**
 * @param {string[]} args
 * @param {string} name
 */
function option(args, name) {
	const i = args.indexOf(name);
	return i >= 0 ? args[i + 1] : undefined;
}

const WRANGLER_TOML = join(import.meta.dirname, '..', 'wrangler.toml');

/**
 * Creates the databases that do not exist yet and writes their ids into
 * wrangler.toml. Safe to run again: existing databases are reused.
 * @param {boolean} apply
 * @param {(line: string) => void} log
 */
function setup(apply, log) {
	/** @param {string[]} args */
	const wrangler = (args) => execFileSync('npx', ['wrangler', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
	const list = () => /** @type {Array<{ name: string, uuid: string }>} */ (JSON.parse(wrangler(['d1', 'list', '--json'])));

	let databases = list();
	const missing = Object.values(DATABASES).filter((name) => !databases.some((d) => d.name === name));
	for (const name of Object.values(DATABASES)) {
		log(`${name}: ${missing.includes(name) ? (apply ? 'creating' : 'missing, would be created') : 'exists'}`);
	}
	if (!apply) {
		log('Dry run. Add APPLY=1 to create what is missing and write the ids into wrangler.toml.');
		return;
	}
	for (const name of missing) wrangler(['d1', 'create', name]);
	if (missing.length) databases = list();

	/** @type {Record<string, string>} */
	const ids = {};
	for (const [binding, name] of Object.entries(DATABASES)) {
		const found = databases.find((d) => d.name === name);
		if (!found) throw new Error(`${name} is not in wrangler d1 list after creating it`);
		ids[binding] = found.uuid;
		log(`${binding} = ${name} (${found.uuid})`);
	}
	const before = readFileSync(WRANGLER_TOML, 'utf8');
	const after = setDatabaseIds(before, ids);
	const bad = badDatabaseIds(after);
	if (bad.length) throw new Error(`wrangler.toml still has bad ids after the update: ${bad.join(', ')}`);
	if (after === before) {
		log('wrangler.toml already has these ids.');
		return;
	}
	writeFileSync(WRANGLER_TOML, after);
	log('Wrote the ids into wrangler.toml (top level, beta, production). Commit it: ids are not secrets.');
}

/**
 * Gives the member signed in with `email` a role, recorded in role_grants
 * with no granting member (the command line).
 * @param {Runner} db
 * @param {string} email
 * @param {string} role
 * @param {boolean} apply
 * @param {(line: string) => void} log
 */
export function grant(db, email, role, apply, log) {
	const address = email.trim().toLowerCase();
	// Checked before it goes into SQL: wrangler's --command takes no parameters.
	if (!/^[^\s'"\\@]+@[^\s'"\\@]+\.[^\s'"\\@]+$/.test(address)) throw new Error('Give --email the address the member signed in with');
	if (!['member', 'editor', 'admin'].includes(role)) throw new Error('Give --role member, editor or admin');
	const [row] = db.query('APP', `SELECT id, name, role, status FROM users WHERE email = '${address}'`);
	if (!row) throw new Error(`No member has the email ${address} (${db.where}). Sign in once with it first.`);
	log(`${row.name} (#${row.id}, ${address}): ${row.role} → ${role}${row.status === 'active' ? '' : ` (account ${row.status})`}`);
	if (row.role === role) return log('Nothing to change.');
	if (!apply) return log('Dry run. Add APPLY=1 to give the role.');
	db.query('APP', `UPDATE users SET role = '${role}' WHERE id = ${Number(row.id)}`);
	db.query('APP', `INSERT INTO role_grants (user_id, role, granted_by) VALUES (${Number(row.id)}, '${role}', NULL)`);
	log('Done. It applies from the next page load; no new sign-in is needed.');
}

async function main() {
	const args = process.argv.slice(2);
	const command = args[0];
	const apply = args.includes('--apply');
	const local = args.includes('--local');
	const log = (/** @type {string} */ line) => console.log(line);
	if (command === 'setup') return setup(apply, log);
	if (!local) {
		const bad = badDatabaseIds(readFileSync(WRANGLER_TOML, 'utf8'));
		if (bad.length) {
			throw new Error(`wrangler.toml has no real database id for ${bad.join(', ')}.\nRun make data-setup APPLY=1 to create the databases and fill in their ids.`);
		}
	}
	const db = wranglerRunner({ local });
	/** @param {string} what */
	const fileArg = (what) => {
		const file = option(args, '--file');
		if (!file) throw new Error(`Give --file PATH/build/myordbok.sql, the build to ${what}`);
		return resolve(file);
	};

	switch (command) {
		case 'status':
			return status(db, log);
		case 'stats':
			return writeStats(db, fileArg('count'), apply, log);
		case 'export':
			return exportEdits(db, option(args, '--out') ?? 'exports', apply, log);
		case 'publish':
			return publish(db, fileArg('publish'), apply, log);
		case 'promote':
			// Local Workers pin DICT_DB, so nothing reads the local database being replaced.
			return promote(db, fileArg('promote'), apply, log, local ? { waitMs: 0 } : {});
		case 'switch': {
			const env = option(args, '--env');
			if (env !== 'beta' && env !== 'production') throw new Error('Give --env beta or --env production');
			const to = option(args, '--to');
			if (to !== 'dataset' && to !== 'dictionary') throw new Error('Give --to dataset or --to dictionary');
			return switchSite(db, env, to, apply, log);
		}
		case 'grant':
			return grant(db, option(args, '--email') ?? '', option(args, '--role') ?? '', apply, log);
		default:
			throw new Error('Commands: setup, status, publish, promote, stats, export, switch, grant (see the top of scripts/data.js)');
	}
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	main().catch((err) => {
		console.error(`data: ${err.message}`);
		process.exit(1);
	});
}
