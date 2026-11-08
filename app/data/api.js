// @ts-check
/**
 * Dictionary data for the reader. Online for now; offline packs plug in here
 * so views never need to know where data came from.
 *
 * Lookups are kept for the session (the last LOOKUPS_KEPT), so going back
 * and forth between the words of a sentence fetches each word once.
 */
import { getJSON } from '#platform/http.js';

const LOOKUPS_KEPT = 50;
/** @type {Map<string, Promise<import('#shared/types.js').LookupResult>>} */
const lookups = new Map();

/**
 * Headwords starting with `q`, for the search box.
 * @param {string} q
 * @returns {Promise<import('#shared/types.js').Suggestions>}
 */
export function suggest(q) {
	return getJSON(`/api/suggest?q=${encodeURIComponent(q)}`);
}

/**
 * "Did you mean": headwords one edit away from `q`.
 * @param {string} q
 * @returns {Promise<import('#shared/types.js').Spelling>}
 */
export function spelling(q) {
	return getJSON(`/api/spelling?q=${encodeURIComponent(q)}`);
}

/**
 * Everything the dictionary knows about `q`.
 * @param {string} q
 * @returns {Promise<import('#shared/types.js').LookupResult>}
 */
export function lookup(q) {
	const kept = lookups.get(q);
	if (kept) {
		// Most recently used last, so the oldest is the one dropped.
		lookups.delete(q);
		lookups.set(q, kept);
		return kept;
	}
	const pending = getJSON(`/api/lookup?q=${encodeURIComponent(q)}`);
	lookups.set(q, pending);
	// A failed lookup is not kept: the next try asks again.
	pending.catch(() => lookups.delete(q));
	if (lookups.size > LOOKUPS_KEPT) lookups.delete(/** @type {string} */ (lookups.keys().next().value));
	return /** @type {Promise<import('#shared/types.js').LookupResult>} */ (pending);
}

/** True when the reader has asked to save data (Save-Data, Data Saver). */
export function savingData() {
	const connection = /** @type {{ connection?: { saveData?: boolean } }} */ (navigator).connection;
	return connection?.saveData === true;
}
