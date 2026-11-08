// @ts-check
/**
 * App entry: platform start-up, then the router.
 * The page shell (header, search bar, footer) lives in index.html; views
 * render into <main>. The one search bar serves every page.
 */
import { boot } from '#platform/boot.js';
import { initConsent } from './core/consent.js';
import { definitionHref } from './core/routes.js';
import { startRouter } from './core/router.js';
import './reader/search-box.js';

const outlet = document.getElementById('view');
if (!outlet) throw new Error('index.html is missing <main id="view">');
const search = /** @type {import('./reader/search-box.js').SearchBox | null} */ (document.getElementById('search'));
if (!search) throw new Error('index.html is missing <mo-search id="search">');

const router = startRouter(outlet, (route) => {
	// Home shows the search bar as its centrepiece and no footer.
	document.body.dataset.route = route?.name ?? 'missing';
	// The bar shows the word being looked up, and is empty elsewhere.
	search.setValue(route?.name === 'definition' ? (new URL(location.href).searchParams.get('q') ?? '') : '');
	for (const link of document.querySelectorAll('.site-nav a')) {
		const active = route !== null && new URL(/** @type {HTMLAnchorElement} */ (link).href).pathname === route.path;
		if (active) link.setAttribute('aria-current', 'page');
		else link.removeAttribute('aria-current');
	}
});

search.addEventListener('mo-search', (e) => router.go(definitionHref(/** @type {CustomEvent<string>} */ (e).detail)));

initConsent();
boot();
