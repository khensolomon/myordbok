// @ts-check
/**
 * The stage: the layout Liked and Practice share. One ground under the
 * site's top bar, a card in the middle holding the chosen thing, a small
 * palette of tools at the top right, and the words along the bottom as a
 * strip of chips (a listbox: ← → move the choice, the card follows).
 * Narrower than 761px the same parts stand in a column: the palette's
 * filters as a segmented row, then either the list (the strip, upright)
 * or the card with Back, by `data-view`.
 *
 * The chosen chip is in the address (?w=…), so Back, reload and a shared
 * link keep it. While a round plays (`setPlaying`) the palette and strip
 * fade out and the card has the ground to itself.
 */
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { t } from '../i18n/index.js';

/** Under this width the stage stands in a column. */
export const NARROW = matchMedia('(max-width: 760px)');

/**
 * @typedef {object} Tool
 * @property {string} id
 * @property {string} icon  A path of ICONS.
 * @property {string} label
 * @property {boolean} [pressed]  A filter that is on.
 * @property {number} [count]  Shown small on the tool.
 * @property {boolean} [filter]  Part of the segmented row on phones.
 * @property {() => void} press
 */
/**
 * @typedef {object} StageOptions
 * @property {'liked' | 'practice'} page
 * @property {import('../core/routes.js').ViewContext} ctx
 * @property {(id: string | null) => void} onChoose  A chip chosen (null: none, the list on a phone).
 * @property {(q: string) => void} [onFind]  Text typed in the find field.
 */

/**
 * @param {StageOptions} o
 */
