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
 * the search field, its text selected; a small "/" in the box says so while
 * the cursor is elsewhere, on devices with a keyboard and pointer.
 *
 * An empty field with the cursor in it lists this device's recent searches
 * (data/recent.js) in place of suggestions: on focus, and when emptied.
 * A field holding text shows an ✕; it, or Escape in the field, empties the
 * field and keeps the cursor there. Escape in an empty field closes the list.
 */
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { t, tn } from '../i18n/index.js';
import { definitionHref } from '../core/routes.js';
import { suggest } from '../data/api.js';
import { recentSearches } from '../data/recent.js';
import { member } from '../core/member.js';
import { atLeast } from '#shared/roles.js';

/** The role the guide is written for (core/guide.js, GUIDE_ROLE). */
const GUIDE_ROLE = 'editor';
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

/** Under 1024px the search is a screen of its own while the field has focus (app.css): a search made closes it. */
const NARROW = window.matchMedia('(max-width: 1023px)');

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
			// A word as typed: no capital first letter, no correction to another word.
			autocapitalize: 'none',
			autocorrect: 'off',
			placeholder: t('Type a word in English or မြန်မာ'),
			// The keyboard's own key says Search, and searches (submit below).
			enterkeyhint: 'search',
			role: 'combobox',
			'aria-expanded': 'false',
			'aria-controls': `${id}-list`,
			'aria-autocomplete': 'list',
			'aria-keyshortcuts': '/ Control+K Meta+K',
			onInput: () => {
				this.showLead();
				this.schedule();
			},
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
			// What the field read (lead()): the direction of the lookup, or the kind of question.
			(this.lead = h('span', { class: 'search-lead', 'aria-hidden': 'true' }, h('span', { class: 'search-lead-sign' }, '⇄'))),
			this.input,
			h(
				'button',
				{
					type: 'button',
					class: 'search-clear',
					'aria-label': t('Clear'),
					title: t('Clear'),
					// The press must not take the cursor out of the field first.
					onMousedown: (/** @type {MouseEvent} */ e) => e.preventDefault(),
					onClick: () => this.clear(),
				},
				icon(ICONS.close, 16),
			),
			h('kbd', { class: 'search-key', 'aria-hidden': 'true', title: t('Press / to search') }, '/'),
			h('button', { type: 'submit', class: 'search-go', 'aria-label': t('Search'), title: t('Search') }, icon(ICONS.search, 18)),
			// Under 1024px, while searching: Cancel, the end of the field (app.css).
			h(
				'button',
				{
					type: 'button',
					class: 'search-done',
					onPointerdown: (/** @type {PointerEvent} */ e) => e.preventDefault(),
					onClick: () => this.cancel(),
				},
				t('Cancel'),
			),
		);
		this.box = h('div', { class: 'search-box' }, form, this.list);
		this.append(this.box, this.status);
		// Closing when focus or a click leaves the box keeps the list from covering the page.
		this.addEventListener('focusout', (e) => {
			if (!this.contains(/** @type {Node | null} */ (e.relatedTarget))) this.show([]);
		});
		// A chosen suggestion navigates; the list closes behind it, and the
		// search screen with it.
		this.list.addEventListener('click', () => {
			this.show([]);
			if (NARROW.matches) this.leave();
		});
		// While the field has focus, under 1024px, the search is a screen of
		// its own (app.css, body[data-searching]). Focus leaving closes it
		// after a moment, so a tap that moved focus lands where it was aimed;
		// a search, a suggestion, Cancel or a new page close it at once
		// (leave), whatever focus does: iOS does not always report focus
		// leaving the field, and a screen left open covers the page.
		/** @type {number | undefined} */
		let settle;
		this.closeScreen = () => {
			clearTimeout(settle);
			document.body.removeAttribute('data-searching');
			document.documentElement.style.setProperty('--vv-top', '0px');
		};
		window.addEventListener('mo:navigated', () => {
			if (document.activeElement !== this.input) this.closeScreen?.();
		});
		/** What the field held when focus came in; Cancel puts it back. */
		this.valueBefore = value;
		this.addEventListener('focusin', (e) => {
			clearTimeout(settle);
			if (!this.contains(/** @type {Node | null} */ (e.relatedTarget)) && !document.body.hasAttribute('data-searching')) this.valueBefore = this.input?.value ?? '';
			document.body.toggleAttribute('data-searching', true);
			if (e.target === this.input && !this.input?.value) this.show(recentSearches(), [], true);
		});
		this.addEventListener('focusout', (e) => {
			if (this.contains(/** @type {Node | null} */ (e.relatedTarget))) return;
			clearTimeout(settle);
			settle = window.setTimeout(() => document.body.removeAttribute('data-searching'), 300);
		});
		// The on-screen keyboard shrinks the visible page; the list keeps above
		// it. iOS also scrolls the window under the keyboard, carrying the
		// search screen up behind the status bar: the screen is moved back
		// down by as much (app.css, --vv-top).
		const follow = () => {
			const vv = window.visualViewport;
			const searching = document.body.hasAttribute('data-searching');
			document.documentElement.style.setProperty('--vv-top', `${searching && vv ? Math.max(0, vv.offsetTop) : 0}px`);
			if (this.hasAttribute('data-open')) this.fit();
		};
		window.visualViewport?.addEventListener('resize', follow);
		window.visualViewport?.addEventListener('scroll', follow);
		this.addEventListener('focusin', () => requestAnimationFrame(follow));
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
		this.showLead();
		this.seq++; // a suggestion request still under way is no longer wanted
		this.show([]);
	}

	/** The cursor in the field (the Search tab, tapped on home). */
	focus() {
		this.input?.focus();
	}

	/** Cancel (phones): what was typed goes, the list closes, the keyboard goes away. */
	cancel() {
		this.setValue(this.valueBefore);
		this.leave();
	}

	/** The keyboard away and the search screen closed. */
	leave() {
		/** @type {HTMLElement | null} */ (document.activeElement)?.blur();
		this.input?.blur();
		this.closeScreen?.();
	}

	/** Empties the field, keeps the cursor in it, and lists this device's recent searches. */
	clear() {
		const input = /** @type {HTMLInputElement} */ (this.input);
		clearTimeout(this.timer);
		this.seq++; // a suggestion request still under way is no longer wanted
		input.value = '';
		input.focus();
		this.showLead();
		this.show(recentSearches(), [], true);
	}

	/**
	 * The lead: what the field holds, as the search reads it. Empty, the two
	 * directions (⇄, as under the logo); English, A; Myanmar, မ; a sum, =;
	 * a number, #; a time or a date, a clock or a calendar; a question, ?;
	 * what cannot be read, i. Each sign has one job: the rows' magnifier
	 * says "search this one", the button is the action.
	 */
	showLead() {
		const q = this.input?.value.trim() ?? '';
		const lead = /** @type {HTMLElement} */ (this.lead);
		/** @param {string} sign @param {string} [cls] */
		const sign = (sign, cls = '') => lead.replaceChildren(h('span', { class: `search-lead-sign ${cls}`.trim() }, sign));
		if (!q) return sign('⇄');
		const intent = classify(q);
		switch (intent.kind) {
			case 'math':
			case 'shares':
				return lead.replaceChildren(icon(ICONS.equals, 15));
			case 'number':
				return lead.replaceChildren(icon(ICONS.hash, 15));
			case 'time':
				return lead.replaceChildren(icon(ICONS.clock, 15));
			case 'date':
				return lead.replaceChildren(icon(ICONS.calendar, 15));
			case 'ask':
				return lead.replaceChildren(icon(ICONS.question, 15));
			case 'problem':
				return lead.replaceChildren(icon(ICONS.info, 15));
			default:
				return /[\u1000-\u109F]/.test(q) ? sign('မ', 'is-my') : sign('A');
		}
	}

	schedule() {
		clearTimeout(this.timer);
		this.timer = window.setTimeout(() => this.suggest(), DEBOUNCE_MS);
	}

	async suggest() {
		const input = /** @type {HTMLInputElement} */ (this.input);
		const q = input.value.trim();
		const mine = ++this.seq;
		if (!q) return this.show(document.activeElement === input ? recentSearches() : [], [], true);
		const intent = classify(q);
		const line = preview(intent);
		if (line) return this.show([], [row(line.label, line.value, definitionHref(q), q)]);
		if (intent.kind === 'ask') return this.show([], intent.options.map((o) => row(o.label, '', definitionHref(o.query), o.query)));
		if (intent.kind !== 'lookup') return this.show([]);
		const lead = intent.understood ? [row(t('Look up “{word}”', { word: intent.word }), '', understoodHref(intent, q), q)] : [];
		// The guide's rows ride along for an editor (never asked for by anyone else).
		const guide = guideRows(q);
		try {
			const [{ words }, extra] = await Promise.all([suggest(intent.word), guide]);
			if (mine === this.seq) this.show(words, lead, false, extra);
		} catch (err) {
			// Suggestions are optional; the search itself still submits and reports errors.
			if (mine === this.seq) this.show([], lead);
			console.warn('Suggestions unavailable:', err);
		}
	}

	/**
	 * @param {string[]} words
	 * @param {HTMLElement[]} [lead]  Rows before the words: an answer, or choices.
	 * @param {boolean} [recent]  The words are this device's recent searches.
	 * @param {HTMLElement[]} [extra]  Rows after the words: the guide's, for an editor.
	 */
	show(words, lead = [], recent = false, extra = []) {
		const list = /** @type {HTMLUListElement} */ (this.list);
		// Each word with what it is: a clock for one searched before, a magnifier for one suggested.
		const items = [...lead, ...words.map((w) => h('li', { class: recent ? 'search-recent' : 'search-word' }, h('a', { href: definitionHref(w), tabindex: '-1' }, icon(recent ? ICONS.clock : ICONS.search, 15), w))), ...extra];
		items.forEach((li, i) => {
			li.id = `${list.id}-${i}`;
			if (li.getAttribute('role') !== 'presentation') li.setAttribute('role', 'option');
		});
		list.replaceChildren(...items);
		const open = items.length > 0;
		list.hidden = !open;
		this.toggleAttribute('data-open', open);
		this.input?.setAttribute('aria-expanded', String(open));
		if (open) this.fit();
		if (this.status) this.status.textContent = lead.length && !words.length ? (lead[0].textContent ?? '') : open ? `${recent ? `${t('Recent')}: ` : ''}${tn('{n} suggestion', '{n} suggestions', items.length)}` : '';
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
		if (e.key === 'Escape' && this.input?.value) {
			// Before the browser's own handling, which would empty the field and close the list.
			e.preventDefault();
			return this.clear();
		}
		if (!links.length || list.hidden) return;
		const current = links.indexOf(/** @type {HTMLAnchorElement} */ (list.querySelector('[aria-selected="true"] a')));
		let next = current;
		if (e.key === 'ArrowDown') next = Math.min(current + 1, links.length - 1);
		else if (e.key === 'ArrowUp') next = Math.max(current - 1, -1);
		else if (e.key === 'Escape') return this.show([]);
		else return;
		e.preventDefault();
		// The row is the link's own: a group line (no link) is passed over and never counted.
		const chosen = next >= 0 ? links[next].closest('li') : null;
		list.querySelectorAll('li').forEach((li) => li.setAttribute('aria-selected', String(li === chosen)));
		this.input?.setAttribute('aria-activedescendant', chosen?.id ?? '');
		if (next >= 0 && this.input) this.input.value = links[next].dataset.value ?? links[next].textContent ?? '';
		chosen?.scrollIntoView({ block: 'nearest' });
	}

	/** @param {SubmitEvent} e */
	submit(e) {
		e.preventDefault();
		// A guide row chosen by key opens where it points, not a search for its words.
		const chosen = /** @type {HTMLAnchorElement | null} */ (this.list?.querySelector('[aria-selected="true"].search-guide a'));
		if (chosen) {
			this.show([]);
			if (NARROW.matches) this.leave();
			chosen.click();
			return;
		}
		const q = this.input?.value.trim();
		if (!q) return;
		this.show([]);
		// Enter and the search button alike: the search screen closes with the keyboard.
		if (NARROW.matches) this.leave();
		this.dispatchEvent(new CustomEvent('mo-search', { detail: q, bubbles: true }));
	}
}

