// @ts-check
/**
 * GET /api/search?q=lov
 * Headwords that start with the query, in the dictionary the query's script
 * points to (Myanmar characters → MY→EN, otherwise EN→MY).
 */
import { detectLang, wordKey } from '../../shared/validate.js';
import { json } from '../lib/http.js';

export const SEARCH_LIMIT = 20;

/** @type {Record<import('../../shared/validate.js').Lang, string>} */
const WORD_TABLE = { en: 'eng_word', my: 'mya_word' };

/**
 * @param {URL} url
 * @param {{ DB: D1Database }} env
 */
export async function search(url, env) {
	const key = wordKey(url.searchParams.get('q') ?? '');
	const lang = detectLang(key);
	// A key range instead of LIKE so the index on `key` is used.
	const { results } = await env.DB.prepare(
		`SELECT word FROM ${WORD_TABLE[lang]} WHERE key >= ?1 AND key < ?2 ORDER BY key LIMIT ?3`,
	)
		.bind(key, `${key}￿`, SEARCH_LIMIT)
		.all();

	/** @type {import('../../shared/types.js').SearchResult} */
	const body = { q: key, lang, words: results.map((r) => String(r.word)) };
	return json(body, { cache: 300 });
}
