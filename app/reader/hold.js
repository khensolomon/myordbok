// @ts-check
/**
 * A meaning touched and held opens its menu, as a phone's own lists do:
 * the meaning lifts over a dimmed page and its actions show under it (or
 * above, near the bottom of the screen). Under 641px, where the rows carry
 * no buttons of their own (app.css); a right click there opens it too.
 *
 * The touch listeners are passive: they only time the finger, never hold
 * the scroll. A finger that moves is scrolling, and no menu opens. The tap
 * that ends a hold is not taken as a tap on what lies under it.
 */
import { h, icon } from '../core/dom.js';
import { t } from '../i18n/index.js';

/** How long a finger stays before the menu opens, in milliseconds. */
const HOLD_MS = 450;
/** How far it may wander meanwhile, in pixels. */
const SLOP = 8;
/** Where the menu is offered: the phones' layout (app.css, 640px). */
const NARROW = window.matchMedia('(max-width: 640px)');

/**
 * @typedef {object} HoldAction
 * @property {string} label
 * @property {string} glyph  An icon from ICONS.
 * @property {() => void} run
 * @property {() => boolean} [on]  Pressed now (a rating given): shown checked.
 */

/** The menu open now, so a second hold does not open another. */
let open = false;
/** A hold opened the menu and its finger is still down. */
let lifting = false;
/** Until when a click is the lifting of that finger, not a tap. */
let swallowUntil = 0;
document.addEventListener(
	'pointerup',
	() => {
		if (!lifting) return;
		lifting = false;
		swallowUntil = Date.now() + 350;
	},
	{ capture: true, passive: true },
);
document.addEventListener(
	'click',
	(e) => {
		// The menu's own buttons always answer.
		if (Date.now() < swallowUntil && !(e.target instanceof Element && e.target.closest('.hold-layer'))) {
			e.preventDefault();
			e.stopPropagation();
		}
	},
	true,
);

/**
 * @param {HTMLElement} row  A meaning's row.
 * @param {HoldAction[]} actions
 */
export function holdMenu(row, actions) {
	/** @type {number | undefined} */
	let timer;
	let x = 0;
	let y = 0;
	const stop = () => clearTimeout(timer);
	row.addEventListener(
		'pointerdown',
		(e) => {
			if (!NARROW.matches || open || e.pointerType === 'mouse' || !e.isPrimary) return;
			x = e.clientX;
			y = e.clientY;
			timer = window.setTimeout(() => {
				lifting = true;
				show(row, actions);
			}, HOLD_MS);
		},
		{ passive: true },
	);
	row.addEventListener(
		'pointermove',
		(e) => {
			if (Math.abs(e.clientX - x) > SLOP || Math.abs(e.clientY - y) > SLOP) stop();
		},
		{ passive: true },
	);
	row.addEventListener('pointerup', stop, { passive: true });
	row.addEventListener('pointercancel', stop, { passive: true });
	// A right click, or Android's own long press, where the menu is offered.
	row.addEventListener('contextmenu', (e) => {
		if (!NARROW.matches) return;
		e.preventDefault();
		stop();
		if (!open) show(row, actions);
	});
}

/**
 * @param {HTMLElement} row
 * @param {HoldAction[]} actions
 */
function show(row, actions) {
	open = true;
	document.dispatchEvent(new CustomEvent('mo:haptic', { detail: 'impact' }));
	const rect = row.getBoundingClientRect();
	// The meaning as it reads, lifted over the dimmed page; its buttons left behind.
	const lifted = /** @type {HTMLElement} */ (row.cloneNode(true));
	lifted.querySelectorAll('.sense-tools, .sense-editor').forEach((el) => el.remove());
	lifted.removeAttribute('data-sense-id');
	const card = h('div', { class: 'hold-card', 'aria-hidden': 'true' }, lifted);
	card.style.left = `${rect.left}px`;
	card.style.width = `${rect.width}px`;
	const buttons = actions.map((a) => {
		const b = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', role: 'menuitemcheckbox', class: 'hold-item', 'aria-checked': a.on ? String(a.on()) : null }, h('span', null, a.label), icon(a.glyph, 20)));
		if (!a.on) b.setAttribute('role', 'menuitem');
		b.addEventListener('click', () => {
			close();
			a.run();
		});
		return b;
	});
	const menu = h('div', { class: 'hold-menu', role: 'menu', 'aria-label': t('This meaning') }, buttons);
	const shade = h('div', { class: 'hold-shade' });
	const layer = h('div', { class: 'hold-layer' }, shade, card, menu);
	const close = () => {
		open = false;
		layer.remove();
		document.removeEventListener('keydown', keys);
		row.focus?.();
	};
	/** @param {KeyboardEvent} e */
	const keys = (e) => {
		if (e.key === 'Escape') close();
	};
	shade.addEventListener('click', close);
	document.addEventListener('keydown', keys);
	document.body.append(layer);
	// Placed once sizes are known: the card where the row was, kept on screen;
	// the menu under it, or above it when there is no room below.
	const room = window.innerHeight;
	const cardHeight = card.offsetHeight;
	const menuHeight = menu.offsetHeight;
	const gap = 10;
	let top = Math.min(Math.max(rect.top, 60), room - cardHeight - menuHeight - gap - 24);
	top = Math.max(top, 60);
	const below = top + cardHeight + gap + menuHeight <= room - 16;
	card.style.top = `${below ? top : Math.max(60, room - 16 - menuHeight - gap - cardHeight)}px`;
	menu.style.left = `${rect.left}px`;
	menu.style.top = `${below ? top + cardHeight + gap : Math.max(60, room - 16 - menuHeight - gap - cardHeight) + cardHeight + gap}px`;
	buttons[0]?.focus({ preventScroll: true });
}
