// @ts-check
/**
 * App entry: platform start-up, then the router.
 * The page shell (header, footer) lives in index.html; views render into <main>.
 */
import { boot } from '#platform/boot.js';
import { startRouter } from './core/router.js';

const outlet = document.getElementById('view');
if (!outlet) throw new Error('index.html is missing <main id="view">');

startRouter(outlet, (route) => {
	// Home stays clean: no footer and a lighter header.
	document.body.dataset.route = route?.name ?? 'missing';
	for (const link of document.querySelectorAll('.site-nav a')) {
		const active = route !== null && new URL(/** @type {HTMLAnchorElement} */ (link).href).pathname === route.path;
		if (active) link.setAttribute('aria-current', 'page');
		else link.removeAttribute('aria-current');
	}
});

boot();
