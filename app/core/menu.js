// @ts-check
/**
 * The person button of the classic header (1180px and up, index.html):
 * a click opens the You page (reader/you.js) in a panel under the button,
 * as the website's person menu always did; under 1180px the button is not
 * shown and You is a tab. The button stays a link to /you for when scripts
 * do not run. Esc, a click outside or following a link closes the panel;
 * focus returns to the button.
 */
import { h } from './dom.js';
import { t } from '../i18n/index.js';

/** @param {HTMLAnchorElement} you */
export function initMenu(you) {
	const panel = h('div', { class: 'you-menu', id: 'you-menu', role: 'dialog', 'aria-label': t('You'), hidden: true });
	you.setAttribute('aria-haspopup', 'dialog');
	you.setAttribute('aria-controls', 'you-menu');
	you.setAttribute('aria-expanded', 'false');
	document.body.append(panel);

	/** @param {boolean} refocus */
	const close = (refocus) => {
		if (panel.hidden) return;
		panel.hidden = true;
		you.setAttribute('aria-expanded', 'false');
		if (refocus) you.focus();
	};
	const open = async () => {
		panel.hidden = false;
		you.setAttribute('aria-expanded', 'true');
		place(panel, you);
		panel.replaceChildren(h('p', { class: 'you-loading' }, t('Loading…')));
		const page = await import('../reader/you.js');
		const back = location.pathname + location.search;
		panel.replaceChildren(await page.view({ query: new URLSearchParams({ return: back }) }));
		place(panel, you);
		/** @type {HTMLElement | null} */ (panel.querySelector('a, button'))?.focus({ preventScroll: true });
	};

	you.addEventListener('click', (e) => {
		e.preventDefault();
		if (panel.hidden) open().catch((err) => panel.replaceChildren(h('p', { class: 'you-loading' }, err instanceof Error ? err.message : String(err))));
		else close(true);
	});
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && !panel.hidden) close(true);
	});
	document.addEventListener('pointerdown', (e) => {
		const target = /** @type {Node} */ (e.target);
		if (!panel.hidden && !panel.contains(target) && !you.contains(target)) close(false);
	});
	panel.addEventListener('click', (e) => {
		if (/** @type {HTMLElement} */ (e.target).closest('a')) close(false);
	});
	window.addEventListener('resize', () => !panel.hidden && place(panel, you));
	// The button goes with the classic header under 1180px: so does the panel.
	window.matchMedia('(min-width: 1180px)').addEventListener('change', (e) => !e.matches && close(false));
}

/**
 * Under the button, its right edge in line with the button's.
 * @param {HTMLElement} panel
 * @param {HTMLElement} you
 */
function place(panel, you) {
	const b = you.getBoundingClientRect();
	const page = document.documentElement.clientWidth;
	panel.style.top = `${b.bottom + 10}px`;
	panel.style.right = `${Math.max(12, page - b.right)}px`;
	panel.style.width = `${Math.min(380, page - 24)}px`;
}
