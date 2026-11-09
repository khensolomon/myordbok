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
 * @property {'member' | 'editor' | 'admin'} role
 * @property {Array<'google' | 'github'>} providers
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
 * Where a sign-in with `provider` starts; back to `back` afterwards.
 * @param {'google' | 'github'} provider
 * @param {string} [back]
 */
export function signInHref(provider, back = '/account') {
	return `/api/auth/${provider}/start?return=${encodeURIComponent(back)}`;
}

export async function signOut() {
	await postJSON('/api/auth/signout');
	await member({ fresh: true });
}
