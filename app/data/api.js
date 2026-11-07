// @ts-check
/**
 * Dictionary data for the reader. Online for now; offline packs plug in here
 * so views never need to know where data came from.
 */
import { getJSON } from '#platform/http.js';

/**
 * @param {string} q
 * @returns {Promise<import('#shared/types.js').SearchResult>}
 */
export function search(q) {
	return getJSON(`/api/search?q=${encodeURIComponent(q)}`);
}

/**
 * @param {import('#shared/validate.js').Lang} lang
 * @param {string} word
 * @returns {Promise<import('#shared/types.js').Entry>}
 */
export function entry(lang, word) {
	return getJSON(`/api/entry/${lang}/${encodeURIComponent(word)}`);
}
