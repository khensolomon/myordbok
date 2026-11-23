// @ts-check
/**
 * Pull to refresh, in the app (html[data-app]), drawn as the phone's own:
 * the spokes of an activity spinner appear one by one in the gap the pull
 * opens above the page; past the mark (a light tap is felt) letting go
 * keeps the gap open while the page is asked again from the server, the
 * spinner turning in it, then the page closes the gap.
 *
 * On iOS the gap is the page's own bounce (the scroller reads negative at
 * the top); elsewhere, where the page does not bounce, the page is moved
 * down by the pull, with the same give as a bounce (rubber). The listeners
 * are passive: they only watch the finger, never hold the scroll. A pull
 * let back up and pulled again with the same finger shows the spinner
 * again.
 *
 * On Home (under 1024px) the logo and the language line stay where they
 * are: the gap opens under them, the spinner turning in it, and the search
 * box and the rest come down. Home does not bounce at its top (app.css,
 * overscroll-behavior), so the pull moves what is under the logo itself,
 * from the same touch event: nothing is moved against a bounce, and
 * nothing trembles.
 */
import { pageScroll } from './scroll.js';

/** The gap, in pixels, past which letting go refreshes. */
const MARK = 64;
/** The gap kept open while the page loads. */
const HOLD = 52;
/** Spokes of the spinner. */
const SPOKES = 8;

/**
 * @param {() => Promise<void>} refresh  Asks the page again; settles when shown.
 */
export function pullToRefresh(refresh) {
	const ring = document.createElement('div');
	ring.className = 'pull';
	ring.setAttribute('aria-hidden', 'true');
	const spokes = Array.from({ length: SPOKES }, (_, i) => `<line class="pull-spoke" x1="14" y1="3.5" x2="14" y2="9" transform="rotate(${(360 / SPOKES) * i} 14 14)"/>`).join('');
	ring.innerHTML = `<svg viewBox="0 0 28 28" width="28" height="28">${spokes}</svg>`;
	document.body.append(ring);
	const lines = /** @type {SVGLineElement[]} */ ([...ring.querySelectorAll('line')]);

	/** @type {number | null} */
	let start = null;
	let gap = 0;
	let ready = false;
	let busy = false;

	const page = () => /** @type {HTMLElement} */ (document.getElementById('view'));
	const atHome = () => document.body.dataset.route === 'home' && window.matchMedia('(max-width: 1023px)').matches;
	/** Whether the page bounces by itself (iOS, but not Home): then the gap is its own. */
	const bounces = () => document.documentElement.dataset.app === 'ios' && !atHome();
	/** What comes down when the page does not bounce: the page, and on Home the search box (not the logo). */
	const moved = () => /** @type {HTMLElement[]} */ ([...(atHome() ? [...document.querySelectorAll('.search-bar mo-search')] : []), page()]);
	/** The give of a pull, as the phone's own bounce: easy at first, stiffer the further it goes. */
	const rubber = (/** @type {number} */ d) => (d <= 0 ? 0 : (1 - 1 / ((d * 0.55) / window.innerHeight + 1)) * window.innerHeight);

	/** @param {number} value */
	const show = (value) => {
		gap = Math.max(0, value);
		const progress = Math.min(1, gap / MARK);
		ring.style.setProperty('--gap', String(gap));
		ring.style.opacity = String(Math.min(1, progress * 1.4));
		// The spokes appear one by one, as the pull goes.
		const shown = Math.round(progress * SPOKES);
		lines.forEach((l, i) => (l.style.opacity = i < shown ? '1' : '0'));
		if (!bounces()) for (const el of moved()) el.style.transform = gap ? `translateY(${gap}px)` : '';
		if (progress >= 1 && !ready) {
			ready = true;
			document.dispatchEvent(new CustomEvent('mo:haptic', { detail: 'impact' }));
		} else if (progress < 1) ready = false;
	};

	/** @param {TouchEvent} e */
	const follow = (e) => {
		if (start === null) return;
		const scrolled = pageScroll();
		// Scrolled down meanwhile: a scroll, not a pull, until the finger
		// brings the page back to the top and pulls again (from there).
		if (scrolled > 0) {
			start = e.touches[0].clientY;
			if (gap) show(0);
			return;
		}
		show(bounces() ? -scrolled : rubber(e.touches[0].clientY - start));
	};

	document.addEventListener(
		'touchstart',
		(e) => {
			const route = document.body.dataset.route;
			if (!document.documentElement.dataset.app || busy || e.touches.length !== 1 || route === 'workspace' || document.body.hasAttribute('data-searching') || pageScroll() > 0) return;
			start = e.touches[0].clientY;
			for (const el of moved()) el.style.transition = 'none';
			ring.style.transition = 'none';
			// On Home the spinner turns under the language line, which stays put.
			const line = atHome() ? document.querySelector('.search-bar .home-pair') : null;
			if (line) ring.style.setProperty('--pull-base', `${line.getBoundingClientRect().bottom}px`);
			else ring.style.removeProperty('--pull-base');
		},
		{ passive: true },
	);
	document.addEventListener('touchmove', follow, { passive: true });

	const end = () => {
		if (start === null) return;
		start = null;
		// Back as a spring settles: quick, then gently.
		const ease = 'transform 0.45s cubic-bezier(0.2, 0.9, 0.25, 1), margin-top 0.45s cubic-bezier(0.2, 0.9, 0.25, 1)';
		for (const el of moved()) el.style.transition = ease;
		if (!ready) {
			ring.style.transition = 'opacity 0.2s';
			show(0);
			return;
		}
		busy = true;
		ring.setAttribute('data-busy', '');
		lines.forEach((l) => (l.style.opacity = ''));
		ring.style.opacity = '1';
		ring.style.setProperty('--gap', String(HOLD));
		// The gap stays open while loading: the page keeps that room above it
		// (on Home, the search box and the page under the logo: app.css).
		for (const el of moved()) el.style.transform = '';
		document.body.style.setProperty('--pull-hold', `${HOLD}px`);
		document.body.toggleAttribute('data-pull-hold', true);
		// Shown a moment at least: a spinner that flashes reads as a glitch.
		Promise.all([refresh(), new Promise((r) => setTimeout(r, 600))])
			.catch((err) => console.error('The page could not be loaded again:', err))
			.finally(() => {
				busy = false;
				ready = false;
				ring.removeAttribute('data-busy');
				ring.style.transition = 'opacity 0.25s';
				ring.style.opacity = '0';
				document.body.toggleAttribute('data-pull-hold', false);
				gap = 0;
			});
	};
	document.addEventListener('touchend', end, { passive: true });
	document.addEventListener('touchcancel', end, { passive: true });
}
