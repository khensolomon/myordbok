// @ts-check
/**
 * The website pointing to the apps, never inside them (html[data-app]):
 *
 *   Safari on iOS   Apple's own Smart App Banner (a meta tag the build puts
 *                   in the website's page: scripts/build.js); "Open" when
 *                   the app is there, "View" when not; Safari keeps a close.
 *   Android         Chrome has none for a store app, so a small card from
 *                   the bottom: once a reader has looked up a second word,
 *                   never while installed as the web app, and, closed, not
 *                   again for 60 days (localStorage mo:get-app).
 *   Everywhere      More's "Get the app" (getAppSection), the reader's own
 *                   store first.
 */
import { h } from './dom.js';
import { t } from '../i18n/index.js';
import { APP_STORE_URL, PLAY_URL } from '#shared/stores.js';

const KEY = 'mo:get-app';
const AWAY = 60 * 86400000;
const LOOKS = 2;

/** @returns {'ios' | 'android' | null} The phone's system, on the website only. */
export function phoneSystem() {
	if (document.documentElement.dataset.app) return null;
	const ua = navigator.userAgent;
	if (/Android/.test(ua)) return 'android';
	if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
	return null;
}

/** @returns {{ looks: number, closed: number }} */
function kept() {
	try {
		return { looks: 0, closed: 0, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
	} catch {
		return { looks: 0, closed: 0 };
	}
}
/** @param {{ looks: number, closed: number }} state */
function keep(state) {
	try {
		localStorage.setItem(KEY, JSON.stringify(state));
	} catch {
		// Not kept: the card may come again next visit.
	}
}

/** Watches for look-ups and, on Android, offers the app once. Called once at start. */
export function offerApp() {
	if (phoneSystem() !== 'android' || matchMedia('(display-mode: standalone)').matches) return;
	window.addEventListener('mo:navigated', (e) => {
		if (/** @type {CustomEvent} */ (e).detail !== 'definition') return;
		const state = kept();
		state.looks += 1;
		keep(state);
		if (state.looks >= LOOKS && Date.now() - state.closed > AWAY && !document.querySelector('.get-app')) show();
	});
}

function show() {
	const close = h('button', { type: 'button', class: 'get-app-close', 'aria-label': t('Close') }, '✕');
	const go = h('a', { class: 'get-app-go', href: PLAY_URL, target: '_blank', rel: 'noopener' }, t('Get'));
	const card = h(
		'aside',
		{ class: 'get-app', role: 'complementary', 'aria-label': t('MyOrdbok for Android') },
		h('img', { src: '/static/icons/apple-touch-icon.png', alt: '', width: 44, height: 44 }),
		h('div', { class: 'get-app-text' }, h('b', null, t('MyOrdbok for Android')), h('span', null, t('The whole dictionary offline, practice, no ads'))),
		go,
		close,
	);
	const away = () => {
		keep({ ...kept(), closed: Date.now() });
		card.classList.add('is-leaving');
		setTimeout(() => card.remove(), 250);
	};
	close.addEventListener('click', away);
	go.addEventListener('click', away);
	document.body.append(card);
}

/** More's "Get the app": on the website only, the reader's own store first. */
export function getAppSection() {
	if (document.documentElement.dataset.app) return [];
	const apple = h('a', { class: 'get-app-store', href: APP_STORE_URL, target: '_blank', rel: 'noopener' }, h('small', null, t('Download on the')), h('b', null, 'App Store'));
	const play = h('a', { class: 'get-app-store', href: PLAY_URL, target: '_blank', rel: 'noopener' }, h('small', null, t('Get it on')), h('b', null, 'Google Play'));
	const stores = phoneSystem() === 'android' ? [play, apple] : [apple, play];
	return [
		h('h2', { class: 'you-section' }, t('Get the app')),
		h('div', { class: 'you-group get-app-card' }, h('p', null, t('The same dictionary as an app: offline, practice that comes back, no ads.')), h('div', { class: 'get-app-stores' }, stores)),
	];
}
