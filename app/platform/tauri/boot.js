// @ts-check
/**
 * Tauri adapter: start-up. No service worker: the app's files are inside the
 * app, and a new version comes from the store. Instead:
 *
 * - The platform is marked on <html data-app="ios|android|desktop">. On iOS
 *   and Android, parts about giving outside the store (data-store-hidden)
 *   are not shown: Apple and Google allow no asking for money outside
 *   their own payments. Supporting goes through the store instead (More;
 *   core/support.js), and what the store account bought is asked quietly
 *   once each launch (restoreQuietly).
 * - Links that leave the app open in the system browser (the opener
 *   plugin): other sites, and the parts of MyOrdbok the app does not hold,
 *   the workspace, on the website.
 * - A sign-in link ("Continue with Google", /api/auth/…/start) links the app
 *   instead (worker/routes/link.js): the app asks for a code, opens the
 *   sign-in on the website with /link?code=… to come back to, and asks
 *   after the code until the member approves it there; the session token
 *   it is given is kept for the HTTP adapter (http.js, mo:app-token).
 * - A light tap is felt (the haptics plugin) on the tabs, the search
 *   button and the thumbs; the page is marked so the stylesheet hides the
 *   scrollbar and the browser's tap and selection marks (app.css,
 *   html[data-app]).
 * - The app asks to be updated once the server no longer serves its build
 *   (GET /api/site, app.min; worker/index.js).
 */
import { AppError } from '#shared/errors.js';
import { STORES } from '../../core/config.js';
import { appLinkPath } from '#shared/stores.js';
import { h } from '../../core/dom.js';
import { member } from '../../core/member.js';
import { restoreQuietly } from '../../core/support.js';
import { t } from '../../i18n/index.js';
import { getJSON, postJSON } from './http.js';
import { platformOf } from '../../core/app-os.js';

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
	return platformOf();
}

export async function boot() {
	if (!API || !Number.isInteger(BUILD)) throw new AppError('internal', 'The app was built without its server or version (scripts/build.js --target tauri --api …).');
	const os = platform();
	document.documentElement.dataset.app = os;
	// An app's screen does not zoom: no pinch, no double tap (the text size
	// follows the phone's own setting instead).
	document.querySelector('meta[name="viewport"]')?.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
	document.addEventListener('click', leaving, true);
	document.addEventListener('click', felt, true);
	// A tap felt when the page asks for one (pull to refresh reaching its mark, core/pull.js).
	document.addEventListener('mo:haptic', () => tap('plugin:haptics|impact_feedback', { style: 'light' }));
	if (os === 'ios') followBackSwipe();
	if (os === 'ios' || os === 'android') {
		restoreQuietly();
		followAppLinks();
	}
	checkVersion(os).catch((err) => console.warn('The app could not ask which builds are served:', err));
}

/**
 * The website's links that open the app (Android App Links, iOS Universal
 * Links: shared/stores.js), each shown as the same page here: the one the
 * app was started with, then each while it runs.
 */
function followAppLinks() {
	const tauri = /** @type {any} */ (window).__TAURI__;
	tauri.event
		.listen('deep-link://new-url', (/** @type {{ payload: string[] }} */ ev) => openAppLink(ev.payload))
		.catch((/** @type {unknown} */ err) => console.error('The app does not follow the website\'s links:', err));
	tauri.core
		.invoke('plugin:deep-link|get_current')
		.then((/** @type {string[] | null} */ urls) => openAppLink(urls))
		.catch((/** @type {unknown} */ err) => console.error('The link the app was opened with could not be read:', err));
}

/**
 * Shows the page of a website's link, when it is one the app answers.
 * @param {string[] | null} urls
 */
function openAppLink(urls) {
	const href = urls?.at(-1);
	if (!href) return;
	const path = appLinkPath(href);
	if (path === null) {
		console.warn('A link the app does not show:', href);
		return;
	}
	window.dispatchEvent(new CustomEvent('mo:go', { detail: path }));
}

/**
 * A click on a link that leaves the app: opened in the system browser.
 * @param {MouseEvent} ev
 */
