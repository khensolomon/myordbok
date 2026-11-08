// @ts-check
/**
 * Dictionary data releases and studio edits. Node standard library only;
 * D1 is reached through wrangler. Dry run unless --apply.
 *
 * The dataset (TSV, private repository) is the source of truth. The app never
 * writes to the dictionary: studio edits wait in dict_edits (app database),
 * are exported here as the dataset's own patch files, applied and merged in
 * the dataset, and come back with the next release.
 *
 *   status                          releases, slots and edits at a glance
 *   export  --out DIR               approved edits → TSV files for the dataset scripts
 *   publish --file build/myordbok.sql
 *                                   import a build into the free slot, check it,
 *                                   point beta at it, mark merged edits
 *   switch  --env production|beta [--slot a|b]
 *                                   point a site at a slot (default: beta's)
 *
 * Common options:
 *   --apply   make the change (otherwise only report)
 *   --local   use the local databases of `wrangler dev` instead of Cloudflare
 *
 * The real dataset never enters this repository: --out and --file point
 * outside it (exports/ is ignored by git for convenience).
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const NULL = '\\N';
const CRLF = '\r\n';
const SLOTS = /** @type {const} */ (['a', 'b']);
const ENVS = /** @type {const} */ (['beta', 'production']);
/** IDs per IN (…) list, to keep each command well under argument limits. */
const CHUNK = 400;

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

/** @param {'a' | 'b'} slot */
const binding = (slot) => `DICT_${slot.toUpperCase()}`;

/**
 * meta of a slot, or null when the slot holds no dictionary.
 * @param {Runner} db
 * @param {'a' | 'b'} slot
 * @returns {Record<string, string> | null}
 */
function slotMeta(db, slot) {
	const tables = db.query(binding(slot), "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'meta'");
	if (!tables.length) return null;
	return Object.fromEntries(db.query(binding(slot), 'SELECT key, value FROM meta').map((r) => [String(r.key), String(r.value)]));
}

/**
 * @param {Runner} db
 * @returns {Record<string, { slot: 'a' | 'b', source: string, switched_at: number, switched_by: string }>}
 */
