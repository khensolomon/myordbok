// @ts-check
/**
 * App entry: platform start-up, then the router.
 * The page shell (navigation, search bar, footer) lives in index.html; views
 * render into <main>. The one search bar serves every page.
 */
import { boot } from '#platform/boot.js';
import { initConsent } from './core/consent.js';
import { initLang, t } from './i18n/index.js';
import { member } from './core/member.js';
import { followTheme } from './core/prefs.js';
import { followOnline } from './core/online.js';
import { showNotices } from './core/notices.js';
import { startRouter } from './core/router.js';
import { backSwipe } from './core/swipe.js';
import { savingData, siteSwitches } from './data/api.js';
import { checkIn, keepWordLists } from './data/offline.js';
import { hrefFor } from './reader/query.js';
import './reader/search-box.js';

// The interface language's text loads before anything is built.
await initLang();

const outlet = document.getElementById('view');
if (!outlet) throw new Error('index.html is missing <main id="view">');
const search = /** @type {import('./reader/search-box.js').SearchBox | null} */ (document.getElementById('search'));
if (!search) throw new Error('index.html is missing <mo-search id="search">');

const logo = document.querySelector('.bar-logo');
if (!(logo instanceof HTMLAnchorElement)) throw new Error('index.html is missing <a class="bar-logo">');

/** The tab each page belongs to: the definition and grammar pages to Search, the rest to You. */
const TAB_OF = /** @type {Record<string, string>} */ ({ home: 'search', definition: 'search', grammar: 'search', fonts: 'search', liked: 'liked', practice: 'practice' });
const tabs = /** @type {NodeListOf<HTMLAnchorElement>} */ (document.querySelectorAll('.app-nav [data-tab]'));
if (tabs.length !== 4) throw new Error('index.html is missing the four tabs of <nav class="app-nav">');
const moreLinks = /** @type {NodeListOf<HTMLAnchorElement>} */ (document.querySelectorAll('.app-more a'));

// A page's buttons for the bar (a definition's thumb, .entry-actions) move
// into it once the page is shown, and go with the page.
const barActions = document.querySelector('.bar-actions');
if (!(barActions instanceof HTMLElement)) throw new Error('index.html is missing <div class="bar-actions">');
window.addEventListener('mo:navigated', () => barActions.replaceChildren(...outlet.querySelectorAll('.entry-actions')));

const router = startRouter(outlet, (route) => {
	// Home shows the search bar as its centrepiece and no footer.
	document.body.dataset.route = route?.name ?? 'missing';
	barActions.replaceChildren();
	// The logo leads home; on home itself, to how to search.
	logo.href = route?.name === 'home' ? '/definition' : '/';
	logo.setAttribute('aria-label', route?.name === 'home' ? t('How to search') : t('MyOrdbok home'));
	// The bar shows the word being looked up, and is empty elsewhere.
	search.setValue(route?.name === 'definition' ? (new URL(location.href).searchParams.get('q') ?? '') : '');
	const tab = route ? (TAB_OF[route.name] ?? 'you') : null;
	for (const link of tabs) {
		// The tab of the page shown; its own page is the one "current".
		link.toggleAttribute('data-on', link.dataset.tab === tab);
		if (route && new URL(link.href).pathname === route.path) link.setAttribute('aria-current', 'page');
		else link.removeAttribute('aria-current');
	}
	for (const link of moreLinks) {
		if (route && new URL(link.href).pathname === route.path) link.setAttribute('aria-current', 'page');
		else link.removeAttribute('aria-current');
	}
});

// Under 1024px: Cancel closes the search screen (app.css).
const cancel = document.querySelector('.search-cancel');
if (!(cancel instanceof HTMLButtonElement)) throw new Error('index.html is missing <button class="search-cancel">');
// Pressed, the button keeps focus in the field until it acts, so the header does not start to change back first.
cancel.addEventListener('pointerdown', (e) => e.preventDefault());
cancel.addEventListener('click', () => search.cancel());

