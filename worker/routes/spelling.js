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
import { dictionary, explainDictError } from '../lib/dict.js';
import { json } from '../lib/http.js';

export const SPELLING_LIMIT = 6;
const MAX_LENGTH = 24;
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

const SQL = `SELECT min(w.word) AS word, count(s.wrid) AS senses
	FROM json_each(?1) j
	JOIN eng_word w ON w.word = j.value COLLATE NOCASE
	JOIN emd_sense s ON s.wrid = w.id
	GROUP BY w.word COLLATE NOCASE
	ORDER BY senses DESC, word COLLATE NOCASE
	LIMIT ?2`;

/**
 * Every string one edit away from `word` (Norvig's edits1), without `word`.
 * @param {string} word  Lower case.
 */
export function edits1(word) {
	/** @type {Set<string>} */
	const out = new Set();
	for (let i = 0; i <= word.length; i++) {
		const [a, b] = [word.slice(0, i), word.slice(i)];
		if (b) out.add(a + b.slice(1));
		if (b.length > 1) out.add(a + b[1] + b[0] + b.slice(2));
		for (const c of LETTERS) {
			if (b) out.add(a + c + b.slice(1));
			out.add(a + c + b);
		}
	}
	out.delete(word);
	out.delete('');
	return [...out];
}

/**
 * @param {URL} url
 * @param {import('../lib/dict.js').DictEnv} env
 */
export async function spelling(url, env) {
	const q = normalizeQuery(url.searchParams.get('q') ?? '');
	const word = q.toLowerCase();
	if (detectLang(q) !== 'en' || word.length > MAX_LENGTH || !/^[a-z' -]+$/.test(word)) return json({ q, words: [] }, { cache: 3600 });
	const { dict, db } = await dictionary(env);
	const { results } = await db
		.prepare(SQL)
		.bind(JSON.stringify(edits1(word)), SPELLING_LIMIT)
		.all()
		.catch((err) => {
			throw explainDictError(err, dict, env);
		});
	return json({ q, words: results.map((r) => String(r.word)) }, { cache: 3600 });
}
