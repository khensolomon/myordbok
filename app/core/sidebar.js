// @ts-check
/**
 * The sidebar (1024px to 1179px; index.html, app.css), as a tablet's own:
 *
 *   folding     its button (top right), or the sidebar dragged sideways: it
 *               follows the finger (or the mouse, by its edge) and settles
 *               open or folded by where it is let go and how fast it was
 *               moving; kept on this device (mo:sidebar). Folded, its
 *               pages are listed by the ⋯ button at its foot.
 *   counts      Practice: the words due today (while practice is shown);
 *               Workspace (members): what waits there. Under 1024px the
 *               tab bar shows the first as a count, the second as a dot on
 *               More.
 *   Grammar     opens to its topics, each its own page; kept on this device
 *               (mo:sidebar-grammar).
 *   foot        the practice streak and the words learned.
 *
 * The drag listens to pointers only; the sidebar is `touch-action: pan-y`,
 * so a vertical move stays the browser's own and nothing waits on a script.
 */
import { h } from './dom.js';
import { member } from './member.js';
import { workspaceSummary } from '../data/api.js';
import { grammarIndex } from '../data/grammar.js';
import { progress, quizShown } from '../data/quiz-store.js';
import { dayOf, dueWords, learnedCount, streakOf } from '#shared/quiz.js';
import { getLang, num, t, tn } from '../i18n/index.js';

/** The sidebar's widths (app.css). */
const SIDEBAR = window.matchMedia('(min-width: 1024px) and (max-width: 1179px)');
/** Its width open and folded, in pixels (app.css, --nav-room). */
const OPEN = 248;
const FOLDED = 72;
/** How far a pointer moves before it is a drag, not a tap. */
const SLOP = 8;
/** A flick this fast (pixels per millisecond) settles the way it went. */
const FLICK = 0.35;
/** The workspace's count is asked again after this long, at most. */
const SUMMARY_EVERY = 60_000;

/**
 * @param {HTMLElement} nav  <nav class="app-nav">
 */
