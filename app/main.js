// @ts-check
/**
 * App entry: platform start-up, then the router.
 * The page shell (header, search bar, footer) lives in index.html; views
 * render into <main>. The one search bar serves every page.
 */
import { boot } from '#platform/boot.js';
import { initConsent } from './core/consent.js';
import { initLang, t } from './i18n/index.js';
import { member } from './core/member.js';
import { initPrefs } from './core/prefs.js';
import { initNav } from './core/nav.js';
import { startRouter } from './core/router.js';
import { hrefFor } from './reader/query.js';
import './reader/search-box.js';

// The interface language's text loads before anything is built.
await initLang();

const outlet = document.getElementById('view');
if (!outlet) throw new Error('index.html is missing <main id="view">');
const search = /** @type {import('./reader/search-box.js').SearchBox | null} */ (document.getElementById('search'));
if (!search) throw new Error('index.html is missing <mo-search id="search">');

const navElement = document.querySelector('.site-nav');
if (!(navElement instanceof HTMLElement)) throw new Error('index.html is missing <nav class="site-nav">');
const nav = initNav(navElement);

const router = startRouter(outlet, (route) => {
	// Home shows the search bar as its centrepiece and no footer.
	document.body.dataset.route = route?.name ?? 'missing';
	// The bar shows the word being looked up, and is empty elsewhere.
	search.setValue(route?.name === 'definition' ? (new URL(location.href).searchParams.get('q') ?? '') : '');
	/** @type {HTMLAnchorElement | null} */
	let currentLink = null;
	for (const link of /** @type {NodeListOf<HTMLAnchorElement>} */ (document.querySelectorAll('.site-nav a'))) {
		const active = route !== null && new URL(link.href).pathname === route.path;
		if (active) {
			link.setAttribute('aria-current', 'page');
			currentLink = link;
		} else link.removeAttribute('aria-current');
	}
	nav.setCurrent(currentLink);
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

// The account button shows the member's picture once signed in.
const you = document.querySelector('.you');
if (!(you instanceof HTMLAnchorElement)) throw new Error('index.html is missing <a class="you">');
const blankFace = you.innerHTML;
initPrefs(you);
document.addEventListener('mo:member', (e) => {
	const m = /** @type {CustomEvent<import('./core/member.js').Member | null>} */ (e).detail;
	you.setAttribute('aria-label', m ? t('Account: {name}', { name: m.name }) : t('Account: sign in'));
	you.title = m ? m.name : t('Account');
	if (m?.avatar_url) {
		const img = document.createElement('img');
		img.src = m.avatar_url;
		img.alt = '';
		img.referrerPolicy = 'no-referrer';
		you.replaceChildren(img);
	} else you.innerHTML = blankFace;
});
// Whether someone is signed in; a failure leaves the button as it is.
member().catch((err) => console.warn('Account check failed:', err));
