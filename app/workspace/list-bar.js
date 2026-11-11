// @ts-check
/**
 * The head of every list column (Suggestions, Contributions, Searches,
 * Comments, Inbox, Members), the same everywhere:
 *
 *   row 1   the title and a count
 *   row 2   the filters, each a group of segments, as many as the column's
 *           width holds; the ones that do not fit go under ⋯ at the end
 *   row 3   the search box, across the column
 *
 * The groups come in a fixed order of importance and fill the row in that
 * order, whole, never split; widening the column brings the next ones out
 * of ⋯, and with all of them out ⋯ goes. A dot on ⋯ says a group under it
 * is not at its default; Reset puts them all back. Every list has all three
 * rows, so the search box sits in the same place in each section.
 *
 * Also the column's width: on a desktop, the line between the list and the
 * work area is dragged (or moved with the arrow keys once focused) between
 * LIST_MIN and LIST_MAX; double-click resets it. The width is one for every
 * section, kept in this browser (mo:ws-list-width).
 */
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { num, t } from '../i18n/index.js';

/**
 * @typedef {object} Choice
 * @property {string} value
 * @property {string} label  Already in the interface language.
 * @property {number} [count]
 */
/**
 * @typedef {object} Group  One set of choices; each choice is a link.
 * @property {string} title
 * @property {Choice[]} choices
 * @property {string} current
 * @property {string} fallback  Its default.
 * @property {(value: string) => string} href
 */

/**
 * @param {{
 *   title: string,
 *   count: Node | string,
 *   groups?: Group[],
 *   search?: HTMLInputElement | null,
 *   reset?: string,
 * }} o  groups: the filters, most important first. reset: the address with every filter at its default.
 */
export function listBar(o) {
	const head = h('header', { class: 'ws-list-head' }, h('h1', null, o.title), h('span', null, o.count));
	const groups = o.groups ?? [];
	const inline = groups.map((g) =>
		h(
			'nav',
			{ class: 'ws-segments', 'aria-label': g.title },
			g.choices.map((c) => h('a', { href: g.href(c.value), 'aria-current': c.value === g.current ? 'true' : null }, c.label, c.count ? h('span', { class: 'ws-count' }, num(c.count)) : '')),
		),
	);
	const wrap = h('div', { class: 'ws-more-wrap', hidden: true });
	const bar = h('div', { class: 'ws-filterbar' }, inline, wrap);
	const rows = [head, bar];
	if (o.search) rows.push(h('label', { class: 'ws-search' }, icon(ICONS.search, 14), o.search));
	if (!groups.length) return rows;

	let shown = -1;
	/** The first groups that fit stay in the row, the rest go under ⋯. */
	const fit = () => {
		if (!bar.isConnected || !bar.clientWidth) return;
		inline.forEach((n) => (n.hidden = false));
		wrap.hidden = true;
		let n = groups.length;
		if (bar.scrollWidth > bar.clientWidth) {
			wrap.hidden = false;
			while (n > 0 && bar.scrollWidth > bar.clientWidth) inline[--n].hidden = true;
		}
		if (n === shown) return;
		shown = n;
		wrap.replaceChildren(...(n < groups.length ? moreMenu(groups.slice(n), o.reset ?? '') : []));
	};
	// Each change of width fits the row again, once per frame.
	let frame = 0;
	const watch = new ResizeObserver(() => {
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(fit);
	});
	watch.observe(bar);
	return rows;
}

/**
 * ⋯ and its panel.
 * @param {Group[]} groups
 * @param {string} reset
 */
