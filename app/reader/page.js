// @ts-check
/**
 * Information pages still to move over: fonts.
 * Content moves over from the previous site in a later change.
 */
import { h } from '../core/dom.js';

/** @type {Record<string, string>} */
const TITLES = {
	'myanmar-fonts': 'Myanmar fonts',
};

function pageName() {
	return location.pathname.split('/').filter(Boolean)[0] ?? '';
}

export function title() {
	return TITLES[pageName()] ?? 'MyOrdbok';
}

export function view() {
	return h('section', { class: 'page' }, h('h1', null, title()), h('p', { class: 'notice' }, 'This page moves over from the previous site in a later change.'));
}
