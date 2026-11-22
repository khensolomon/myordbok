// @ts-check
/**
 * Tauri adapter: start-up. No service worker: the app's files are inside the
 * app, and a new version comes from the store. Instead:
 *
 * - The platform is marked on <html data-app="ios|android|desktop">. On iOS,
 *   parts about giving (data-store-hidden) are not shown: Apple allows no
 *   asking for money outside its own payments.
 * - Links that leave the app open in the system browser (the opener
 *   plugin): other sites, and the parts of MyOrdbok the app does not hold,
 *   the workspace, on the website.
 * - A sign-in link ("Continue with Google", /api/auth/…/start) links the app
 *   instead (worker/routes/link.js): the app asks for a code, opens the
 *   sign-in on the website with /link?code=… to come back to, and asks
 *   after the code until the member approves it there; the session token
 *   it is given is kept for the HTTP adapter (http.js, mo:app-token).
 * - The app asks to be updated once the server no longer serves its build
 *   (GET /api/site, app.min; worker/index.js).
 */
import { AppError } from '#shared/errors.js';
import { STORES } from '../../core/config.js';
import { h } from '../../core/dom.js';
import { member } from '../../core/member.js';
import { t } from '../../i18n/index.js';
import { getJSON, postJSON } from './http.js';

/** A value the build wrote into the page (scripts/build.js --target tauri). @param {string} name */
const meta = (name) => globalThis.document?.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? '';
/** The server, as the HTTP adapter has it. */
const API = meta('mo-api');
/** The app's build number: 161 of "26.11.21+161". */
const BUILD = Number(meta('mo-version').split('+')[1] ?? NaN);
/** Paths of this site the app does not hold: they open on the website. */
const WEBSITE = /^\/(workspace|api\/auth)(\/|\?|$)/;
/** A sign-in link, with its provider. */
const SIGN_IN = /^\/api\/auth\/(google|github|apple)\/start$/;
/** Where the HTTP adapter reads the session token. */
const TOKEN_KEY = 'mo:app-token';

/** @returns {'ios' | 'android' | 'desktop'} */
function platform() {
	const agent = navigator.userAgent;
	return /iPhone|iPad|iPod/.test(agent) ? 'ios' : /Android/.test(agent) ? 'android' : 'desktop';
}

export async function boot() {
	if (!API || !Number.isInteger(BUILD)) throw new AppError('internal', 'The app was built without its server or version (scripts/build.js --target tauri --api …).');
	const os = platform();
	document.documentElement.dataset.app = os;
	document.addEventListener('click', leaving, true);
	checkVersion(os).catch((err) => console.warn('The app could not ask which builds are served:', err));
}

/**
 * A click on a link that leaves the app: opened in the system browser.
 * @param {MouseEvent} ev
 */
function leaving(ev) {
	if (ev.defaultPrevented || ev.button !== 0) return;
	const a = /** @type {Element | null} */ (ev.target instanceof Element ? ev.target : null)?.closest('a[href]');
	// A link that opens a menu of the page (the account button) is the page's.
	if (!(a instanceof HTMLAnchorElement) || a.hasAttribute('aria-haspopup')) return;
	const url = new URL(a.href, location.href);
	/** @type {string | null} */
	let out = null;
	const signIn = url.origin === location.origin ? SIGN_IN.exec(url.pathname) : null;
	if (signIn) {
		ev.preventDefault();
		linkApp(signIn[1]);
		return;
	}
	if (url.origin === location.origin) {
		if (WEBSITE.test(url.pathname)) out = `${API}${url.pathname}${url.search}${url.hash}`;
	} else if (/^(https?|mailto|tel):$/.test(url.protocol)) {
		out = url.href;
	}
	if (out === null) return;
	ev.preventDefault();
	open(out);
}

/**
 * An address in the system browser.
 * @param {string} url
 */
function open(url) {
	/** @type {((url: string) => Promise<void>) | undefined} */
	const openUrl = /** @type {any} */ (window).__TAURI__?.opener?.openUrl;
	if (!openUrl) {
		console.error('The opener plugin is missing (tauri-plugin-opener, with app.withGlobalTauri); cannot open', url);
		return;
	}
	openUrl(url).catch((err) => console.error('Could not open', url, err));
}

/** The link sheet open now, so a second tap does not start another. */
let linking = false;

/**
 * Links the app to an account: a code, the sign-in on the website, and
 * asking after the code until it is approved, turned down or expired.
 * @param {string} provider  The provider tapped; the website offers the others too.
 */
async function linkApp(provider) {
	if (linking) return;
	linking = true;
	let open_ = true;
	const status = h('p', { class: 'app-link-status', role: 'status' }, t('Getting a code…'));
	const code = h('p', { class: 'app-link-code', 'aria-label': t('The code') });
	const go = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'app-update-go', disabled: true }, t('Continue in browser')));
	const cancel = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'app-link-cancel' }, t('Cancel')));
	const sheet = h(
		'div',
		{ class: 'app-update app-link', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'app-link-title' },
		h('div', { class: 'app-update-box' }, h('h2', { id: 'app-link-title' }, t('Sign in')), h('p', null, t('You sign in on myordbok.com, then approve this code there. The app is then signed in as you.')), code, go, status, cancel),
	);
	const close = () => {
		open_ = false;
		linking = false;
		sheet.remove();
	};
	cancel.addEventListener('click', close);
	document.body.append(sheet);
	try {
		const started = await postJSON('/api/link/start', {});
		code.textContent = started.user_code;
		status.textContent = '';
		const back = `/link?code=${started.user_code}`;
		go.disabled = false;
		go.addEventListener('click', () => {
			open(`${API}/api/auth/${provider}/start?return=${encodeURIComponent(back)}`);
			status.textContent = t('Waiting for the approval on the website…');
		});
		const until = Date.now() + started.expires_in * 1000;
		while (open_ && Date.now() < until) {
			await new Promise((r) => setTimeout(r, started.interval * 1000));
			if (!open_) return;
			const answer = await postJSON('/api/link/poll', { device_code: started.device_code });
			if (answer.status === 'pending') continue;
			if (answer.status === 'approved') {
				localStorage.setItem(TOKEN_KEY, answer.token);
				close();
				await member({ fresh: true });
				return;
			}
			status.textContent = answer.status === 'denied' ? t('Cancelled on the website. The app was not linked.') : t('The code has expired. Close this and try again.');
			go.disabled = true;
			return;
		}
		if (open_) {
			status.textContent = t('The code has expired. Close this and try again.');
			go.disabled = true;
		}
	} catch (err) {
		if (!open_) return;
		status.textContent = err instanceof Error ? err.message : String(err);
		go.disabled = true;
	}
}

/**
 * Asks for an update, over everything, when this build is below the
 * lowest the server still serves.
 * @param {'ios' | 'android' | 'desktop'} os
 */
async function checkVersion(os) {
	const site = await getJSON('/api/site');
	const min = Number(site?.app?.min ?? 0);
	if (!(BUILD < min)) return;
	const store = os === 'ios' ? STORES.ios : os === 'android' ? STORES.android : null;
	const go = store ? h('a', { class: 'app-update-go', href: store }, t('Update')) : null;
	document.body.append(
		h(
			'div',
			{ class: 'app-update', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'app-update-title' },
			h('div', { class: 'app-update-box' }, h('h2', { id: 'app-update-title' }, t('Update MyOrdbok')), h('p', null, t('This version of the app is no longer supported. The new version is in the store.')), go),
		),
	);
}