function moreMenu(groups, reset) {
	const changed = groups.some((g) => g.current !== g.fallback);
	const id = `ws-more-${Math.random().toString(36).slice(2, 8)}`;
	const button = h(
		'button',
		{ type: 'button', class: 'ws-more-button', 'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-controls': id, 'aria-label': changed ? t('More filters (some on)') : t('More filters'), title: t('More filters') },
		h('span', { 'aria-hidden': 'true' }, '⋯'),
		changed ? h('span', { class: 'ws-more-dot', 'aria-hidden': 'true' }) : '',
	);
	const panel = h(
		'div',
		{ class: 'ws-more-panel', id, hidden: true },
		groups.map((g) =>
			h(
				'section',
				{ class: 'ws-more-group' },
				h('h2', null, g.title),
				h(
					'ul',
					null,
					g.choices.map((c) =>
						h(
							'li',
							null,
							h('a', { href: g.href(c.value), 'aria-current': c.value === g.current ? 'true' : null }, h('span', { class: 'ws-more-tick', 'aria-hidden': 'true' }, c.value === g.current ? icon(ICONS.check, 14) : ''), c.label, c.count ? h('span', { class: 'ws-count' }, num(c.count)) : ''),
						),
					),
				),
			),
		),
		changed && reset ? h('a', { class: 'ws-more-reset', href: reset }, t('Reset')) : '',
	);
	const close = () => {
		panel.hidden = true;
		button.setAttribute('aria-expanded', 'false');
		document.removeEventListener('pointerdown', outside, true);
		document.removeEventListener('keydown', escape);
	};
	const outside = (/** @type {Event} */ e) => {
		if (!button.parentElement?.contains(/** @type {Node} */ (e.target))) close();
	};
	const escape = (/** @type {KeyboardEvent} */ e) => {
		if (e.key !== 'Escape') return;
		close();
		button.focus();
	};
	button.addEventListener('click', () => {
		if (!panel.hidden) return close();
		panel.hidden = false;
		button.setAttribute('aria-expanded', 'true');
		document.addEventListener('pointerdown', outside, true);
		document.addEventListener('keydown', escape);
		/** @type {HTMLElement | null} */ (panel.querySelector('a[aria-current], a'))?.focus();
	});
	panel.addEventListener('click', (e) => {
		if (/** @type {HTMLElement} */ (e.target).closest('a')) close();
	});
	return [button, panel];
}

const WIDTH_KEY = 'mo:ws-list-width';
export const LIST_MIN = 240;
export const LIST_MAX = 560;
const LIST_DEFAULT = 300;

/** @param {number} w */
const clamp = (w) => Math.round(Math.min(LIST_MAX, Math.max(LIST_MIN, w)));

/**
 * The list column's width, from this browser, onto the workspace.
 * @param {HTMLElement} root  The .ws element.
 */
export function listWidth(root) {
	let w = LIST_DEFAULT;
	try {
		const kept = Number(localStorage.getItem(WIDTH_KEY));
		if (kept) w = clamp(kept);
	} catch {
		// storage blocked: the default width
	}
	root.style.setProperty('--ws-list-w', `${w}px`);
	return w;
}

/**
 * The handle between the list and the work area.
 * @param {HTMLElement} root  The .ws element.
 * @param {HTMLElement} list  The list column.
 */
export function listResizer(root, list) {
	let width = listWidth(root);
	const handle = h('div', {
		class: 'ws-resizer',
		role: 'separator',
		'aria-orientation': 'vertical',
		'aria-label': t('Width of the list'),
		'aria-valuemin': LIST_MIN,
		'aria-valuemax': LIST_MAX,
		'aria-valuenow': width,
		tabindex: 0,
		title: t('Drag to resize; double-click to reset'),
	});
	/** @param {number} w @param {boolean} keep */
	const set = (w, keep) => {
		width = clamp(w);
		root.style.setProperty('--ws-list-w', `${width}px`);
		handle.setAttribute('aria-valuenow', String(width));
		if (!keep) return;
		try {
			localStorage.setItem(WIDTH_KEY, String(width));
		} catch {
			// storage blocked: this visit only
		}
	};
	handle.addEventListener('pointerdown', (e) => {
		e.preventDefault();
		handle.setPointerCapture(e.pointerId);
		const left = list.getBoundingClientRect().left;
		root.toggleAttribute('data-resizing', true);
		const move = (/** @type {PointerEvent} */ m) => set(m.clientX - left, false);
		const up = () => {
			handle.removeEventListener('pointermove', move);
			handle.removeEventListener('pointerup', up);
			handle.removeEventListener('pointercancel', up);
			root.removeAttribute('data-resizing');
			set(width, true);
		};
		handle.addEventListener('pointermove', move);
		handle.addEventListener('pointerup', up);
		handle.addEventListener('pointercancel', up);
	});
	handle.addEventListener('dblclick', () => set(LIST_DEFAULT, true));
	handle.addEventListener('keydown', (e) => {
		const step = e.shiftKey ? 48 : 16;
		if (e.key === 'ArrowLeft') set(width - step, true);
		else if (e.key === 'ArrowRight') set(width + step, true);
		else if (e.key === 'Home') set(LIST_MIN, true);
		else if (e.key === 'End') set(LIST_MAX, true);
		else return;
		e.preventDefault();
	});
	list.append(handle);
	return handle;
}
