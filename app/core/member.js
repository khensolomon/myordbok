// @ts-check
/**
 * The member signed in on this device, if any. Asked once per page load
 * (and again after signing out); views and the header listen for
 * `mo:member` to follow changes.
 */
import { getJSON, postJSON } from '#platform/http.js';

/**
 * @typedef {object} Member
 * @property {number} id
 * @property {string} name
 * @property {string | null} email
 * @property {string | null} avatar_url
 * @property {import('#shared/roles.js').Role} role
 * @property {0 | 1} insights  Shown the site's statistics.
 * @property {Array<'google' | 'github'>} providers
 * @property {boolean} [supporter]  Linked to a donor (workspace Sponsors): never asked to support.
 */

/** @type {Promise<Member | null> | null} */
let current = null;

/**
 * @param {{ fresh?: boolean }} [options]  fresh: ask the server again.
 * @returns {Promise<Member | null>}
 */
export function member(options = {}) {
	if (!current || options.fresh) {
		current = getJSON('/api/me').then((body) => /** @type {Member | null} */ (body.member));
		// A failed check is not kept: the next one asks again.
		current.catch(() => {
			current = null;
		});
		current.then((m) => document.dispatchEvent(new CustomEvent('mo:member', { detail: m })), () => {});
	}
	return current;
}

/**
 * Where a sign-in with `provider` starts; back to `back` afterwards. Each
 * address is new (`n`, which the server ignores): a browser that once kept
 * a permanent redirect for a sign-in address, as a misplaced domain rule
 * can leave, never finds it again.
 * @param {'google' | 'github'} provider
 * @param {string} [back]
 */
export function signInHref(provider, back = '/workspace') {
	return `/api/auth/${provider}/start?return=${encodeURIComponent(back)}&n=${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export async function signOut() {
	await postJSON('/api/auth/signout');
	await member({ fresh: true });
}
