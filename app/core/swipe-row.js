// @ts-check
/**
 * A row swiped to the left shows its action under it, as a phone's own
 * lists do (it has none on its left: swiped right, it stays): let go past half the action's width and the row stays open
 * on it; swiped most of the way across, the action is taken at once (a
 * light tap is felt when that point is passed). A tap elsewhere, or on the
 * row, closes it. On a touch screen under 1024px only, where the rows are
 * a list; elsewhere the row keeps its own buttons (app.css).
 *
 * The row is `touch-action: pan-y` (app.css): the browser keeps vertical
 * scrolling to itself and hands over sideways moves, so the listeners
 * never hold the page. One row is open at a time.
 */
import { h } from './dom.js';

/** Where the action is offered: a touch screen, in the layout of rows (under 1024px). */
const TOUCH = window.matchMedia('(pointer: coarse) and (max-width: 1023px)');
/** Width of the action button, in pixels. */
const ACTION_W = 88;
/** How far a finger moves before it is a swipe, not a tap or a scroll. */
const SLOP = 8;
/** Past this share of the row's width, letting go takes the action. */
const FULL = 0.6;
/** A flick this fast (pixels per millisecond) opens or closes the row. */
const FLICK = 0.3;

/** @type {(() => void) | null} The open row's closing. */
let closeOpen = null;
document.addEventListener(
	'pointerdown',
	(e) => {
		if (closeOpen && !(e.target instanceof Element && e.target.closest('.swipe-row[data-open]'))) closeOpen();
	},
	{ capture: true, passive: true },
);

/**
 * @param {HTMLElement} row  The list item; its children slide.
 * @param {{ label: string, run: () => void }} action  Destructive: shown red.
 */
export function swipeRow(row, action) {
	const button = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'swipe-action', tabindex: '-1' }, action.label));
	const content = h('div', { class: 'swipe-content' }, ...row.childNodes);
	row.classList.add('swipe-row');
	row.append(h('div', { class: 'swipe-under', 'aria-hidden': 'true' }, button), content);

	let offset = 0;
	/** @type {{ id: number, x: number, y: number, from: number, swiping: boolean, last: Array<[number, number]>, past: boolean } | null} */
	let held = null;
	let swallow = false;

	/** @param {number} x @param {boolean} animate */
	const place = (x, animate) => {
		offset = x;
		content.style.transition = animate ? 'transform 0.32s cubic-bezier(0.2, 0.9, 0.25, 1)' : 'none';
		content.style.transform = x ? `translateX(${x}px)` : '';
		// The red under the row shows only while it is moved: at rest none
		// shows through the box's rounded corners.
		if (x) row.setAttribute('data-moved', '');
		else if (!animate) row.removeAttribute('data-moved');
		// The action grows with the swipe past its own width, as a phone's does.
		button.style.width = `${Math.max(ACTION_W, -x)}px`;
		button.style.transition = content.style.transition.replace('transform', 'width');
	};
	const close = () => {
		place(0, true);
		setTimeout(() => offset === 0 && row.removeAttribute('data-moved'), 340);
		row.removeAttribute('data-open');
		if (closeOpen === close) closeOpen = null;
	};
	const open = () => {
		if (closeOpen && closeOpen !== close) closeOpen();
		place(-ACTION_W, true);
		row.setAttribute('data-open', '');
		closeOpen = close;
	};
	const take = () => {
		if (closeOpen === close) closeOpen = null;
		// Across, then folded away, then gone.
		place(-row.offsetWidth, true);
		row.style.height = `${row.offsetHeight}px`;
		setTimeout(() => {
			row.classList.add('swipe-gone');
			row.style.height = '0px';
		}, 180);
		setTimeout(action.run, 420);
	};
	button.addEventListener('click', take);

	content.addEventListener('pointerdown', (e) => {
		if (!TOUCH.matches || e.pointerType === 'mouse' || !e.isPrimary) return;
		held = { id: e.pointerId, x: e.clientX, y: e.clientY, from: offset, swiping: false, last: [[e.timeStamp, e.clientX]], past: false };
	});
	content.addEventListener('pointermove', (e) => {
		if (!held || e.pointerId !== held.id) return;
		const dx = e.clientX - held.x;
		if (!held.swiping) {
			if (Math.abs(e.clientY - held.y) > SLOP) {
				held = null;
				return;
			}
			if (Math.abs(dx) < SLOP) return;
			held.swiping = true;
			content.setPointerCapture(e.pointerId);
			if (closeOpen && closeOpen !== close) closeOpen();
		}
		let x = held.from + dx;
		// Its actions are on the right only: to the right of closed it does not move.
		if (x > 0) x = 0;
		place(x, false);
		const past = -x > row.offsetWidth * FULL;
		if (past !== held.past) {
			held.past = past;
			if (past) document.dispatchEvent(new CustomEvent('mo:haptic', { detail: 'impact' }));
		}
		held.last.push([e.timeStamp, e.clientX]);
		if (held.last.length > 6) held.last.shift();
	});
	/** @param {PointerEvent} e */
	const end = (e) => {
		if (!held || e.pointerId !== held.id) return;
		const was = held;
		held = null;
		if (!was.swiping) {
			// A tap on an open row closes it, and does not open its link.
			if (row.hasAttribute('data-open')) {
				swallow = true;
				close();
			}
			return;
		}
		swallow = true;
		const [t0, x0] = was.last[0];
		const speed = e.timeStamp > t0 ? (e.clientX - x0) / (e.timeStamp - t0) : 0;
		if (was.past && e.type === 'pointerup') take();
		else if (speed < -FLICK || (speed <= FLICK && -offset > ACTION_W / 2)) open();
		else close();
	};
	content.addEventListener('pointerup', end);
	content.addEventListener('pointercancel', end);
	content.addEventListener(
		'click',
		(e) => {
			if (!swallow) return;
			swallow = false;
			e.preventDefault();
			e.stopPropagation();
		},
		true,
	);
	// A swipe that was no tap leaves no click to swallow: forget it.
	content.addEventListener('pointerdown', () => (swallow = false), { capture: true });
}
