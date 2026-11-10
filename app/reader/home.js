// @ts-check
/**
 * Home: the page shell's search bar, with the logo above it, is the whole
 * page (styled by body[data-route="home"]); the view itself adds nothing.
 */
import { h } from '../core/dom.js';
import { t } from '../i18n/index.js';

export function view() {
	return h('section', { class: 'home', 'aria-label': t('Search the dictionary') });
}
