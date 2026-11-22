// @ts-check
/**
 * Pull to refresh, in the app (html[data-app]): at the top of a page, a pull
 * down past a mark asks the page again from the server, as a browser's
 * pull does. A round mark under the bar follows the finger, fills as the
 * pull nears the mark and turns while the page loads.
 *
 * The listeners are passive: they only watch the finger, never hold the
 * scroll (one that may cancel a touch makes the phone wait for it on every
 * move, and scrolling stutters). The bounce itself is the phone's own.
 */
import { pageScroll } from './scroll.js';

/** How far, in pixels, a pull goes before letting go refreshes. */
const MARK = 72;
/** How far the round mark moves at most. */
const TRAVEL = 96;

/**
 * @param {() => Promise<void>} refresh  Asks the page again; settles when shown.
 */
export function pullToRefresh(refresh) {
	const ring = document.createElement('div');
	ring.className = 'pull';
	ring.setAttribute('aria-hidden', 'true');
	ring.innerHTML = '<svg class="icon" viewBox="0 0 24 24" width="22" height="22"><path d="M19 12a7 7 0 1 1-2.05-4.95"/><path d="M19 4.5v4h-4"/></svg>';
	document.body.append(ring);

	/** @type {number | null} */
	let start = null;
	let pulled = 0;
	let busy = false;

	/** @param {number} distance */
	const show = (distance) => {
		pulled = distance;
		ring.style.setProperty('--pull', String(Math.min(distance, TRAVEL)));
		ring.style.setProperty('--ready', String(Math.min(1, distance / MARK)));
		ring.toggleAttribute('data-shown', distance > 4);
		ring.toggleAttribute('data-ready', distance >= MARK);
	};

	document.addEventListener(
		'touchstart',
		(e) => {
			const app = document.documentElement.dataset.app;
			const route = document.body.dataset.route;
			if (!app || busy || e.touches.length !== 1 || route === 'workspace' || document.body.hasAttribute('data-searching') || pageScroll() > 0) return;
			start = e.touches[0].clientY;
		},
		{ passive: true },
	);
	document.addEventListener(
		'touchmove',
		(e) => {
			if (start === null) return;
			// Scrolled down meanwhile: a scroll, not a pull.
			if (pageScroll() > 0) {
				start = null;
				show(0);
				return;
			}
			show(Math.max(0, (e.touches[0].clientY - start) * 0.55));
		},
		{ passive: true },
	);
	const end = () => {
		if (start === null) return;
		start = null;
		if (pulled < MARK) return show(0);
		busy = true;
		ring.setAttribute('data-busy', '');
		show(MARK);
		refresh()
			.catch((err) => console.error('The page could not be loaded again:', err))
			.finally(() => {
				busy = false;
				ring.removeAttribute('data-busy');
				show(0);
			});
	};
	document.addEventListener('touchend', end, { passive: true });
	document.addEventListener('touchcancel', end, { passive: true });
}
