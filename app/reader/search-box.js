// @ts-check
/**
 * <mo-search>: the search field with live suggestions, in one box: the list
 * opens inside the same box, under the field, over the page.
 * Emits `mo-search` (detail: query) on submit; the shell decides where to go.
 * Suggestions are links, so the router handles them like any other link.
 */
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { definitionHref } from '../core/routes.js';
import { suggest } from '../data/api.js';

const DEBOUNCE_MS = 150;
let uid = 0;

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
			placeholder: 'Type a word in English or မြန်မာ',
			role: 'combobox',
			'aria-expanded': 'false',
			'aria-controls': `${id}-list`,
			'aria-autocomplete': 'list',
			onInput: () => this.schedule(),
			// Focus shows the suggestions for whatever the field holds, typed or not.
			onFocus: () => this.suggest(),
			onKeydown: (/** @type {KeyboardEvent} */ e) => this.keys(e),
		});
		this.list = h('ul', { id: `${id}-list`, role: 'listbox', class: 'search-list', hidden: true });
		this.status = h('p', { class: 'visually-hidden', 'aria-live': 'polite' });

		const form = h(
			'form',
			{ role: 'search', class: 'search', onSubmit: (/** @type {SubmitEvent} */ e) => this.submit(e) },
			h('label', { for: id, class: 'visually-hidden' }, 'Search a word'),
			this.input,
			h('button', { type: 'submit', class: 'search-go', 'aria-label': 'Search', title: 'Search' }, icon(ICONS.search, 18)),
		);
		this.box = h('div', { class: 'search-box' }, form, this.list);
		this.append(this.box, this.status);
		// Closing when focus or a click leaves the box keeps the list from covering the page.
		this.addEventListener('focusout', (e) => {
			if (!this.contains(/** @type {Node | null} */ (e.relatedTarget))) this.show([]);
		});
		// A chosen suggestion navigates; the list closes behind it.
		this.list.addEventListener('click', () => this.show([]));
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
		try {
			const { words } = await suggest(q);
			if (mine === this.seq) this.show(words);
		} catch (err) {
			// Suggestions are optional; the search itself still submits and reports errors.
			if (mine === this.seq) this.show([]);
			console.warn('Suggestions unavailable:', err);
		}
	}

	/** @param {string[]} words */
	show(words) {
		const list = /** @type {HTMLUListElement} */ (this.list);
		list.replaceChildren(
			...words.map((w, i) => h('li', { role: 'option', id: `${list.id}-${i}` }, h('a', { href: definitionHref(w), tabindex: '-1' }, w))),
		);
		list.hidden = words.length === 0;
		this.toggleAttribute('data-open', words.length > 0);
		this.input?.setAttribute('aria-expanded', String(words.length > 0));
		if (this.status) this.status.textContent = words.length ? `${words.length} suggestions` : '';
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
		if (next >= 0 && this.input) this.input.value = links[next].textContent ?? '';
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

if (!customElements.get('mo-search')) customElements.define('mo-search', SearchBox);
