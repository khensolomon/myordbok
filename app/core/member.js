// @ts-check
/**
 * The member signed in on this device, if any. Asked once per page load
 * (and again after signing out); views and the header listen for
 * `mo:member` to follow changes.
 */
import { getJSON, postJSON } from '#platform/http.js';
import { h } from './dom.js';
import { t } from '../i18n/index.js';

/** @typedef {'google' | 'github' | 'apple'} Provider */

/** Provider names, as each provider writes its own. */
export const PROVIDER_NAMES = /** @type {Readonly<Record<Provider, string>>} */ (Object.freeze({ google: 'Google', github: 'GitHub', apple: 'Apple' }));

/** Apple's logo, for its button (Apple's guidelines ask for it beside the words). */
const APPLE_LOGO =
	'<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.37 12.58c-.03-2.68 2.19-3.97 2.29-4.03-1.25-1.82-3.19-2.07-3.88-2.1-1.65-.17-3.22.97-4.06.97-.84 0-2.13-.95-3.5-.92-1.8.03-3.46 1.05-4.39 2.66-1.87 3.25-.48 8.06 1.35 10.7.89 1.29 1.95 2.74 3.35 2.69 1.34-.05 1.85-.87 3.47-.87 1.62 0 2.08.87 3.5.84 1.45-.03 2.37-1.31 3.25-2.61 1.02-1.5 1.45-2.95 1.47-3.02-.03-.01-2.82-1.08-2.85-4.31zM13.7 4.71c.74-.9 1.24-2.14 1.1-3.38-1.07.04-2.36.71-3.12 1.61-.69.79-1.29 2.06-1.13 3.27 1.19.09 2.41-.61 3.15-1.5z"/></svg>';

/**
 * @typedef {object} Member
 * @property {number} id
 * @property {string} name
 * @property {string | null} email
 * @property {string | null} avatar_url
 * @property {import('#shared/roles.js').Role} role
 * @property {0 | 1} insights  Shown the site's statistics.
 * @property {Provider[]} providers
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
 * @param {Provider} provider
 * @param {string} [back]
 */
export function signInHref(provider, back = '/workspace') {
	return `/api/auth/${provider}/start?return=${encodeURIComponent(back)}&n=${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export async function signOut() {
	await postJSON('/api/auth/signout');
	await member({ fresh: true });
}

/**
 * "Continue with …" links for the providers this site offers now (GET
 * /api/site, signin), filled in once known; Apple's in its own style.
 * @param {string} cls  The links' class.
 * @param {string} back  Where to come back to.
 * @param {(p: Provider) => boolean} [which]  Only these (e.g. those not linked yet).
 */
export function providerLinks(cls, back, which = () => true) {
	const box = h('div', { class: `${cls}s` });
	getJSON('/api/site')
		.then((/** @type {{ signin?: Provider[] }} */ site) => {
			const list = (site.signin ?? []).filter(which);
			box.replaceChildren(
				...list.map((p) => {
					const a = h('a', { class: p === 'apple' ? `${cls} is-apple` : cls, href: signInHref(p, back) }, t('Continue with {provider}', { provider: PROVIDER_NAMES[p] }));
					if (p === 'apple') a.insertAdjacentHTML('afterbegin', APPLE_LOGO);
					return a;
				}),
			);
			box.hidden = !list.length;
		})
		.catch((err) => box.replaceChildren(h('p', { class: 'ws-quiet' }, err instanceof Error ? err.message : String(err))));
	return box;
}
