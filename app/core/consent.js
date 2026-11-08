// @ts-check
/**
 * Analytics consent. Google Analytics is not loaded, and sets no cookies,
 * until the visitor allows it. The choice is kept on the device and can be
 * changed at any time from the privacy page.
 */
import { ANALYTICS } from './config.js';
import { h } from './dom.js';

const KEY = 'mo:analytics';

/** @typedef {'granted' | 'denied'} Choice */

/** @returns {Choice | null} */
export function getChoice() {
	try {
		const value = localStorage.getItem(KEY);
		return value === 'granted' || value === 'denied' ? value : null;
	} catch {
		return null; // storage blocked: treated as "not chosen", so nothing loads
	}
}

/** Whether analytics can run on this host at all. */
export function analyticsAvailable() {
	return ANALYTICS.hosts.includes(location.hostname);
}

/** @param {Choice} choice */
export function setChoice(choice) {
	try {
		localStorage.setItem(KEY, choice);
	} catch (err) {
		console.warn('Analytics choice could not be saved on this device; it applies to this visit only.', err);
	}
	document.querySelector('.consent')?.remove();
	if (choice === 'granted') load();
	else forget();
	window.dispatchEvent(new CustomEvent('mo:consent', { detail: choice }));
}

let loaded = false;

function load() {
	if (loaded || !analyticsAvailable()) return;
	loaded = true;
	const w = /** @type {any} */ (window);
	w[`ga-disable-${ANALYTICS.id}`] = false;
	w.dataLayer = w.dataLayer || [];
	w.gtag = function gtag() {
		// eslint-disable-next-line prefer-rest-params
		w.dataLayer.push(arguments);
	};
	w.gtag('consent', 'default', {
		analytics_storage: 'granted',
		ad_storage: 'denied',
		ad_user_data: 'denied',
		ad_personalization: 'denied',
	});
	w.gtag('js', new Date());
	// Page views are sent by trackPage(): the router changes pages without reloads.
	w.gtag('config', ANALYTICS.id, { send_page_view: false });
	const script = h('script', { async: true, src: `https://www.googletagmanager.com/gtag/js?id=${ANALYTICS.id}` });
	script.addEventListener('error', () => console.warn('Google Analytics did not load (blocked or offline).'));
	document.head.append(script);
	trackPage();
}

/** Stops collection and removes the Google Analytics cookies. */
function forget() {
	/** @type {any} */ (window)[`ga-disable-${ANALYTICS.id}`] = true;
	const domain = location.hostname.split('.').slice(-2).join('.');
	for (const name of document.cookie.split(';').map((c) => c.split('=')[0].trim())) {
		if (name === '_ga' || name.startsWith('_ga_')) {
			for (const d of ['', `; domain=.${domain}`, `; domain=${location.hostname}`]) {
				document.cookie = `${name}=; max-age=0; path=/${d}`;
			}
		}
	}
}

export function trackPage() {
	if (!loaded) return;
	/** @type {any} */ (window).gtag('event', 'page_view', {
		page_location: location.href,
		page_title: document.title,
	});
}

/**
 * Called once at start-up: loads analytics if allowed before, or asks once.
 */
export function initConsent() {
	if (!analyticsAvailable()) return;
	window.addEventListener('mo:navigated', trackPage);
	const choice = getChoice();
	if (choice === 'granted') load();
	else if (choice === null) ask();
}

function ask() {
	const card = h(
		'aside',
		{ class: 'consent', role: 'region', 'aria-label': 'Analytics choice' },
		h('p', null, 'Allow anonymous usage statistics (Google Analytics) to help improve MyOrdbok? ', h('a', { href: '/privacy' }, 'Privacy')),
		h(
			'div',
			{ class: 'consent-actions' },
			h('button', { type: 'button', class: 'consent-no', onClick: () => setChoice('denied') }, 'No thanks'),
			h('button', { type: 'button', class: 'consent-yes', onClick: () => setChoice('granted') }, 'Allow'),
		),
	);
	document.body.append(card);
}