export function initSidebar(nav) {
	/** @template {Element} T @param {string} sel @param {new () => T} type @returns {T} */
	const need = (sel, type) => {
		const el = nav.querySelector(sel);
		if (!(el instanceof type)) throw new Error(`index.html is missing ${sel} in <nav class="app-nav">`);
		return el;
	};
	const fold = need('.app-fold', HTMLButtonElement);
	const overflow = need('.app-overflow', HTMLButtonElement);
	const more = need('.app-more', HTMLElement);
	const disclose = need('.app-disclose', HTMLButtonElement);
	const topics = need('.app-topics', HTMLElement);
	const streak = need('.app-streak', HTMLElement);
	const workspace = need('.app-workspace', HTMLAnchorElement);
	const practiceCount = need('[data-tab="practice"] .app-count', HTMLElement);
	const moreDot = need('[data-tab="more"] .app-count', HTMLElement);
	const workspaceCount = need('.app-workspace .app-count', HTMLElement);

	// Folding.
	/** @param {boolean} folded @param {boolean} keep */
	const setFolded = (folded, keep) => {
		document.documentElement.toggleAttribute('data-folded', folded);
		nav.dataset.look = folded ? 'folded' : 'open';
		fold.setAttribute('aria-expanded', String(!folded));
		fold.setAttribute('aria-label', folded ? t('Show the sidebar') : t('Hide the sidebar'));
		overflow.hidden = !folded;
		if (folded) closeMenu(false);
		if (!keep) return;
		try {
			localStorage.setItem('mo:sidebar', folded ? 'folded' : 'open');
		} catch {
			// Not kept on this device (a private window): for this visit only.
		}
	};
	try {
		setFolded(localStorage.getItem('mo:sidebar') === 'folded', false);
	} catch {
		setFolded(false, false);
	}
	fold.addEventListener('click', () => setFolded(!document.documentElement.hasAttribute('data-folded'), true));
	drag(nav, (folded) => setFolded(folded, true));

	// Folded, the pages are under ⋯: a menu beside it.
	const menu = h('div', { class: 'app-overflow-menu', id: 'app-overflow-menu', role: 'menu', 'aria-label': t('Other pages'), hidden: true });
	overflow.setAttribute('aria-controls', 'app-overflow-menu');
	document.body.append(menu);
	/** @param {boolean} refocus */
	function closeMenu(refocus) {
		if (menu.hidden) return;
		menu.hidden = true;
		overflow.setAttribute('aria-expanded', 'false');
		if (refocus) overflow.focus();
	}
	const openMenu = () => {
		const pages = /** @type {HTMLAnchorElement[]} */ ([...more.querySelectorAll('.app-grammar-link, :scope > a')]).filter((l) => !l.closest('[data-store-hidden]') || getComputedStyle(l).display !== 'none');
		menu.replaceChildren(
			...pages.map((l) => {
				const item = h('a', { href: l.href, role: 'menuitem', class: l.classList.contains('app-support') ? 'app-support' : null, 'aria-current': l.getAttribute('aria-current') }, l.textContent ?? '');
				item.addEventListener('click', () => closeMenu(false));
				return item;
			}),
		);
		menu.hidden = false;
		overflow.setAttribute('aria-expanded', 'true');
		const b = overflow.getBoundingClientRect();
		menu.style.left = `${b.right + 10}px`;
		menu.style.bottom = `${Math.max(12, window.innerHeight - b.bottom)}px`;
		/** @type {HTMLElement | null} */ (menu.querySelector('a'))?.focus({ preventScroll: true });
	};
	overflow.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu(true)));
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && !menu.hidden) closeMenu(true);
	});
	document.addEventListener('pointerdown', (e) => {
		const target = /** @type {Node} */ (e.target);
		if (!menu.hidden && !menu.contains(target) && !overflow.contains(target)) closeMenu(false);
	});
	SIDEBAR.addEventListener('change', () => closeMenu(false));

	// Grammar's topics, listed once asked for.
	let listed = false;
	/** @param {boolean} open @param {boolean} keep */
	const showTopics = async (open, keep) => {
		disclose.setAttribute('aria-expanded', String(open));
		topics.hidden = !open;
		if (keep) {
			try {
				localStorage.setItem('mo:sidebar-grammar', open ? 'open' : 'closed');
			} catch {
				// Not kept on this device: for this visit only.
			}
		}
		if (!open || listed) return;
		listed = true;
		try {
			const index = await grammarIndex();
			const my = getLang() === 'my';
			topics.replaceChildren(
				...index.topics.map((topic) =>
					h('a', { href: `/grammar/${topic.slug}` }, h('span', { lang: my ? 'my' : 'en' }, my ? topic.my : topic.name), my ? null : h('span', { class: 'app-topic-my', lang: 'my' }, topic.my)),
				),
			);
			markCurrent();
		} catch (err) {
			listed = false;
			topics.replaceChildren(h('p', { class: 'app-topics-note' }, err instanceof Error ? err.message : String(err)));
		}
	};
	disclose.addEventListener('click', () => showTopics(topics.hidden, true));
	let grammarOpen = false;
	try {
		grammarOpen = localStorage.getItem('mo:sidebar-grammar') === 'open';
	} catch {
		// Closed, as at first.
	}
	if (grammarOpen) showTopics(true, false);
	const markCurrent = () => {
		for (const a of topics.querySelectorAll('a')) {
			if (new URL(a.href).pathname === location.pathname) a.setAttribute('aria-current', 'page');
			else a.removeAttribute('aria-current');
		}
	};

	// What waits: Practice (this device's progress), Workspace (the server's).
	/** @param {HTMLElement} el @param {number} n */
	const count = (el, n) => {
		el.hidden = n <= 0;
		el.textContent = n > 99 ? '99+' : num(n);
	};
	const practice = () => {
		const p = progress();
		const today = dayOf();
		const shown = quizShown();
		count(practiceCount, shown ? dueWords(p, today).length : 0);
		const days = shown ? streakOf(p, today) : 0;
		const learned = shown ? learnedCount(p) : 0;
		streak.hidden = days === 0 && learned === 0;
		streak.replaceChildren(
			days ? h('span', null, h('strong', null, num(days)), ' ', tn('day in a row', 'days in a row', days)) : '',
			learned ? h('span', null, h('strong', null, num(learned)), ' ', t('words learned')) : '',
		);
	};
	let asked = 0;
	const waiting = async (force = false) => {
		const me = await member().catch(() => null);
		workspace.hidden = !me;
		if (!me) {
			count(workspaceCount, 0);
			moreDot.hidden = true;
			return;
		}
		if (!force && Date.now() - asked < SUMMARY_EVERY) return;
		asked = Date.now();
		const s = await workspaceSummary().catch(() => null);
		if (!s) return;
		// An admin's own answers show in the Inbox they already count (as on More).
		const n = (s.waiting ?? 0) + (s.unread ?? 0) + (s.unread === undefined ? s.answers : 0);
		count(workspaceCount, n);
		moreDot.hidden = n <= 0;
		moreDot.textContent = '';
	};
	window.addEventListener('mo:navigated', () => {
		practice();
		markCurrent();
		waiting().catch(() => {});
	});
	document.addEventListener('mo:member', () => waiting(true).catch(() => {}));
	practice();
	waiting(true).catch(() => {});
}

