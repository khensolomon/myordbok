// @ts-check
/**
 * Dictionary data for the reader. Online first; when the network is not
 * there, one word's answer and the search box's suggestions come from the
 * offline copy on this device (offline.js), marked offline: true, and
 * anything that copy lacks fails as it would have.
 *
 * Lookups are kept for the session (the last LOOKUPS_KEPT), so going back
 * and forth between the words of a sentence fetches each word once.
 */
import { getJSON, postJSON } from '#platform/http.js';
import { AppError } from '#shared/errors.js';
import { lookupOffline, suggestOffline } from './offline.js';

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
	return kept(readings, `/api/read?q=${encodeURIComponent(q)}`).catch((err) =>
		offlineOr(err, async () => {
			const result = await lookupOffline(q);
			return result ? { q, kind: 'entry', result } : null;
		}),
	);
}

/**
 * When the network failed, the answer from this device; otherwise, or when
 * the device has none, the error itself.
 * @template T
 * @param {unknown} err
 * @param {() => Promise<T | null>} fromDevice
 * @returns {Promise<T>}
 */
async function offlineOr(err, fromDevice) {
	if (!(err instanceof AppError && err.code === 'unavailable')) throw err;
	const answer = await fromDevice().catch(() => null);
	if (answer === null) throw err;
	return answer;
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
	return getJSON(`/api/suggest?q=${encodeURIComponent(q)}`).catch((err) =>
		offlineOr(err, async () => {
			const words = await suggestOffline(q);
			return words ? { q, lang: /[\u1000-\u109f]/.test(q) ? 'my' : 'en', words } : null;
		}),
	);
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
	return kept(lookups, `/api/lookup?q=${encodeURIComponent(q)}`).catch((err) => offlineOr(err, () => lookupOffline(q)));
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
 * @property {string | null} [source]  The dictionary build it was made against.
 * @property {boolean} own
 * @property {{ word: string, type: string, sense: string | null, exam: string | null } | null} current
 */

/** @returns {Promise<{ role: string, mine: Record<string, number>, waiting: number | null, unread?: number }>} */
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

/**
 * @typedef {object} SideStats
 * @property {number} headwords
 * @property {number} senses
 * @property {number} examples
 * @property {number} awaiting
 * @property {number} drafts
 * @property {Record<string, number>} pos
 * @property {Record<string, number>} labels
 */

/**
 * A build's statistics (scripts/stats.js).
 * @typedef {object} DictStats
 * @property {string} build
 * @property {string | null} source
 * @property {SideStats & { words: number, forms: number, variants: number, synsets: number, links: number, related: number }} en
 * @property {SideStats & { words: number, pronunciations: number, thesaurus: number }} my
 */

/**
 * @typedef {object} Overview
 * @property {string} role
 * @property {{ suggestions: Record<string, number>, ratings: number, rated: { entries: number, senses: number } }} own
 * @property {number} days
 * @property {{ build: string | null, stats: DictStats | null, previous: DictStats | null }} dictionary
 * @property {{ today: number, week: number, month: number, daily: Array<{ day: string, hits: number, missed: number }>, top: Array<{ lang: string, term: string, hits: number }>, wanted: Array<{ lang: string, term: string, hits: number }> }} searches
 * @property {{ members: number, accepted: number, merged: number, ratings: number }} community
 * @property {Record<string, number>} [suggestions]  Editors and admins.
 * @property {{ roles: Record<string, number>, joinedWeek: number }} [members]  Editors and admins.
 * @property {Array<{ dict: string, sense_id: number, word: string, type: string, sense: string, down: number, up: number }>} [disliked]  Editors and admins.
 * @property {number} [unread]  New messages in the Inbox; admins only.
 */

/** @returns {Promise<Overview>} The home board; editors and admins get the site's figures. */
export function workspaceOverview() {
	return getJSON('/api/workspace/overview');
}

/**
 * Deletes the signed-in account.
 * @param {string} confirm  The account's email, or DELETE when it has none.
 */
export function deleteAccount(confirm) {
	return postJSON('/api/workspace/account/delete', { confirm });
}

/**
 * A message through the contact form.
 * @param {{ kind: 'feedback' | 'question' | 'problem' | 'word', body: string, reply_to?: string, page?: string, lang: string, website?: string }} message
 */
export function sendMessage(message) {
	return postJSON('/api/messages', message);
}

/** @typedef {'new' | 'read' | 'replied' | 'done'} MessageState */

/**
 * @typedef {object} InboxMessage
 * @property {number} id
 * @property {number} created_at
 * @property {'feedback' | 'question' | 'problem' | 'word'} kind
 * @property {string} body
 * @property {string | null} reply_to
 * @property {string | null} page
 * @property {'en' | 'my'} lang
 * @property {MessageState} status
 * @property {string | null} note  The admins' own note.
 * @property {string | null} member
 * @property {string | null} handled_by
 * @property {number | null} handled_at
 */

/**
 * The Inbox, for admins.
 * @param {{ status: MessageState | 'all', before?: number }} options
 * @returns {Promise<{ messages: InboxMessage[], more: boolean, unread: number, counts: Record<MessageState, number> }>}
 */
export function inboxMessages({ status, before }) {
	return getJSON(`/api/workspace/messages?status=${status}${before ? `&before=${before}` : ''}`);
}

/**
 * A message's state, its note (null clears it), or both.
 * @param {number} id
 * @param {{ status?: MessageState, note?: string | null }} change
 * @returns {Promise<{ ok: true, status: MessageState, note: string | null }>}
 */
export function updateMessage(id, change) {
	return postJSON(`/api/workspace/messages/${id}`, change);
}

/** Site settings, for admins. @returns {Promise<{ settings: Array<{ key: string, value: unknown, about: string, updated_at: number | null }> }>} */
export function siteSettings() {
	return getJSON('/api/workspace/settings');
}

/**
 * @param {string} key
 * @param {unknown} value
 */
export function updateSetting(key, value) {
	return postJSON('/api/workspace/settings', { key, value });
}

/**
 * @typedef {{ dict: 'emd' | 'med', sense_id: number, value: 1 | -1, at: number, word: string | null, type: string | null, sense: string | null, state: 'current' | 'changed' | 'gone' }} RatedSense
 * @typedef {{ lang: 'en' | 'my', word: string, value: 1 | -1, at: number }} RatedEntry
 * @typedef {{ lang: 'en' | 'my', word: string, up: number, down: number }} EntryScore
 * @typedef {{ dict: 'emd' | 'med', sense_id: number, word: string, type: string, sense: string, up: number, down: number }} SenseScore
 */

/**
 * Ratings: the member's own, or the site's for editors.
 * @template {'mine' | 'site'} S
 * @param {S} scope
 * @returns {Promise<S extends 'mine' ? { entries: RatedEntry[], senses: RatedSense[] } : { entries: { liked: EntryScore[], disliked: EntryScore[] }, senses: { liked: SenseScore[], disliked: SenseScore[] } }>}
 */
export function workspaceRatings(scope) {
	return getJSON(`/api/workspace/ratings?scope=${scope}`);
}
