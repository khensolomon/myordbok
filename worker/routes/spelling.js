// @ts-check
/**
 * GET /api/spelling?q=lvoe
 * "Did you mean": English headwords one edit away from the query (a letter
 * left out, added, changed, or two swapped), with senses, the most used
 * first. The candidates are made here and checked in one query against the
 * word index. Myanmar and long queries get none: their candidate lists would
 * be too large to be of use.
 */
import { detectLang, normalizeQuery } from '../../shared/validate.js';
import { edits1, spellable } from '../../shared/query/spelling.js';
import { dictionary, explainDictError } from '../lib/dict.js';
import { json } from '../lib/http.js';

export const SPELLING_LIMIT = 6;

const SQL = `SELECT min(w.word) AS word, count(s.wrid) AS senses
	FROM json_each(?1) j
	JOIN eng_word w ON w.word = j.value COLLATE NOCASE
	JOIN emd_sense s ON s.wrid = w.id
	GROUP BY w.word COLLATE NOCASE
	ORDER BY senses DESC, word COLLATE NOCASE
	LIMIT ?2`;

/**
 * Headwords one edit away from `q`, the most used first; none for text that
 * is not a short English word or phrase.
 * @param {D1Database} db
 * @param {string} q
 * @param {number} [limit]
 * @returns {Promise<string[]>}
 */
export async function closeWords(db, q, limit = SPELLING_LIMIT) {
	const word = q.toLowerCase();
	if (detectLang(q) !== 'en' || !spellable(word)) return [];
	const { results } = await db.prepare(SQL).bind(JSON.stringify(edits1(word)), limit).all();
	return results.map((r) => String(r.word));
}

/**
 * @param {URL} url
 * @param {import('../lib/dict.js').DictEnv} env
 */
export async function spelling(url, env) {
	const q = normalizeQuery(url.searchParams.get('q') ?? '');
	const { dict, db } = await dictionary(env);
	const words = await closeWords(db, q).catch((err) => {
		throw explainDictError(err, dict, env);
	});
	return json({ q, words }, { cache: 3600 });
}