/**
 * The guide's rows for what is typed, for a signed-in editor (or above):
 * "Ask the guide" when it reads as a question, then the passages nearest
 * to the words, each opening in the workspace. Anyone else gets none,
 * and their browser never loads the guide (core/guide.js).
 * @param {string} q
 * @returns {Promise<HTMLElement[]>}
 */
async function guideRows(q) {
	try {
		const me = await member().catch(() => null);
		// The same test as core/guide.js's readsGuide, without loading it for anyone else.
		if (!me || !atLeast(me.role, GUIDE_ROLE)) return [];
		const { loadGuide } = await import('../core/guide.js');
		const [{ index }, { ask }] = await Promise.all([loadGuide(), import('#shared/guide/ask.js')]);
		const reply = ask(index, q);
		const words = q.split(/\s+/).filter(Boolean).length;
		const asks = reply.question.kind !== null || words >= 3;
		if (!reply.passages.length && !asks) return [];
		const askHref = `/workspace?s=guide&q=${encodeURIComponent(q)}`;
		/** @type {HTMLElement[]} */
		const rows = [h('li', { class: 'search-group', role: 'presentation', 'aria-hidden': 'true' }, h('span', null, t('Guide')))];
		if (asks) rows.push(h('li', { class: 'search-guide search-guide-ask' }, h('a', { href: askHref, tabindex: '-1', 'data-value': q }, icon(ICONS.comment, 15), h('span', { class: 'search-guide-text' }, h('b', null, t('Ask the guide:')), ' ', q))));
		const seen = new Set();
		for (const { passage } of reply.passages) {
			const p = index.passages[passage];
			// One row per heading: a long section cut in passages is listed once.
			if (seen.has(`${p.file} ${p.title}`)) continue;
			seen.add(`${p.file} ${p.title}`);
			if (seen.size > 3) break;
			rows.push(h('li', { class: 'search-guide' }, h('a', { href: `/workspace?s=guide&p=${encodeURIComponent(p.id)}&q=${encodeURIComponent(q)}`, tabindex: '-1', 'data-value': q }, icon(ICONS.document, 15), h('span', { class: 'search-guide-text' }, p.title, h('small', null, p.file.replace(/^docs\//, ''))))));
		}
		return rows;
	} catch (err) {
		console.warn('The guide\'s rows are not shown:', err);
		return [];
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
