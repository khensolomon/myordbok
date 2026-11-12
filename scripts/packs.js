// @ts-check
/**
 * Offline packs: a dictionary build turned into files the app downloads once
 * and keeps on the device, so reading needs neither the network nor D1.
 * Node standard library only; R2 is reached through wrangler. Dry run
 * unless --apply.
 *
 * Each word's answer is worked out here with the same lookup the Worker runs
 * (shared/search), so an offline answer equals the online one for a single
 * word. Phrases and sentences need the server.
 *
 *   words-en     English headwords with senses, one per line     everyone
 *   words-my     Myanmar headwords with senses                   everyone
 *   senses-en    each English word's senses, forms, variants     members, or everyone (workspace setting)
 *   senses-my    each Myanmar word's senses and pronunciation    members, or everyone
 *   related-en   each English word's synonyms and related words  members, or everyone
 *
 * The senses and related packs are lines of JSON, [key, answer], the key in
 * lower case; every file is gzip. A manifest lists them with sizes, rows and
 * SHA-256. Files live in R2 under the build they come from:
 *
 *   myordbok/offline/<build key>/manifest.json, …/<pack>.<ext>.gz   (shared/packs.js packKey)
 *
 * so beta and production each find the packs of the build they read, and a
 * promotion needs no new upload.
 *
 *   node scripts/packs.js --file BUILD.db|BUILD.sql [--out DIR] [--apply] [--local]
 *
 * Without --apply the packs are built into DIR (default: packs/<built>/ next
 * to the build file, never inside this repository) and reported; --apply
 * also uploads them. --local uploads to the local R2 of `wrangler dev`.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { search, sqliteDatabase } from '../shared/search/search.mjs';
import statements from '../shared/search/statements.js';
import { buildKey, packKey, OPEN_KINDS } from '../shared/packs.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const BUCKET = 'myordbok';

/**
 * @typedef {object} Pack
 * @property {string} id
 * @property {'words' | 'senses' | 'related'} kind
 * @property {'en' | 'my'} lang
 * @property {string} file
 * @property {number} rows
 * @property {number} bytes  Size of the gzip file.
 * @property {string} sha256
 */

/**
 * Opens a build: a SQLite file, or the SQL script D1 imports (run into memory).
 * @param {string} file
 */
export function openBuild(file) {
	if (!existsSync(file)) throw new Error(`No build at ${file}`);
	if (file.endsWith('.db')) return new DatabaseSync(file, { readOnly: true });
	if (!file.endsWith('.sql')) throw new Error(`${file}: expected a .db or .sql build`);
	const db = new DatabaseSync(':memory:');
	db.exec(readFileSync(file, 'utf8'));
	return db;
}

/**
 * Every pack of a build, as file contents.
 * @param {DatabaseSync} db
 * @returns {Promise<{ built: string, files: Array<{ pack: Omit<Pack, 'bytes' | 'sha256'>, data: Buffer }> }>}
 */
export async function buildPacks(db) {
	const built = /** @type {{ value?: string } | undefined} */ (db.prepare("SELECT value FROM meta WHERE key = 'built'").get())?.value;
	if (!built) throw new Error('The build has no meta row "built"; is it a dataset build?');
	const lookup = sqliteDatabase(db);

	// Headwords with senses, as the search box offers them (worker/routes/suggest.js).
	const wordsEn = db
		.prepare('SELECT min(w.word) AS word FROM eng_word w WHERE EXISTS (SELECT 1 FROM emd_sense s WHERE s.wrid = w.id) GROUP BY w.word COLLATE NOCASE ORDER BY w.word COLLATE NOCASE')
		.all()
		.map((r) => String(r.word));
	const wordsMy = db
		.prepare('SELECT w.word FROM mya_word w WHERE EXISTS (SELECT 1 FROM med_sense s WHERE s.wrid = w.id) ORDER BY w.word')
		.all()
		.map((r) => String(r.word));

	// Every English text a lookup answers: headwords, forms of them (went), spelling variants (colour).
	const keysEn = new Set(wordsEn.map((w) => w.toLowerCase()));
	for (const r of db.prepare('SELECT DISTINCT lower(e.word) AS k FROM eng_form f JOIN eng_word e ON e.id = f.form WHERE f.root != f.form').all()) keysEn.add(String(r.k));
	const hasVariants = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'eng_variant'").get();
	if (hasVariants) for (const r of db.prepare('SELECT DISTINCT lower(variant) AS k FROM eng_variant').all()) keysEn.add(String(r.k));

	/** @type {string[]} */
	const sensesEn = [];
	/** @type {string[]} */
	const relatedEn = [];
	for (const key of [...keysEn].sort()) {
		const r = /** @type {any} */ (await search(lookup, statements, key));
		if (!r.entries.length && !r.forms_of.length && !r.variant_of.length) continue;
		sensesEn.push(JSON.stringify([key, { entries: r.entries, variant_of: r.variant_of, forms_of: r.forms_of, root_senses: r.root_senses, forms: r.forms }]));
		const rel = { synonyms: r.synonyms, similar: r.similar, broader: r.broader, opposite: r.opposite, related: r.related };
		if (Object.values(rel).some((list) => list.length)) relatedEn.push(JSON.stringify([key, rel]));
	}
	/** @type {string[]} */
	const sensesMy = [];
	for (const word of wordsMy) {
		const r = /** @type {any} */ (await search(lookup, statements, word));
		if (r.entries.length) sensesMy.push(JSON.stringify([word, { pronunciation: r.pronunciation, entries: r.entries }]));
	}

	/** @param {string} id @param {Pack['kind']} kind @param {Pack['lang']} lang @param {string} ext @param {string[]} lines */
	const file = (id, kind, lang, ext, lines) => ({ pack: { id, kind, lang, file: `${id}.${ext}.gz`, rows: lines.length }, data: gzipSync(Buffer.from(lines.join('\n') + '\n', 'utf8'), { level: 9 }) });
	return {
		built,
		files: [
			file('words-en', 'words', 'en', 'txt', wordsEn),
			file('words-my', 'words', 'my', 'txt', wordsMy),
			file('senses-en', 'senses', 'en', 'jsonl', sensesEn),
			file('senses-my', 'senses', 'my', 'jsonl', sensesMy),
			file('related-en', 'related', 'en', 'jsonl', relatedEn),
		],
	};
}

