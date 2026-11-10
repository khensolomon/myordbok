// @ts-check
/**
 * Statistics of a dictionary build, worked out once on this machine from the
 * build file and kept in myordbok-app (table build_stats), so the workspace
 * shows them with one row read instead of counting every row of D1 on each
 * visit. `make data-publish` writes them for the build it publishes;
 * `make data-stats` writes them for any build file. Node standard library.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { openBuild } from './packs.js';

/** Sense kinds that are a review state, not a label (type_sense names). */
const DRAFT = 'Draft';
const ACTIVE = 'Active';
const AWAITING = /awaiting/i;

/**
 * @typedef {object} SideStats
 * @property {number} headwords  Words with at least one sense.
 * @property {number} senses
 * @property {number} examples   Senses with an example.
 * @property {number} awaiting   Senses checked, awaiting a native speaker's review.
 * @property {number} drafts
 * @property {Record<string, number>} pos     Senses by part of speech.
 * @property {Record<string, number>} labels  Senses by label (idiom, slang, glossaries …), the largest first.
 */

/**
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function buildStats(db) {
	const one = (/** @type {string} */ sql) => Number(Object.values(/** @type {object} */ (db.prepare(sql).get()))[0]);
	const meta = Object.fromEntries(db.prepare('SELECT key, value FROM meta').all().map((r) => [String(r.key), String(r.value)]));
	if (!meta.built) throw new Error('The build has no meta row "built"; is it a dataset build?');
	const kinds = new Map(db.prepare('SELECT id, name FROM type_sense').all().map((r) => [Number(r.id), String(r.name)]));
	const posNames = new Map(db.prepare('SELECT id, name FROM type_word').all().map((r) => [Number(r.id), String(r.name)]));

	/**
	 * @param {'emd_sense' | 'med_sense'} senses
	 * @returns {SideStats}
	 */
	const side = (senses) => {
		/** @type {Record<string, number>} */
		const pos = {};
		for (const r of db.prepare(`SELECT wrte, count(*) AS n FROM ${senses} GROUP BY wrte ORDER BY n DESC`).all()) pos[posNames.get(Number(r.wrte)) ?? `type ${r.wrte}`] = Number(r.n);
		/** @type {Record<string, number>} */
		const labels = {};
		let awaiting = 0;
		let drafts = 0;
		for (const r of db.prepare(`SELECT wrkd, count(*) AS n FROM ${senses} GROUP BY wrkd ORDER BY n DESC`).all()) {
			const name = kinds.get(Number(r.wrkd)) ?? `kind ${r.wrkd}`;
			if (name === DRAFT) drafts += Number(r.n);
			else if (AWAITING.test(name)) awaiting += Number(r.n);
			else if (name !== ACTIVE) labels[name] = Number(r.n);
		}
		return {
			headwords: one(`SELECT count(DISTINCT wrid) FROM ${senses}`),
			senses: one(`SELECT count(*) FROM ${senses}`),
			examples: one(`SELECT count(*) FROM ${senses} WHERE exam IS NOT NULL AND trim(exam) != ''`),
			awaiting,
			drafts,
			pos,
			labels,
		};
	};
	const has = (/** @type {string} */ table) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));

	return {
		build: meta.built,
		source: meta.source ?? null,
		en: {
			...side('emd_sense'),
			words: one('SELECT count(*) FROM eng_word'),
			forms: one('SELECT count(*) FROM eng_form WHERE form != root'),
			variants: has('eng_variant') ? one('SELECT count(*) FROM eng_variant') : 0,
			synsets: one('SELECT count(DISTINCT synset) FROM wn_member'),
			links: one('SELECT count(*) FROM wn_link'),
			related: one('SELECT count(*) FROM eng_related'),
		},
		my: {
			...side('med_sense'),
			words: one('SELECT count(*) FROM mya_word'),
			pronunciations: one("SELECT count(*) FROM mya_word WHERE ipa IS NOT NULL AND ipa != ''"),
			thesaurus: one('SELECT count(*) FROM med_thesaurus'),
		},
	};
}

/**
 * The statistics of a build file. For a .sql build, the .db built beside it
 * is read instead when it holds the same build (much faster to open).
 * @param {string} file
 */
export function statsOfFile(file) {
	if (file.endsWith('.sql')) {
		const db = join(dirname(file), 'myordbok.db');
		const built = /\('built',\s*'([^']+)'\)/.exec(readFileSync(file, 'utf8'))?.[1];
		if (existsSync(db) && built) {
			const stats = buildStats(openBuild(db));
			if (stats.build === built) return stats;
		}
	}
	return buildStats(openBuild(file));
}

/**
 * The statement that keeps them, for wrangler d1 execute --file.
 * @param {ReturnType<typeof buildStats>} stats
 */
export function statsSql(stats) {
	const quote = (/** @type {string} */ s) => `'${s.replaceAll("'", "''")}'`;
	return `INSERT INTO build_stats (build, stats) VALUES (${quote(stats.build)}, ${quote(JSON.stringify(stats))})
ON CONFLICT (build) DO UPDATE SET stats = excluded.stats;\n`;
}
