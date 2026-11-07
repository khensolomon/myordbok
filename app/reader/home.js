// @ts-check
/**
 * Home: the logo and the search box, nothing else.
 */
import { h } from '../core/dom.js';
import { definitionHref } from '../core/routes.js';
import './search-box.js';

/** @param {import('../core/routes.js').ViewContext} ctx */
export function view(ctx) {
	const box = h('mo-search', { class: 'search-hero' });
	box.addEventListener('mo-search', (e) => ctx.go(definitionHref(/** @type {CustomEvent<string>} */ (e).detail)));

	return h(
		'section',
		{ class: 'home' },
		h('img', { class: 'brand-logo', src: '/static/logo.svg', alt: 'MyOrdbok', width: '340', height: '57' }),
		h('p', { class: 'home-pair' }, 'English ', h('span', { 'aria-hidden': 'true' }, '⇄'), ' ', h('span', { lang: 'my' }, 'မြန်မာ')),
		box,
	);
}
