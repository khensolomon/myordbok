// @ts-check
/**
 * Dataset markup as DOM nodes (parsing lives in shared/markup.js). The text
 * is never treated as HTML: every token becomes text or an element built
 * here.
 */
import { LINKED_LABELS, labelName, parseMarkup } from '#shared/markup.js';
import { h } from './dom.js';
import { definitionHref } from './routes.js';

/**
 * @typedef {object} MarkupOptions
 * @property {string} [headword]  Replaces `~` in examples and patterns.
 */

/**
 * @param {string[]} words
 * @returns {Node[]}
 */
function links(words) {
	/** @type {Node[]} */
	const out = [];
	words.forEach((w, i) => {
		if (i) out.push(document.createTextNode('/'));
		// A region or a remark after the word stays text: [also:ငါးလက်ခွာ (Rakhine)].
		const aside = /^(.*\S)\s+(\([^()]*\))$/.exec(w);
		out.push(h('a', { href: definitionHref(aside ? aside[1] : w) }, aside ? aside[1] : w));
		if (aside) out.push(h('span', { class: 'mk-note' }, ` ${aside[2]}`));
	});
	return out;
}

/**
 * Plain text, with a note in round brackets, "(ie Very few people)", set
 * apart as a quiet aside.
 * @param {string} text
 * @returns {Node}
 */
function notes(text) {
	const parts = text.split(/(\([^()]+\))/);
	if (parts.length === 1) return document.createTextNode(text);
	const out = document.createDocumentFragment();
	parts.forEach((p, i) => p && out.append(i % 2 ? h('span', { class: 'mk-note' }, p) : document.createTextNode(p)));
	return out;
}

/**
 * @param {import('#shared/markup.js').Token[]} tokens
 * @param {MarkupOptions} opts
 * @returns {Node[]}
 */
function render(tokens, opts) {
	return tokens.map((tk) => {
		switch (tk.t) {
			case 'text':
				return notes(opts.headword === undefined ? tk.v : tk.v.replaceAll('~', opts.headword));
			case 'link':
				return h('span', { class: 'mk-link' }, links(tk.words));
			case 'mark':
				return h('mark', null, render(tk.parts, opts));
			case 'pattern':
				return h('span', { class: 'mk-pattern' }, '(', render(tk.parts, opts), ')');
			case 'label': {
				const name = labelName(tk.name);
				const value = tk.value ? render(tk.value, opts) : links(tk.words);
				return h(
					'span',
					{ class: 'mk-label', 'data-label': tk.name },
					name ? h('span', { class: 'mk-label-name' }, name) : null,
					name && value.length ? ' ' : null,
					value,
				);
			}
		}
	});
}

/**
 * @param {string} text
 * @param {MarkupOptions} [opts]
 * @returns {Node[]}
 */
export function renderMarkup(text, opts = {}) {
	return render(parseMarkup(text), opts);
}

/**
 * A note, an item that is one bracket: a label as a label; a name and its
 * value as the name, then the value. The name is the caption; a value that
 * names headwords (see, compare, =, also, …) links to them.
 * @param {Extract<import('#shared/markup.js').Item, { t: 'note' }>} note
 * @param {MarkupOptions} [opts]
 * @returns {HTMLElement}
 */
export function renderNote(note, opts = {}) {
	if (note.value === null) return h('span', { class: 'sense-label', 'data-note': note.name }, note.name);
	const name = labelName(note.name);
	const linked = LINKED_LABELS.has(note.name) && !/[<>]/.test(note.value);
	const value = linked ? links(note.value.split('/').map((w) => w.trim()).filter(Boolean)) : renderMarkup(note.value, opts);
	return h('span', { class: 'sense-note', 'data-note': note.name }, name ? h('span', { class: 'sense-note-name' }, name) : null, name ? ' ' : null, h('span', { class: 'sense-note-value' }, value));
}
