// @ts-check
/**
 * Dictionary data for the reader. Online for now; offline packs plug in here
 * so views never need to know where data came from.
 *
 * Lookups are kept for the session (the last LOOKUPS_KEPT), so going back
 * and forth between the words of a sentence fetches each word once.
 */
import { getJSON, postJSON } from '#platform/http.js';

const LOOKUPS_KEPT = 50;
/** @type {Map<string, Promise<any>>} */
const lookups = new Map();
/** @type {Map<string, Promise<any>>} */
const readings = new Map();

/**
 * A request kept for the session: the same URL is asked once, and a failed
 * one is asked again next time. The most recently used are kept.
 * @param {Map<string, Promise<any>>} store
 * @param {string} url
 */
function kept(store, url) {
	const hit = store.get(url);
	if (hit) {
		store.delete(url);
		store.set(url, hit);
		return hit;
	}
	const pending = getJSON(url);
	store.set(url, pending);
	pending.catch(() => store.delete(url));
	if (store.size > LOOKUPS_KEPT) store.delete(/** @type {string} */ (store.keys().next().value));
	return pending;
}

/**
 * What a query is (entry, phrase, sentence or nothing), in one request.
 * @param {string} q
 * @returns {Promise<import('#shared/types.js').Reading>}
 */
export function read(q) {
	return kept(readings, `/api/read?q=${encodeURIComponent(q)}`);
}

/**
 * Keeps a lookup that arrived with something else, so it is not fetched again.
 * @param {string} q
 * @param {import('#shared/types.js').LookupResult} result
 */
export function remember(q, result) {
	lookups.set(`/api/lookup?q=${encodeURIComponent(q)}`, Promise.resolve(result));
}

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
	return kept(lookups, `/api/lookup?q=${encodeURIComponent(q)}`);
}

/** True when the reader has asked to save data (Save-Data, Data Saver). */
export function savingData() {
	const connection = /** @type {{ connection?: { saveData?: boolean } }} */ (navigator).connection;
	return connection?.saveData === true;
}

/**
 * @typedef {{ likes: number, dislikes: number, mine: -1 | 0 | 1 }} Counts
 * @typedef {{ lang: 'en' | 'my', word: string, likes: number, dislikes: number, mine: -1 | 0 | 1, senses: Record<string, Counts>, signedIn: boolean }} Reactions
 *   senses: counts per sense id, for the meaning each has now.
 */

/**
 * Likes and dislikes of an entry, and the member's own. Never kept: it
 * changes as members react.
 * @param {'en' | 'my'} lang
 * @param {string} word
 * @returns {Promise<Reactions>}
 */
export function reactions(lang, word) {
	return getJSON(`/api/reactions?${new URLSearchParams({ lang, word })}`);
}

/**
 * @param {'en' | 'my'} lang
 * @param {string} word
 * @param {-1 | 0 | 1} value  0 takes the reaction back.
 * @param {number} [senseId]  One sense of the entry instead of the entry.
 * @returns {Promise<Reactions>}
 */
export function react(lang, word, value, senseId) {
	return postJSON('/api/reactions', senseId === undefined ? { lang, word, value } : { lang, word, value, sense_id: senseId });
}

/**
 * @typedef {object} EditableSense
 * @property {number} id
 * @property {string} word
 * @property {number} wrte
 * @property {string} type
 * @property {string} sense
 * @property {string | null} exam
 */

/**
 * @typedef {object} OwnEdit
 * @property {number} id
 * @property {'edit' | 'delete' | 'add'} action
 * @property {number | null} sense_id
 * @property {string | null} field
 * @property {string | null} old_value
 * @property {string | null} new_value
 * @property {string | null} data
 * @property {string} status
 * @property {string | null} review_note
 */

/**
 * The senses of a headword with their ids, to suggest changes against
 * (signed in only).
 * @param {'en' | 'my'} lang
 * @param {string} word
 * @returns {Promise<{ senses: EditableSense[], types: Array<{ id: number, name: string }>, mine: OwnEdit[], role: string }>}
 */
export function editableSenses(lang, word) {
	return getJSON(`/api/senses?${new URLSearchParams({ lang, word })}`);
}

/**
 * @param {Record<string, unknown>} suggestion  See worker/routes/contribute.js.
 * @returns {Promise<{ edit: { id: number, status: string } }>}
 */
export function suggestEdit(suggestion) {
	return postJSON('/api/edits', suggestion);
}

// ---------------------------------------------------------------- workspace

/**
 * @typedef {object} WorkspaceEdit
 * @property {number} id
 * @property {'emd' | 'med'} dict
 * @property {'edit' | 'delete' | 'add'} action
 * @property {number | null} sense_id
 * @property {string | null} field
 * @property {string | null} old_value
 * @property {string | null} new_value
 * @property {string} word
 * @property {{ wrte: number, sense: string, exam: string | null } | null} data
 * @property {string} status
 * @property {string | null} note
 * @property {string | null} review_note
 * @property {number} created_at
 * @property {number | null} reviewed_at
 * @property {string} author
 * @property {string | null} reviewer
 * @property {boolean} own
 * @property {{ word: string, type: string, sense: string | null, exam: string | null } | null} current
 */

/** @returns {Promise<{ role: string, mine: Record<string, number>, waiting: number | null }>} */
export function workspaceSummary() {
	return getJSON('/api/workspace/summary');
}

/**
 * @param {{ status?: string, mine?: boolean, before?: number }} options
 * @returns {Promise<{ edits: WorkspaceEdit[], more: boolean, role: string }>}
 */
export function workspaceEdits(options) {
	const q = new URLSearchParams({ status: options.status ?? 'pending' });
	if (options.mine) q.set('mine', '1');
	if (options.before) q.set('before', String(options.before));
	return getJSON(`/api/workspace/edits?${q}`);
}

/**
 * @param {number} id
 * @param {'approve' | 'reject'} decision
 * @param {string} note
 */
export function reviewEdit(id, decision, note) {
	return postJSON(`/api/workspace/edits/${id}/review`, { decision, note });
}

/** @param {number} id */
export function withdrawEdit(id) {
	return postJSON(`/api/workspace/edits/${id}/withdraw`);
}