export function stage(o) {
	const palette = h('div', { class: 'stage-palette', role: 'toolbar', 'aria-label': t('Tools') });
	const findInput = /** @type {HTMLInputElement} */ (h('input', { type: 'search', class: 'stage-find-input', placeholder: t('Find a word'), autocomplete: 'off', spellcheck: 'false', 'aria-label': t('Find a word') }));
	const findClose = h('button', { type: 'button', class: 'stage-find-close', 'aria-label': t('Close') }, icon(ICONS.close, 14));
	const find = h('div', { class: 'stage-find', hidden: true }, icon(ICONS.search, 16), findInput, findClose);
	const card = h('div', { class: 'stage-card' });
	const back = h('a', { class: 'stage-back', href: location.pathname, 'aria-label': t('Back') }, icon(ICONS.back, 22));
	const strip = h('ul', { class: 'stage-strip', role: 'listbox', 'aria-label': t('Words') });
	const root = h('section', { class: 'stage', 'data-page': o.page, 'data-view': 'list' }, palette, find, back, card, strip);

	/** @type {import('./stage-data.js').Chip[]} */
	let chips = [];
	/** @type {string | null} */
	let chosen = null;

	const openFind = () => {
		find.hidden = false;
		palette.hidden = true;
		findInput.focus();
	};
	const closeFind = () => {
		find.hidden = true;
		palette.hidden = false;
		if (findInput.value) {
			findInput.value = '';
			o.onFind?.('');
		}
	};
	findInput.addEventListener('input', () => o.onFind?.(findInput.value));
	findInput.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') {
			e.preventDefault();
			closeFind();
		}
	});
	findClose.addEventListener('click', closeFind);

	/** The address's `w`, with the chip chosen; on a phone a new page (Back returns to the list). */
	const choose = (/** @type {string | null} */ id, /** @type {boolean} */ byUser) => {
		chosen = id;
		const url = new URL(location.href);
		if (id) url.searchParams.set('w', id);
		else url.searchParams.delete('w');
		const here = url.pathname + url.search;
		if (here !== location.pathname + location.search) {
			if (byUser && NARROW.matches) o.ctx.go(here);
			else o.ctx.replace(here);
		}
		root.dataset.view = id ? 'card' : 'list';
		for (const li of strip.children) {
			const on = /** @type {HTMLElement} */ (li).dataset.id === id;
			li.setAttribute('aria-selected', String(on));
			li.classList.toggle('is-on', on);
			if (on && !NARROW.matches) li.scrollIntoView({ block: 'nearest', inline: 'nearest' });
		}
		o.onChoose(id);
	};

	strip.addEventListener('click', (e) => {
		const li = /** @type {HTMLElement | null} */ ((/** @type {Element} */ (e.target)).closest('li[data-id]'));
		if (li) choose(li.dataset.id ?? null, true);
	});
	strip.addEventListener('keydown', (e) => {
		const ids = chips.map((c) => c.id);
		const at = chosen ? ids.indexOf(chosen) : -1;
		let next = at;
		if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(at + 1, ids.length - 1);
		else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = Math.max(at - 1, 0);
		else if (e.key === 'Home') next = 0;
		else if (e.key === 'End') next = ids.length - 1;
		else if (e.key === 'Enter' && NARROW.matches && chosen) return choose(chosen, true);
		else return;
		e.preventDefault();
		if (ids[next] !== undefined) choose(ids[next], false);
	});
	// Keys of the stage: ← → through the words from anywhere on the page, / to find, Esc out of find.
	const keys = (/** @type {KeyboardEvent} */ e) => {
		if (!root.isConnected) return document.removeEventListener('keydown', keys);
		const target = /** @type {HTMLElement} */ (e.target);
		if (target.closest('input, textarea, [contenteditable]') || root.dataset.playing !== undefined) return;
		if (e.key === '/') {
			e.preventDefault();
			openFind();
		} else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !NARROW.matches && chips.length && !e.altKey && !e.metaKey) {
			const ids = chips.map((c) => c.id);
			const at = chosen ? ids.indexOf(chosen) : -1;
			const next = e.key === 'ArrowRight' ? Math.min(at + 1, ids.length - 1) : Math.max(at - 1, 0);
			if (ids[next] !== undefined && ids[next] !== chosen) {
				e.preventDefault();
				choose(ids[next], false);
			}
		}
	};
	document.addEventListener('keydown', keys);

	return {
		root,
		card,
		/** @param {Tool[]} tools */
		setPalette(tools) {
			const button = (/** @type {Tool} */ tool) => {
				const b = h(
					'button',
					{ type: 'button', class: `stage-tool${tool.filter ? ' is-filter' : ''}`, title: tool.label, 'aria-label': tool.label, 'aria-pressed': tool.pressed === undefined ? null : String(tool.pressed) },
					icon(tool.icon, 18),
					h('span', { class: 'stage-tool-label' }, tool.label),
					tool.count !== undefined ? h('small', { class: 'stage-tool-count' }, String(tool.count)) : null,
				);
				b.addEventListener('click', tool.id === 'find' ? openFind : tool.press);
				return b;
			};
			const filters = tools.filter((tool) => tool.filter).map(button);
			const extras = tools.filter((tool) => !tool.filter).map(button);
			palette.replaceChildren(filters.length ? h('div', { class: 'stage-filters' }, ...filters) : null, extras.length ? h('div', { class: 'stage-extras' }, ...extras) : null);
			palette.hidden = !tools.length || !find.hidden;
		},
		/**
		 * @param {import('./stage-data.js').Chip[]} list
		 * @param {string | null} [keep]  The chip to have chosen: null for none (the card is the page's own),
		 *   undefined for the one chosen so far; one not in the list gives the first on a wide screen.
		 */
		setChips(list, keep) {
			chips = list;
			strip.replaceChildren(
				...list.map((c) =>
					h(
						'li',
						{ role: 'option', 'data-id': c.id, class: `stage-chip${c.dim ? ' is-dim' : ''}`, 'aria-selected': 'false', tabindex: '-1', lang: c.lang },
						h('b', null, c.word),
						h('span', null, c.note),
						c.marked ? h('i', { class: 'stage-chip-dot', 'aria-hidden': 'true' }) : null,
						icon(ICONS.chevron, 14),
					),
				),
			);
			strip.tabIndex = list.length ? 0 : -1;
			strip.hidden = !list.length;
			const want = keep !== undefined ? keep : chosen;
			const have = keep === null ? null : want && list.some((c) => c.id === want) ? want : NARROW.matches ? null : (list[0]?.id ?? null);
			choose(have, false);
		},
		/** @param {boolean} on */
		setPlaying(on) {
			if (on) root.dataset.playing = '';
			else delete root.dataset.playing;
		},
		choose: (/** @type {string | null} */ id) => choose(id, true),
		chosen: () => chosen,
		chips: () => chips,
		closeFind,
	};
}

/**
 * A card that says one thing: a title, a line or two, and buttons.
 * @param {string} title
 * @param {Array<Node | string | null>} body
 * @param {Array<Node | null>} [buttons]
 */
export function noteCard(title, body, buttons = []) {
	return h('div', { class: 'stage-note' }, h('h2', null, title), ...body.map((b) => (typeof b === 'string' ? h('p', null, b) : b)), buttons.some(Boolean) ? h('div', { class: 'stage-buttons' }, ...buttons) : null);
}
