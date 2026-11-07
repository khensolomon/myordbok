// @ts-check
/**
 * Studio for editors and admins. Loaded only when /studio is opened, and kept
 * out of the offline precache, so readers never download it.
 */
import { h } from '../core/dom.js';

export function title() {
	return 'Studio';
}

export function view() {
	return h(
		'section',
		{ class: 'page' },
		h('h1', null, 'Studio'),
		h('p', { class: 'notice' }, 'The studio needs Google or GitHub sign-in, which arrives in a later change.'),
	);
}
