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
import { initMenu } from './core/menu.js';
import { startRouter } from './core/router.js';
import { pageScroll, scrollPageTo } from './core/scroll.js';
import { pullToRefresh } from './core/pull.js';
import { forgetKept, savingData, siteSwitches } from './data/api.js';
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

/** The tab each page belongs to: the definition and grammar pages to Home, the rest to You. */
const TAB_OF = /** @type {Record<string, string>} */ ({ home: 'home', definition: 'home', grammar: 'home', fonts: 'home', liked: 'liked', practice: 'practice' });
const tabs = /** @type {NodeListOf<HTMLAnchorElement>} */ (document.querySelectorAll('.app-nav [data-tab]'));
if (tabs.length !== 4) throw new Error('index.html is missing the four tabs of <nav class="app-nav">');
const moreLinks = /** @type {NodeListOf<HTMLAnchorElement>} */ (document.querySelectorAll('.app-more a, .site-nav a'));

const router = startRouter(outlet, (route) => {
	// Home shows the search bar as its centrepiece and no footer.
	document.body.dataset.route = route?.name ?? 'missing';
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

// The app: a pull down at the top of a page asks it again (pull.js).
pullToRefresh(async () => {
	forgetKept();
	await Promise.all([router.refresh(), member({ fresh: true }).catch(() => null)]);
});

// In the app the bar over a definition is fixed above the scrolling page
// (app.css): the page starts below it, by its height.
const bar = document.querySelector('.search-bar');
if (!(bar instanceof HTMLElement)) throw new Error('index.html is missing <div class="search-bar">');
// While it is the search screen it covers the window: that is not its height.
new ResizeObserver(() => {
	if (!document.body.hasAttribute('data-searching')) document.documentElement.style.setProperty('--bar-h', `${bar.offsetHeight}px`);
}).observe(bar);

// Back, on a definition (under 1024px): to the page the definitions were
// opened from (Liked, home, Practice), past any opened from one another;
// opened straight, home, the link's own address (router.js, origin).
const back = document.querySelector('.bar-back');
if (!(back instanceof HTMLAnchorElement)) throw new Error('index.html is missing <a class="bar-back">');
back.addEventListener('click', (e) => {
	const { origin, depth } = history.state ?? {};
	if (!origin || !depth) return;
	e.preventDefault();
	history.go(-depth);
});

// What was typed is read before it goes anywhere: "what is love" opens love.
search.addEventListener('mo-search', (e) => router.go(hrefFor(/** @type {CustomEvent<string>} */ (e).detail)));

// The bars change look once the page scrolls under them (app.css, data-scrolled).
const markScrolled = () => {
	const top = pageScroll();
	document.body.toggleAttribute('data-scrolled', top > 4);
	// Past home's large title: its name moves into the bar (app.css, .title-bar).
	document.body.toggleAttribute('data-scrolled-far', top > 64);
};
// Captured: in the app the page scrolls in <body>, whose scroll event does not reach the window (scroll.js).
document.addEventListener('scroll', markScrolled, { passive: true, capture: true });
window.addEventListener('mo:navigated', markScrolled);

// The title bar (under 1024px, app.css): home's logo, or the page's own heading.
const titleBar = document.querySelector('.title-bar > span');
if (!(titleBar instanceof HTMLElement)) throw new Error('index.html is missing <div class="title-bar"><span>');
const titleLogo = titleBar.innerHTML;
window.addEventListener('mo:navigated', () => {
	const heading = outlet.querySelector('h1');
	if (document.body.dataset.route === 'home' || !heading) titleBar.innerHTML = titleLogo;
	else titleBar.textContent = heading.textContent;
});
markScrolled();

initConsent();
boot();

// The You tab, and the classic header's person button (1180px and up,
// which opens the You page in a panel: menu.js), show the member's picture
// once signed in.
const yous = /** @type {HTMLAnchorElement[]} */ ([...document.querySelectorAll('.app-nav .you, .site-header .you')]);
if (yous.length !== 2 || yous.some((y) => !y.querySelector('.you-face-slot'))) throw new Error('index.html is missing the You tab or the header\'s person button, each with its .you-face-slot');
const blankFaces = yous.map((y) => /** @type {HTMLElement} */ (y.querySelector('.you-face-slot')).innerHTML);
initMenu(/** @type {HTMLAnchorElement} */ (document.querySelector('.site-header .you')));
followTheme();
followOnline();
document.addEventListener('mo:member', (e) => {
	const m = /** @type {CustomEvent<import('./core/member.js').Member | null>} */ (e).detail;
	yous.forEach((you, i) => {
		const face = /** @type {HTMLElement} */ (you.querySelector('.you-face-slot'));
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
		else face.innerHTML = blankFaces[i];
	});
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