// Back, on a definition (under 1024px): to the page it was opened from, or home.
const back = document.querySelector('.bar-back');
if (!(back instanceof HTMLAnchorElement)) throw new Error('index.html is missing <a class="bar-back">');
back.addEventListener('click', (e) => {
	if (!history.state?.from) return;
	e.preventDefault();
	history.back();
});

// The iOS app: a swipe from the left edge goes back, as in other apps (swipe.js).
backSwipe();

// The Search tab, tapped on the page it leads to: the search itself.
tabs[0].addEventListener('click', (e) => {
	if (document.body.dataset.route !== 'home') return;
	e.preventDefault();
	search.focus();
});

// What was typed is read before it goes anywhere: "what is love" opens love.
search.addEventListener('mo-search', (e) => router.go(hrefFor(/** @type {CustomEvent<string>} */ (e).detail)));

// The bars change look once the page scrolls under them (app.css, data-scrolled).
const markScrolled = () => document.body.toggleAttribute('data-scrolled', window.scrollY > 4);
window.addEventListener('scroll', markScrolled, { passive: true });
window.addEventListener('mo:navigated', markScrolled);
markScrolled();

initConsent();
boot();

// The You tab shows the member's picture once signed in.
const you = document.querySelector('.app-nav .you');
const face = you?.querySelector('.you-face-slot');
if (!(you instanceof HTMLAnchorElement) || !(face instanceof HTMLElement)) throw new Error('index.html is missing the You tab with its .you-face-slot');
const blankFace = face.innerHTML;
followTheme();
followOnline();
document.addEventListener('mo:member', (e) => {
	const m = /** @type {CustomEvent<import('./core/member.js').Member | null>} */ (e).detail;
	you.setAttribute('aria-label', m ? t('You: {name}', { name: m.name }) : t('You'));
	you.title = m ? m.name : t('You');
	// Without a picture, or when it fails to load, the name's first letter.
	const initial = () => {
		const letter = document.createElement('span');
		letter.className = 'you-initial';
		letter.textContent = (m?.name ?? '?').slice(0, 1).toUpperCase();
		face.replaceChildren(letter);
	};
	if (m?.avatar_url) {
		const img = document.createElement('img');
		img.alt = '';
		img.referrerPolicy = 'no-referrer';
		img.addEventListener('error', initial, { once: true });
		img.src = m.avatar_url;
		face.replaceChildren(img);
	} else if (m) initial();
	else face.innerHTML = blankFace;
});
// Whether someone is signed in; a failure leaves the button as it is.
// Then the site notices: with a session, also those for members or editors.
member()
	.catch((err) => {
		console.warn('Account check failed:', err);
		return null;
	})
	.then((m) => showNotices(m !== null))
	.catch((err) => console.warn('Site notices unavailable:', err));

// What admins have paused (Settings): the controls for it step aside. The
// Worker refuses the writes either way; this only spares a button that fails.
siteSwitches()
	.then((s) => {
		document.body.toggleAttribute('data-ratings-off', !s.ratings);
		document.body.toggleAttribute('data-suggestions-off', !s.suggestions);
		document.body.toggleAttribute('data-readonly', s.readonly);
		// An answer cached before the switch existed has no quiz: on, its default.
		document.body.toggleAttribute('data-quiz-off', s.quiz === false);
		document.body.toggleAttribute('data-help-off', s.help === false);
	})
	.catch((err) => console.warn('Site switches unavailable:', err));

// The word lists are kept on the device once the page has settled (offline.js).
const idle = /** @type {(f: () => void) => void} */ (window.requestIdleCallback ?? ((f) => setTimeout(f, 3000)));
idle(() => keepWordLists(savingData).catch((err) => console.warn('Word lists were not kept for offline use:', err)));
// Once a day: whether this device keeps definitions and how often it answered offline (offline.js).
idle(() => checkIn().catch((err) => console.warn('Offline check-in failed:', err)));
