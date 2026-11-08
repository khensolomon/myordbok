// @ts-check
/**
 * Home: the search bar (from the page shell) is the page; this adds only the
 * line under it saying which way the dictionary works.
 */
import { h } from '../core/dom.js';

export function view() {
	return h(
		'section',
		{ class: 'home' },
		h('p', { class: 'home-pair' }, 'English ', h('span', { 'aria-hidden': 'true' }, '⇄'), ' ', h('span', { lang: 'my' }, 'မြန်မာ')),
	);
}
