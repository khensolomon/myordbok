// @ts-check
/**
 * GET /api/suggest?q=lov
 * Headwords that start with the query and have senses, for the search box.
 * Myanmar characters search MY→EN headwords, anything else EN→MY.
 * A range instead of LIKE, so the word index is used and the scan stops at
 * the limit.
 */
import { detectLang, normalizeQuery } from '../../shared/validate.js';
import { dictionary, explainDictError } from '../lib/dict.js';
import { json } from '../lib/http.js';

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
	// \uffff sorts after every character, so the range holds exactly the words starting with q.
	const { results } = await db
		.prepare(SQL[lang])
		.bind(q, `${q}\uffff`, SUGGEST_LIMIT)
		.all()
		.catch((err) => {
			throw explainDictError(err, dict, env);
		});
	/** @type {import('../../shared/types.js').Suggestions} */
	const body = { q, lang, words: results.map((r) => String(r.word)) };
	return json(body, { cache: 300 });
}
