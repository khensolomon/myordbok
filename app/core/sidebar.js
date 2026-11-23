// @ts-check
/**
 * The sidebar (1024px to 1179px, index.html, app.css): what it lists
 * beyond the four tabs, fitted to the window's height.
 *
 *   Learn    pages kept in the sidebar; those that do not fit in its
 *            height, and all of them while it is folded to its icons, are
 *            listed instead by its ⋯ button at the bottom.
 *   Recent   this device's recent searches (data/recent.js), as many as
 *            the room left holds; the full list is on Home.
 *
 * Fitted again when the window's size changes, the sidebar folds or opens,
 * and a page is shown (a search adds to Recent). Under 1024px and from
 * 1180px the sidebar is not shown: everything is put back.
 */
import { h, icon } from './dom.js';
import { ICONS } from './icons.js';
import { definitionHref } from './routes.js';
import { recentSearches } from '../data/recent.js';
import { t } from '../i18n/index.js';

/** The sidebar's widths (app.css). */
const SIDEBAR = window.matchMedia('(min-width: 1024px) and (max-width: 1179px)');
/** Recent searches listed at most. */
const RECENT_MAX = 8;

/**
 * @param {HTMLElement} nav  <nav class="app-nav">
 */
export function initSidebar(nav) {
	const more = nav.querySelector('.app-more');
	const recent = nav.querySelector('.app-recent');
	const recentList = nav.querySelector('.app-recent-list');
	const button = nav.querySelector('.app-overflow');
	if (!(more instanceof HTMLElement) || !(recent instanceof HTMLElement) || !(recentList instanceof HTMLElement) || !(button instanceof HTMLButtonElement)) {
		throw new Error('index.html is missing .app-more, .app-recent (with .app-recent-list) or .app-overflow in <nav class="app-nav">');
	}
	const links = /** @type {HTMLAnchorElement[]} */ ([...more.querySelectorAll('a')]);
	const menu = h('div', { class: 'app-overflow-menu', id: 'app-overflow-menu', role: 'menu', 'aria-label': t('Other pages'), hidden: true });
	button.setAttribute('aria-controls', 'app-overflow-menu');
	document.body.append(menu);

	/** @type {HTMLAnchorElement[]} */
	let overflowed = [];

	const fit = () => {
		close(false);
		for (const link of links) link.removeAttribute('data-overflow');
		more.hidden = false;
		overflowed = [];
		button.hidden = true;
		if (!SIDEBAR.matches) {
			recent.hidden = true;
			return;
		}
		const folded = document.documentElement.hasAttribute('data-folded');
		// Links the page shows at all (Support is not, in the stores' apps).
		const shown = links.filter((l) => l.getClientRects().length > 0);
		const here = location.pathname === '/definition' ? new URL(location.href).searchParams.get('q') : null;
		const words = folded ? [] : recentSearches().slice(0, RECENT_MAX);
		recentList.replaceChildren(
			...words.map((w) =>
				h('a', { href: definitionHref(w), 'aria-current': w === here ? 'page' : null }, icon(ICONS.clock, 16), h('span', null, w)),
			),
		);
		recent.hidden = words.length === 0;
		const tooTall = () => nav.scrollHeight > nav.clientHeight + 1;
		// Recent gives way first: its rows are only a shortcut.
		while (tooTall() && recentList.lastElementChild) recentList.lastElementChild.remove();
		if (!recentList.childElementCount) recent.hidden = true;
		// Then the pages, from the last, to the ⋯ button.
		const fold = folded ? shown : [];
		for (const link of fold) link.setAttribute('data-overflow', '');
		overflowed = [...fold];
		if (overflowed.length) button.hidden = false;
		const left = shown.filter((l) => !l.hasAttribute('data-overflow'));
		while (tooTall() && left.length) {
			button.hidden = false;
			const last = /** @type {HTMLAnchorElement} */ (left.pop());
			last.setAttribute('data-overflow', '');
			overflowed.unshift(last);
		}
		more.hidden = left.length === 0;
	};

	/** @param {boolean} refocus */
	const close = (refocus) => {
		if (menu.hidden) return;
		menu.hidden = true;
		button.setAttribute('aria-expanded', 'false');
		if (refocus) button.focus();
	};
	const open = () => {
		menu.replaceChildren(
			...overflowed.map((l) => {
				const item = h('a', { href: l.href, role: 'menuitem', class: l.className || null, 'aria-current': l.getAttribute('aria-current') }, l.textContent ?? '');
				item.addEventListener('click', () => close(false));
				return item;
			}),
		);
		menu.hidden = false;
		button.setAttribute('aria-expanded', 'true');
		// Beside the button, its bottom in line with the button's.
		const b = button.getBoundingClientRect();
		menu.style.left = `${b.right + 10}px`;
		menu.style.bottom = `${Math.max(12, window.innerHeight - b.bottom)}px`;
		/** @type {HTMLElement | null} */ (menu.querySelector('a'))?.focus({ preventScroll: true });
	};

	button.addEventListener('click', () => (menu.hidden ? open() : close(true)));
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && !menu.hidden) close(true);
	});
	document.addEventListener('pointerdown', (e) => {
		const target = /** @type {Node} */ (e.target);
		if (!menu.hidden && !menu.contains(target) && !button.contains(target)) close(false);
	});
	window.addEventListener('resize', fit);
	SIDEBAR.addEventListener('change', fit);
	window.addEventListener('mo:navigated', fit);
	new MutationObserver(fit).observe(document.documentElement, { attributes: true, attributeFilter: ['data-folded'] });
	fit();
}