/**
 * The manifest for built files.
 * @param {string} built
 * @param {Array<{ pack: Omit<Pack, 'bytes' | 'sha256'>, data: Buffer }>} files
 */
export function manifestOf(built, files) {
	return {
		build: built,
		created: new Date().toISOString(),
		packs: files.map(({ pack, data }) => ({ ...pack, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') })),
	};
}

/** @param {number} n */
const size = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);

/** @param {string[]} argv */
async function main(argv) {
	const arg = (/** @type {string} */ name) => {
		const i = argv.indexOf(name);
		if (i < 0) return null;
		const v = argv[i + 1];
		if (!v || v.startsWith('--')) throw new Error(`${name} needs a value`);
		return v;
	};
	const file = arg('--file');
	if (!file) throw new Error('Usage: node scripts/packs.js --file BUILD.db|BUILD.sql [--out DIR] [--apply] [--local]');
	await makePacks(file, { out: arg('--out'), apply: argv.includes('--apply'), local: argv.includes('--local') });
}

/**
 * Builds a build's packs next to the file and, with apply, uploads them to
 * R2, the manifest last. Also run by `scripts/data.js beta`.
 * @param {string} file
 * @param {{ out?: string | null, apply?: boolean, local?: boolean, log?: (line: string) => void }} [options]
 * @returns {Promise<string>} The build.
 */
export async function makePacks(file, options = {}) {
	const { apply = false, local = false } = options;
	const say = options.log ?? ((/** @type {string} */ line) => console.log(line));

	const started = Date.now();
	const db = openBuild(resolve(file));
	const { built, files } = await buildPacks(db);
	const key = buildKey(built);
	const out = resolve(options.out ?? join(dirname(resolve(file)), 'packs', key));
	if (!relative(ROOT, out).startsWith('..')) throw new Error(`${out} is inside the repository; dictionary data never goes there. Choose --out outside it.`);
	mkdirSync(out, { recursive: true });
	const manifest = manifestOf(built, files);
	for (const { pack, data } of files) writeFileSync(join(out, pack.file), data);
	writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, '\t'));

	say(`Build ${built}: packs in ${out} (${((Date.now() - started) / 1000).toFixed(0)} s)`);
	for (const p of manifest.packs) say(`  ${p.id.padEnd(11)} ${String(p.rows).padStart(7)} rows  ${size(p.bytes).padStart(8)}  ${OPEN_KINDS.includes(p.kind) ? 'everyone' : 'by the access setting'}`);
	say(`  total ${size(manifest.packs.reduce((a, p) => a + p.bytes, 0))}`);

	if (!apply) {
		say(`Dry run: nothing uploaded. Add --apply to upload to R2 ${BUCKET}/${packKey(built, '')}${local ? ' (local)' : ''}.`);
		return built;
	}
	const where = local ? '--local' : '--remote';
	// The manifest goes last: a site sees a build's packs only once all its files are there.
	for (const name of [...manifest.packs.map((p) => p.file), 'manifest.json']) {
		const type = name.endsWith('.json') ? 'application/json' : 'application/gzip';
		try {
			execFileSync('npx', ['wrangler', 'r2', 'object', 'put', `${BUCKET}/${packKey(built, name)}`, '--file', join(out, name), '--content-type', type, where], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
		} catch (err) {
			const text = String(/** @type {any} */ (err).stderr ?? err);
			const hint = /bucket.*(not exist|not found)/i.test(text) ? ` Create it once: npx wrangler r2 bucket create ${BUCKET}` : '';
			throw new Error(`Uploading ${name} failed.${hint}\n${text.trim()}`);
		}
		say(`  uploaded ${packKey(built, name)}`);
	}
	say(`Packs of build ${built} are in R2 ${BUCKET}${local ? ' (local)' : ''}. Sites reading this build offer them now.`);
	return built;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	main(process.argv.slice(2)).catch((err) => {
		console.error(err instanceof Error ? err.message : err);
		process.exit(1);
	});
}
