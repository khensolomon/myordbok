// @ts-check
/**
 * Dictionary data for the reader. Online for now; offline packs plug in here
 * so views never need to know where data came from.
 */
import { getJSON } from '#platform/http.js';

/**
 * Headwords starting with `q`, for the search box.
 * @param {string} q
 * @returns {Promise<import('#shared/types.js').Suggestions>}
 */
export function suggest(q) {
	return getJSON(`/api/suggest?q=${encodeURIComponent(q)}`);
}

/**
 * Everything the dictionary knows about `q`.
 * @param {string} q
 * @returns {Promise<import('#shared/types.js').LookupResult>}
 */
export function lookup(q) {
	return getJSON(`/api/lookup?q=${encodeURIComponent(q)}`);
}
