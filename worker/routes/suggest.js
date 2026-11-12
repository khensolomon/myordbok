// @ts-check
/**
 * GET /api/suggest?q=lov
 * Headwords that start with the query and have senses, for the search box.
 * Myanmar characters search MY→EN headwords, anything else EN→MY.
 * A range instead of LIKE, so the word index is used and the scan stops at
 * the limit. Myanmar that starts no headword and is surely Zawgyi is tried
 * again in Unicode.
 */
import { detectLang, normalizeQuery } from '../../shared/validate.js';
import { dictionary, explainDictError } from '../lib/dict.js';
import { json } from '../lib/http.js';
import { unicodeIfZawgyi } from '../../shared/zawgyi/index.js';

export const SUGGEST_LIMIT = 10;

const SQL = {
	en: `SELECT min(w.word) AS word FROM eng_word w
		WHERE w.word >= ?1 COLLATE NOCASE AND w.word < ?2 COLLATE NOCASE
		AND EXISTS (SELECT 1 FROM emd_sense s WHERE s.wrid = w.id)
		GROUP BY w.word COLLATE NOCASE ORDER BY w.word COLLATE NOCASE LIMIT ?3`,
	my: `SELECT w.word FROM mya_word w
		WHERE w.word >= ?1 AND w.word < ?2
		AND EXISTS (SELECT 1 FROM med_sense s WHERE s.wrid = w.id)
		ORDER BY w.word LIMIT ?3`,
};

/**
 * @param {URL} url
 * @param {import('../lib/dict.js').DictEnv} env
 */
export async function suggest(url, env) {
	const q = normalizeQuery(url.searchParams.get('q') ?? '');
	const lang = detectLang(q);
	const { dict, db } = await dictionary(env);
	const start = async () => {
		const words = await startingWith(db, q);
		const as = lang === 'my' && !words.length ? unicodeIfZawgyi(q) : null;
		return as ? startingWith(db, as) : words;
	};
	const words = await start().catch((err) => {
		throw explainDictError(err, dict, env);
	});
	/** @type {import('../../shared/types.js').Suggestions} */
	const body = { q, lang, words };
	return json(body, { cache: 300 });
}

/**
 * Headwords with senses that start with `q`, in either script.
 * @param {D1Database} db
 * @param {string} q  Normalised.
 * @param {number} [limit]
 * @returns {Promise<string[]>}
 */
export async function startingWith(db, q, limit = SUGGEST_LIMIT) {
	// \uffff sorts after every character, so the range holds exactly the words starting with q.
	const { results } = await db.prepare(SQL[detectLang(q)]).bind(q, `${q}\uffff`, limit).all();
	return results.map((r) => String(r.word));
}