function leaving(ev) {
	if (ev.defaultPrevented || ev.button !== 0) return;
	const a = /** @type {Element | null} */ (ev.target instanceof Element ? ev.target : null)?.closest('a[href]');
	// A link that opens a menu of the page is the page's.
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

/** What a light tap is felt on: the tabs, Back, Cancel, and the thumbs. */
const FELT = '.app-tab, .search-done, .bar-back, .thumb, .segmented a, .you-choice, .you-switch';

/**
 * A light tap on the controls above, when the device has the motor for it.
 * @param {MouseEvent} ev
 */
function felt(ev) {
	const target = ev.target instanceof Element ? ev.target.closest(FELT) : null;
	if (!target || /** @type {HTMLButtonElement} */ (target).disabled) return;
	const thumb = target.classList.contains('thumb');
	tap(thumb ? 'plugin:haptics|impact_feedback' : 'plugin:haptics|selection_feedback', thumb ? { style: 'light' } : {});
}

/** The first pages of the tabs: nothing behind them, as in an iOS app. */
const TAB_ROOTS = new Set(['home', 'liked', 'practice', 'more']);

/**
 * The web view's back swipe (src-tauri/src/lib.rs, back_swipe): off on the
 * first page of a tab, on elsewhere, asked only when that changes.
 */
function followBackSwipe() {
	/** @type {boolean | null} */
	let now = null;
	window.addEventListener('mo:navigated', () => {
		const on = !TAB_ROOTS.has(document.body.dataset.route ?? '');
		if (on === now) return;
		now = on;
		/** @type {((cmd: string, args?: object) => Promise<unknown>) | undefined} */
		const invoke = /** @type {any} */ (window).__TAURI__?.core?.invoke;
		invoke?.('back_swipe', { on }).catch((err) => console.error('The back swipe could not be set:', err));
	});
}

/**
 * One haptic tap, where the device has the motor for it.
 * @param {string} command
 * @param {object} args
 */
function tap(command, args) {
	/** @type {((cmd: string, args?: object) => Promise<unknown>) | undefined} */
	const invoke = /** @type {any} */ (window).__TAURI__?.core?.invoke;
	if (!invoke) return;
	invoke(command, args).catch((err) => console.warn('No haptic tap:', err));
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
		closeSignInSheet();
	};
	cancel.addEventListener('click', close);
	document.body.append(sheet);
	try {
		const started = await postJSON('/api/link/start', {});
		code.textContent = started.user_code;
		status.textContent = '';
		const inSheet = signInSheet();
		const back = `/link?code=${started.user_code}${inSheet ? '&sheet=1' : ''}`;
		const url = `${API}/api/auth/${provider}/start?return=${encodeURIComponent(back)}`;
		// On iOS the website opens in Apple's sign-in sheet over the app, at
		// once; elsewhere in the browser, on the reader's tap.
		const begin = () => {
			status.textContent = t('Waiting for the approval on the website…');
			if (!inSheet) return open(url);
			openSignInSheet(url).then((closed) => {
				if (open_ && closed === 'cancelled') status.textContent = t('Sign-in was closed. Continue to try again.');
			});
		};
		go.textContent = inSheet ? t('Continue') : t('Continue in browser');
		go.disabled = false;
		go.addEventListener('click', begin);
		if (inSheet) begin();
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
			closeSignInSheet();
			status.textContent = answer.status === 'denied' ? t('Cancelled on the website. The app was not linked.') : t('The code has expired. Close this and try again.');
			go.disabled = true;
			return;
		}
		if (open_) {
			closeSignInSheet();
			status.textContent = t('The code has expired. Close this and try again.');
			go.disabled = true;
		}
	} catch (err) {
		if (!open_) return;
		status.textContent = err instanceof Error ? err.message : String(err);
		go.disabled = true;
	}
}

/** Whether sign-in opens in a sheet over the app: iOS, with the web-sheet plugin. */
function signInSheet() {
	return document.documentElement.dataset.app === 'ios' && Boolean(/** @type {any} */ (window).__TAURI__?.core?.invoke);
}

/**
 * The website in Apple's sign-in sheet (src-tauri/plugins/tauri-plugin-web-sheet).
 * Resolves with how it closed: 'callback' (the website ended it on
 * myordbok://), 'cancelled' (the reader, or the app once linked), or
 * 'failed' (logged; the reader can still go on in the browser).
 * @param {string} url
 * @returns {Promise<'callback' | 'cancelled' | 'failed'>}
 */
async function openSignInSheet(url) {
	try {
		const answer = await /** @type {any} */ (window).__TAURI__.core.invoke('plugin:web-sheet|open', { url, callbackScheme: 'myordbok' });
		return answer?.closed === 'callback' ? 'callback' : 'cancelled';
	} catch (err) {
		console.error('The sign-in sheet did not open; the browser instead:', err);
		open(url);
		return 'failed';
	}
}

/** Closes the sign-in sheet, should one be open. */
function closeSignInSheet() {
	if (!signInSheet()) return;
	/** @type {any} */ (window).__TAURI__.core.invoke('plugin:web-sheet|close').catch((/** @type {unknown} */ err) => console.error('The sign-in sheet could not be closed:', err));
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
