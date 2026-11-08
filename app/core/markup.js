// @ts-check
/**
 * Dataset markup as DOM nodes (parsing lives in shared/markup.js). The text
 * is never treated as HTML: every token becomes text or an element built
 * here.
 */
import { labelName, parseMarkup } from '#shared/markup.js';
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
		out.push(h('a', { href: definitionHref(w) }, w));
	});
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
				return document.createTextNode(opts.headword === undefined ? tk.v : tk.v.replaceAll('~', opts.headword));
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