/**
 * The sidebar follows a finger dragged sideways on it, or the mouse by its
 * edge, and settles open or folded when let go.
 * @param {HTMLElement} nav
 * @param {(folded: boolean) => void} settle
 */
function drag(nav, settle) {
	const edge = h('div', { class: 'app-nav-edge', 'aria-hidden': 'true' });
	nav.append(edge);
	/** @type {{ id: number, x: number, y: number, from: number, dragging: boolean, last: Array<[number, number]> } | null} */
	let held = null;
	let swallow = false;

	nav.addEventListener('pointerdown', (e) => {
		if (!SIDEBAR.matches || !e.isPrimary || e.button !== 0) return;
		// A mouse drags by the edge only: elsewhere it clicks and selects.
		if (e.pointerType === 'mouse' && e.target !== edge) return;
		held = { id: e.pointerId, x: e.clientX, y: e.clientY, from: nav.getBoundingClientRect().width, dragging: false, last: [[e.timeStamp, e.clientX]] };
		// By the edge the pointer leaves the sidebar at once: it is held from the start.
		if (e.target === edge) {
			e.preventDefault();
			nav.setPointerCapture(e.pointerId);
		}
	});
	nav.addEventListener('pointermove', (e) => {
		if (!held || e.pointerId !== held.id) return;
		const dx = e.clientX - held.x;
		if (!held.dragging) {
			if (Math.abs(e.clientY - held.y) > SLOP && Math.abs(e.clientY - held.y) > Math.abs(dx)) {
				held = null;
				return;
			}
			if (Math.abs(dx) < SLOP) return;
			held.dragging = true;
			nav.setPointerCapture(e.pointerId);
			document.documentElement.setAttribute('data-nav-dragging', '');
		}
		let w = held.from + dx;
		// Past either end it gives, as a rubber band.
		if (w > OPEN) w = OPEN + (w - OPEN) * 0.25;
		if (w < FOLDED) w = FOLDED - (FOLDED - w) * 0.25;
		nav.style.width = `${w}px`;
		// Its look follows the width (the page's room changes once let go).
		nav.dataset.look = w < (OPEN + FOLDED) / 2 ? 'folded' : 'open';
		held.last.push([e.timeStamp, e.clientX]);
		if (held.last.length > 6) held.last.shift();
	});
	/** @param {PointerEvent} e */
	const end = (e) => {
		if (!held || e.pointerId !== held.id) return;
		const was = held;
		held = null;
		if (!was.dragging) return;
		swallow = true;
		setTimeout(() => (swallow = false), 0);
		const w = nav.getBoundingClientRect().width;
		const [t0, x0] = was.last[0];
		const speed = e.timeStamp > t0 ? (e.clientX - x0) / (e.timeStamp - t0) : 0;
		const folded = speed < -FLICK ? true : speed > FLICK ? false : w < (OPEN + FOLDED) / 2;
		document.documentElement.removeAttribute('data-nav-dragging');
		// From where the finger left it to where it settles, by the CSS transition.
		nav.style.width = '';
		settle(folded);
		document.dispatchEvent(new CustomEvent('mo:haptic', { detail: 'selection' }));
	};
	nav.addEventListener('pointerup', end);
	nav.addEventListener('pointercancel', end);
	// A drag that ends on a link is not a tap on it.
	nav.addEventListener(
		'click',
		(e) => {
			if (!swallow) return;
			e.preventDefault();
			e.stopPropagation();
		},
		true,
	);
}
