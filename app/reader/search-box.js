// @ts-check
/**
 * <mo-search>: the search field with live suggestions, in one box: the list
 * opens inside the same box, under the field, over the page.
 * Emits `mo-search` (detail: query) on submit; the shell decides where to go.
 * Suggestions are links, so the router handles them like any other link.
 *
 * What is typed is read first (shared/query): a number, a sum, the time or
 * the date gets its answer as the first row and nothing is fetched; a sum
 * that reads two ways offers both; a question around a word suggests for the
 * word ("what is lo" → words starting "lo").
 *
 * Keyboard: "/" or Ctrl+K (⌘K) from anywhere on the page puts the cursor in
 * the search field, its text selected; a small "/" in the box says so on
 * devices with a keyboard and pointer.
 */
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { t, tn } from '../i18n/index.js';
import { definitionHref } from '../core/routes.js';
import { suggest } from '../data/api.js';
import { classify, preview, understoodHref } from './query.js';

const DEBOUNCE_MS = 150;
let uid = 0;

/**
 * "/" and Ctrl+K (⌘K) put the cursor in the page's search field; "/" not while
 * typing elsewhere, Ctrl+K anywhere.
 * @param {KeyboardEvent} e
 */
function shortcut(e) {
	const combo = (e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k';
	const slash = e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey;
	if (!combo && !slash) return;
	const target = /** @type {HTMLElement | null} */ (e.target);
	if (slash && target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
	const field = /** @type {HTMLInputElement | null} */ ([...document.querySelectorAll('mo-search input[type="search"]')].find((el) => /** @type {HTMLElement} */ (el).offsetParent !== null) ?? null);
	if (!field) return;
	e.preventDefault();
	field.focus();
	field.select();
}
document.addEventListener('keydown', shortcut);

/** A touch screen (the bar's touchstart below). */
const COARSE = window.matchMedia('(pointer: coarse)');

export class SearchBox extends HTMLElement {
	connectedCallback() {
		if (this.childElementCount) return;
		const id = `mo-search-${++uid}`;
		const value = this.getAttribute('value') ?? '';

		this.input = h('input', {
			id,
			type: 'search',
			name: 'q',
			value,
			autocomplete: 'off',
			spellcheck: 'false',
			placeholder: t('Type a word in English or မြန်မာ'),
			role: 'combobox',
			'aria-expanded': 'false',
			'aria-controls': `${id}-list`,
			'aria-autocomplete': 'list',
			'aria-keyshortcuts': '/ Control+K Meta+K',
			onInput: () => this.schedule(),
			// Focus shows suggestions only for text already in the field.
			onFocus: () => {
				if (this.input?.value.trim()) this.suggest();
			},
			onKeydown: (/** @type {KeyboardEvent} */ e) => this.keys(e),
		});
		this.list = h('ul', { id: `${id}-list`, role: 'listbox', class: 'search-list', hidden: true });
		this.status = h('p', { class: 'visually-hidden', 'aria-live': 'polite' });

		const form = h(
			'form',
			{ role: 'search', class: 'search', onSubmit: (/** @type {SubmitEvent} */ e) => this.submit(e) },
			h('label', { for: id, class: 'visually-hidden' }, t('Search a word')),
			this.input,
			h('kbd', { class: 'search-key', 'aria-hidden': 'true', title: t('Press / to search') }, '/'),
			h('button', { type: 'submit', class: 'search-go', 'aria-label': t('Search'), title: t('Search') }, icon(ICONS.search, 18)),
		);
		this.box = h('div', { class: 'search-box' }, form, this.list);
		this.append(this.box, this.status);
		// Closing when focus or a click leaves the box keeps the list from covering the page.
		this.addEventListener('focusout', (e) => {
			if (!this.contains(/** @type {Node | null} */ (e.relatedTarget))) this.show([]);
		});
		// A chosen suggestion navigates; the list closes behind it.
		this.list.addEventListener('click', () => this.show([]));
		// While the field has focus the page may make room for it (on a phone's
		// home page the logo steps aside, see app.css). Giving the room back
		// waits a moment, so a tap that moved focus lands where it was aimed.
		/** @type {number | undefined} */
		let settle;
		this.addEventListener('focusin', () => {
			clearTimeout(settle);
			document.body.toggleAttribute('data-searching', true);
		});
		// On a touch screen the bar stops sticking while the field has focus
		// (app.css): iOS Safari draws a sticky field's text cursor off the field
		// once the keyboard moves the page. A tap on the bar stuck over a
		// scrolled page first brings the page to its top, where the bar sits
		// in place, so it does not move from under the finger.
		this.addEventListener(
			'touchstart',
			() => {
				const bar = this.closest('.search-bar');
				if (COARSE.matches && bar && window.scrollY > 0 && getComputedStyle(bar).position === 'sticky') window.scrollTo(0, 0);
			},
			{ passive: true },
		);
		this.addEventListener('focusout', (e) => {
			if (this.contains(/** @type {Node | null} */ (e.relatedTarget))) return;
			clearTimeout(settle);
			settle = window.setTimeout(() => document.body.removeAttribute('data-searching'), 300);
		});
		// The on-screen keyboard shrinks the visible page; the list keeps above it.
		window.visualViewport?.addEventListener('resize', () => this.hasAttribute('data-open') && this.fit());
		/** @type {number | undefined} */
		this.timer = undefined;
		this.seq = 0;
	}

	/**
	 * Puts a word in the field without searching (the shell keeps it in step
	 * with the page shown).
	 * @param {string} value
	 */
	setValue(value) {
		if (this.input && this.input.value !== value) this.input.value = value;
		this.seq++; // a suggestion request still under way is no longer wanted
		this.show([]);
	}

	schedule() {
		clearTimeout(this.timer);
		this.timer = window.setTimeout(() => this.suggest(), DEBOUNCE_MS);
	}

	async suggest() {
		const input = /** @type {HTMLInputElement} */ (this.input);
		const q = input.value.trim();
		const mine = ++this.seq;
		if (!q) return this.show([]);
		const intent = classify(q);
		const line = preview(intent);
		if (line) return this.show([], [row(line.label, line.value, definitionHref(q), q)]);
		if (intent.kind === 'ask') return this.show([], intent.options.map((o) => row(o.label, '', definitionHref(o.query), o.query)));
		if (intent.kind !== 'lookup') return this.show([]);
		const lead = intent.understood ? [row(t('Look up “{word}”', { word: intent.word }), '', understoodHref(intent, q), q)] : [];
		try {
			const { words } = await suggest(intent.word);
			if (mine === this.seq) this.show(words, lead);
		} catch (err) {
			// Suggestions are optional; the search itself still submits and reports errors.
			if (mine === this.seq) this.show([], lead);
			console.warn('Suggestions unavailable:', err);
		}
	}

	/**
	 * @param {string[]} words
	 * @param {HTMLElement[]} [lead]  Rows before the words: an answer, or choices.
	 */
	show(words, lead = []) {
		const list = /** @type {HTMLUListElement} */ (this.list);
		const items = [...lead, ...words.map((w) => h('li', null, h('a', { href: definitionHref(w), tabindex: '-1' }, w)))];
		items.forEach((li, i) => {
			li.setAttribute('role', 'option');
			li.id = `${list.id}-${i}`;
		});
		list.replaceChildren(...items);
		const open = items.length > 0;
		list.hidden = !open;
		this.toggleAttribute('data-open', open);
		this.input?.setAttribute('aria-expanded', String(open));
		if (open) this.fit();
		if (this.status) this.status.textContent = lead.length && !words.length ? (lead[0].textContent ?? '') : open ? tn('{n} suggestion', '{n} suggestions', items.length) : '';
	}

	/** The list's height: what is left of the visible page below it, keyboard excluded. */
	fit() {
		const list = /** @type {HTMLUListElement} */ (this.list);
		const vv = window.visualViewport;
		const bottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
		list.style.maxHeight = `${Math.max(132, Math.floor(bottom - list.getBoundingClientRect().top - 16))}px`;
	}

	/** @param {KeyboardEvent} e */
	keys(e) {
		const list = /** @type {HTMLUListElement} */ (this.list);
		const links = [...list.querySelectorAll('a')];
		if (!links.length || list.hidden) return;
		const current = links.indexOf(/** @type {HTMLAnchorElement} */ (list.querySelector('[aria-selected="true"] a')));
		let next = current;
		if (e.key === 'ArrowDown') next = Math.min(current + 1, links.length - 1);
		else if (e.key === 'ArrowUp') next = Math.max(current - 1, -1);
		else if (e.key === 'Escape') return this.show([]);
		else return;
		e.preventDefault();
		list.querySelectorAll('li').forEach((li, i) => li.setAttribute('aria-selected', String(i === next)));
		this.input?.setAttribute('aria-activedescendant', next >= 0 ? `${list.id}-${next}` : '');
		if (next >= 0 && this.input) this.input.value = links[next].dataset.value ?? links[next].textContent ?? '';
	}

	/** @param {SubmitEvent} e */
	submit(e) {
		e.preventDefault();
		const q = this.input?.value.trim();
		if (!q) return;
		this.show([]);
		this.dispatchEvent(new CustomEvent('mo-search', { detail: q, bubbles: true }));
	}
}

/**
 * A row that answers or offers a choice, above any suggested words.
 * @param {string} label
 * @param {string} value
 * @param {string} href
 * @param {string} typed  Put in the field when the row is chosen by key.
 */
function row(label, value, href, typed) {
	return h('li', { class: 'search-answer' }, h('a', { href, tabindex: '-1', 'data-value': typed }, h('span', { class: 'search-answer-label' }, label), value ? h('span', { class: 'search-answer-value' }, value) : null));
}

if (!customElements.get('mo-search')) customElements.define('mo-search', SearchBox);
