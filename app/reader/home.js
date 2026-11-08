// @ts-check
/**
 * Home: the page shell's search bar, with the logo above it, is the whole
 * page (styled by body[data-route="home"]); the view itself adds nothing.
 */
import { h } from '../core/dom.js';

export function view() {
	return h('section', { class: 'home', 'aria-label': 'Search the dictionary' });
}