function releases(db) {
	return Object.fromEntries(db.query('DB', 'SELECT env, slot, source, switched_at, switched_by FROM dict_release').map((r) => [String(r.env), /** @type {any} */ (r)]));
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
 * Current values of the given senses.
 * @param {Runner} db
 * @param {'a' | 'b'} slot
 * @param {'emd' | 'med'} dict
 * @param {number[]} ids
 */
function currentRows(db, slot, dict, ids) {
	/** @type {Map<number, Record<string, unknown>>} */
	const out = new Map();
	const unique = [...new Set(ids)];
	for (let i = 0; i < unique.length; i += CHUNK) {
		for (const r of db.query(binding(slot), CURRENT_SQL[dict](idList(unique.slice(i, i + CHUNK))))) out.set(Number(r.id), r);
	}
	return out;
}

/**
 * Headwords among `words` that already have senses.
 * @param {Runner} db
 * @param {'a' | 'b'} slot
 * @param {'emd' | 'med'} dict
 * @param {string[]} words
 */
function existingWords(db, slot, dict, words) {
	const sql = {
		emd: (/** @type {string} */ list) => `SELECT DISTINCT w.word FROM eng_word w JOIN emd_sense s ON s.wrid = w.id WHERE w.word IN (${list})`,
		med: (/** @type {string} */ list) => `SELECT DISTINCT w.word FROM mya_word w JOIN med_sense s ON s.wrid = w.id WHERE w.word IN (${list})`,
	};
	const out = new Set();
	const unique = [...new Set(words)];
	for (let i = 0; i < unique.length; i += CHUNK) {
		const list = unique.slice(i, i + CHUNK).map(sqlValue).join(', ');
		for (const r of db.query(binding(slot), sql[dict](list))) out.add(String(r.word));
	}
	return out;
}

/**
 * The slot both sites read. Publishing and exporting need the sites to agree,
 * so edits are checked against what readers see.
 * @param {Runner} db
 * @param {boolean} allowNone  True for the very first publish.
 * @returns {'a' | 'b' | null}
 */
function liveSlot(db, allowNone) {
	const rel = releases(db);
	const slots = new Set(Object.values(rel).map((r) => r.slot));
	if (!slots.size) {
		if (allowNone) return null;
		throw new Error('No dictionary has been published yet; run make data-publish first');
	}
	if (slots.size > 1 || (rel.production && !rel.beta)) {
		throw new Error(
			`Beta reads slot ${rel.beta?.slot ?? '-'}, production slot ${rel.production?.slot ?? '-'}. ` +
				'Finish the last release first: make data-switch SITE=production (promote) or SITE=beta SLOT=… (roll back)',
		);
	}
	return /** @type {'a' | 'b'} */ ([...slots][0]);
}

// ---------------------------------------------------------------- commands

/**
 * @param {Runner} db
 * @param {string} out
 * @param {boolean} apply
 * @param {(line: string) => void} log
 */
export async function exportEdits(db, out, apply, log) {
	const slot = /** @type {'a' | 'b'} */ (liveSlot(db, false));
	const edits = /** @type {Edit[]} */ (
		/** @type {unknown} */ (db.query('DB', "SELECT id, dict, action, sense_id, field, old_value, new_value, word, data, created_at FROM dict_edits WHERE status = 'approved' ORDER BY created_at, id"))
	);
	if (!edits.length) {
		log('No approved edits to export.');
		return;
	}
	/** @param {'emd' | 'med'} dict */
	const ids = (dict) => edits.filter((e) => e.dict === dict && e.sense_id !== null).map((e) => Number(e.sense_id));
	/** @param {'emd' | 'med'} dict */
	const words = (dict) => edits.filter((e) => e.dict === dict && e.action === 'add').map((e) => e.word);
	const plan = planExport(
		edits,
		{ emd: currentRows(db, slot, 'emd', ids('emd')), med: currentRows(db, slot, 'med', ids('med')) },
		{ emd: existingWords(db, slot, 'emd', words('emd')), med: existingWords(db, slot, 'med', words('med')) },
	);

	for (const [name, f] of Object.entries(plan.files)) log(`${name}: ${f.rows.length} line(s)`);
	for (const c of plan.conflicts) log(`conflict: edit ${c.id}: ${c.reason}`);
	if (!apply) {
		log(`Dry run against slot ${slot} (${db.where}). Add --apply to write the files and mark the edits.`);
		return;
	}

	const counts = Object.fromEntries(Object.entries(plan.files).map(([name, f]) => [name, f.rows.length]));
	const [created] = db.query('DB', `INSERT INTO dict_exports (created_by, counts) VALUES (${sqlValue(operator())}, ${sqlValue(JSON.stringify(counts))}) RETURNING id`);
	const exportId = Number(created.id);
	const dir = resolve(out, `export-${String(exportId).padStart(4, '0')}`);
	await mkdir(dir, { recursive: true });
	for (const [name, f] of Object.entries(plan.files)) await writeFile(join(dir, name), tsv(f.header, f.rows));

	for (let i = 0; i < plan.exported.length; i += CHUNK) {
		db.query('DB', `UPDATE dict_edits SET status = 'exported', export_id = ${exportId} WHERE id IN (${idList(plan.exported.slice(i, i + CHUNK))})`);
	}
	for (const c of plan.conflicts) {
		db.query('DB', `UPDATE dict_edits SET status = 'conflict', review_note = ${sqlValue(c.reason)} WHERE id = ${c.id}`);
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
 * @param {Runner} db
 * @param {string} file
 * @param {boolean} apply
 * @param {(line: string) => void} log
 */
export function publish(db, file, apply, log) {
	if (!existsSync(file)) throw new Error(`${file} not found; build the dataset first (scripts/db_build.py --apply)`);
	const live = liveSlot(db, true);
	const target = live === 'a' ? 'b' : 'a';
	log(`Sites read slot ${live ?? '(none yet)'}; the release goes into slot ${target} (${db.where}).`);
	if (!apply) {
		log('Dry run. Add --apply to import, check, and point beta at it.');
		return;
	}

	log(`Importing ${file} into ${binding(target)} …`);
	db.file(binding(target), file);
	const meta = slotMeta(db, target);
	if (!meta) throw new Error(`Slot ${target} has no meta table after the import`);
	/** @type {Record<string, number>} */
	const counts = {};
	for (const key of Object.keys(meta).filter((k) => k.startsWith('rows.'))) {
		const table = key.slice(5);
		if (!/^\w+$/.test(table)) throw new Error(`Odd table name in meta: ${table}`);
		counts[table] = Number(db.query(binding(target), `SELECT count(*) AS n FROM ${table}`)[0]?.n);
	}
	const problems = verifyBuild(meta, counts);
	if (problems.length) throw new Error(`Slot ${target} failed its checks; beta still reads slot ${live ?? '(none)'}:\n  ${problems.join('\n  ')}`);
	log(`Slot ${target} holds build ${meta.built} (source ${meta.source ?? '?'}); every table matches its count.`);

	db.query(
		'DB',
		`INSERT INTO dict_release (env, slot, source, switched_by) VALUES ('beta', '${target}', ${sqlValue(meta.built)}, ${sqlValue(operator())})
		 ON CONFLICT (env) DO UPDATE SET slot = excluded.slot, source = excluded.source, switched_at = unixepoch(), switched_by = excluded.switched_by`,
	);
	log(`beta now reads slot ${target} (within 30 seconds). Check https://beta.myordbok.com, then: make data-switch SITE=production APPLY=1`);

	markMerged(db, target, meta.built, log);
}

/**
 * Exported edits that the new build contains become merged.
 * @param {Runner} db
 * @param {'a' | 'b'} slot
 * @param {string} built
 * @param {(line: string) => void} log
 */
function markMerged(db, slot, built, log) {
	const edits = /** @type {Array<Edit & { export_id: number }>} */ (
		/** @type {unknown} */ (db.query('DB', "SELECT id, dict, action, sense_id, field, old_value, new_value, word, data, created_at, export_id FROM dict_edits WHERE status = 'exported'"))
	);
	if (!edits.length) return;
	/** @type {number[]} */
	const merged = [];
	for (const dict of /** @type {const} */ (['emd', 'med'])) {
		const mine = edits.filter((e) => e.dict === dict);
		const rows = currentRows(db, slot, dict, mine.filter((e) => e.sense_id !== null).map((e) => Number(e.sense_id)));
		const senseTable = dict === 'emd' ? 'emd_sense' : 'med_sense';
		const wordTable = dict === 'emd' ? 'eng_word' : 'mya_word';
		for (const e of latestOfChains(mine)) {
			let added = false;
			if (e.action === 'add') {
				const sense = JSON.parse(String(e.data)).sense;
				added = db.query(binding(slot), `SELECT 1 FROM ${senseTable} s JOIN ${wordTable} w ON w.id = s.wrid WHERE w.word = ${sqlValue(e.word)} AND s.sense = ${sqlValue(sense)} LIMIT 1`).length > 0;
			}
			if (isMerged(e, rows.get(Number(e.sense_id)), added)) merged.push(...(e.chain ?? [e.id]));
		}
	}
	for (let i = 0; i < merged.length; i += CHUNK) {
		db.query('DB', `UPDATE dict_edits SET status = 'merged' WHERE id IN (${idList(merged.slice(i, i + CHUNK))})`);
	}
	db.query(
		'DB',
		`UPDATE dict_exports SET merged_source = ${sqlValue(built)}, merged_at = unixepoch()
		 WHERE merged_at IS NULL AND id IN (SELECT export_id FROM dict_edits WHERE export_id IS NOT NULL)
		 AND NOT EXISTS (SELECT 1 FROM dict_edits e WHERE e.export_id = dict_exports.id AND e.status = 'exported')`,
	);
	log(`Edits merged by this build: ${merged.length} of ${edits.length} exported. The rest stay exported until a build contains them.`);
}

/**
 * @param {Runner} db
 * @param {'beta' | 'production'} env
 * @param {'a' | 'b' | undefined} slotArg
 * @param {boolean} apply
 * @param {(line: string) => void} log
 */
export function switchSlot(db, env, slotArg, apply, log) {
	const rel = releases(db);
	const slot = slotArg ?? rel.beta?.slot;
	if (!slot) throw new Error('Beta reads no slot yet; give --slot');
	const meta = slotMeta(db, slot);
	if (!meta?.built) throw new Error(`Slot ${slot} holds no dictionary`);
	log(`${env}: slot ${rel[env]?.slot ?? '(none)'} → slot ${slot} (build ${meta.built}, ${db.where}).`);
	if (rel[env]?.slot === slot) {
		log('Nothing to do.');
		return;
	}
	if (!apply) {
		log('Dry run. Add --apply to switch.');
		return;
	}
	db.query(
		'DB',
		`INSERT INTO dict_release (env, slot, source, switched_by) VALUES (${sqlValue(env)}, '${slot}', ${sqlValue(meta.built)}, ${sqlValue(operator())})
		 ON CONFLICT (env) DO UPDATE SET slot = excluded.slot, source = excluded.source, switched_at = unixepoch(), switched_by = excluded.switched_by`,
	);
	log(`${env} now reads slot ${slot} (within 30 seconds).`);
}

/**
 * @param {Runner} db
 * @param {(line: string) => void} log
 */
export function status(db, log) {
	const rel = releases(db);
	for (const slot of SLOTS) {
		const meta = slotMeta(db, slot);
		const readers = ENVS.filter((env) => rel[env]?.slot === slot);
		log(`slot ${slot}: ${meta?.built ? `build ${meta.built}, source ${meta.source ?? '?'}` : 'empty'}${readers.length ? `  ← ${readers.join(', ')}` : ''}`);
	}
	const counts = db.query('DB', 'SELECT status, count(*) AS n FROM dict_edits GROUP BY status ORDER BY status');
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

async function main() {
	const args = process.argv.slice(2);
	const command = args[0];
	const apply = args.includes('--apply');
	const db = wranglerRunner({ local: args.includes('--local') });
	const log = (/** @type {string} */ line) => console.log(line);

	switch (command) {
		case 'status':
			return status(db, log);
		case 'export':
			return exportEdits(db, option(args, '--out') ?? 'exports', apply, log);
		case 'publish': {
			const file = option(args, '--file');
			if (!file) throw new Error('Give --file PATH/build/myordbok.sql');
			return publish(db, resolve(file), apply, log);
		}
		case 'switch': {
			const env = option(args, '--env');
			if (env !== 'beta' && env !== 'production') throw new Error('Give --env beta or --env production');
			const slot = option(args, '--slot');
			if (slot !== undefined && slot !== 'a' && slot !== 'b') throw new Error('--slot is a or b');
			return switchSlot(db, env, slot, apply, log);
		}
		default:
			throw new Error('Commands: status, export, publish, switch (see the top of scripts/data.js)');
	}
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	main().catch((err) => {
		console.error(`data: ${err.message}`);
		process.exit(1);
	});
}
