// @ts-check
/**
 * Dataset markup: `<word>` inside a sense or example links to that entry.
 * Parsed into text and link nodes; the text is never treated as HTML.
 */
import { h } from './dom.js';
import { definitionHref } from './routes.js';

const LINK = /<([^<>]+)>/g;

/**
 * @param {string} text
 * @returns {Node[]}
 */
export function renderMarkup(text) {
	/** @type {Node[]} */
	const out = [];
	let last = 0;
	for (const m of text.matchAll(LINK)) {
		const index = m.index ?? 0;
		if (index > last) out.push(document.createTextNode(text.slice(last, index)));
		out.push(h('a', { href: definitionHref(m[1]) }, m[1]));
		last = index + m[0].length;
	}
	if (last < text.length) out.push(document.createTextNode(text.slice(last)));
	return out;
}
