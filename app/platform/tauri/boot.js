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
 *   the workspace and signing in, on the website.
 * - The app asks to be updated once the server no longer serves its build
 *   (GET /api/site, app.min; worker/index.js).
 */
import { AppError } from '#shared/errors.js';
import { STORES } from '../../core/config.js';
import { h } from '../../core/dom.js';
import { t } from '../../i18n/index.js';
import { getJSON } from './http.js';

/** A value the build wrote into the page (scripts/build.js --target tauri). @param {string} name */
const meta = (name) => globalThis.document?.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? '';
/** The server, as the HTTP adapter has it. */
const API = meta('mo-api');
/** The app's build number: 161 of "26.11.21+161". */
const BUILD = Number(meta('mo-version').split('+')[1] ?? NaN);
/** Paths of this site the app does not hold: they open on the website. */
const WEBSITE = /^\/(workspace|api\/auth)(\/|\?|$)/;

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
	if (!(a instanceof HTMLAnchorElement)) return;
	const url = new URL(a.href, location.href);
	/** @type {string | null} */
	let out = null;
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
