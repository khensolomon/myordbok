// @ts-check
/**
 * Home: the page shell's search bar, with the logo above it (styled by
 * body[data-route="home"]); below it, this device's recent searches and the
 * words searched most this week. Recent searches never leave the device;
 * the most searched come from /api/popular (found words only, each searched
 * by several people).
 */
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { definitionHref } from '../core/routes.js';
import { popularWords } from '../data/api.js';
import { clearRecent, recentSearches } from '../data/recent.js';
import { t } from '../i18n/index.js';

const MYANMAR = /[က-႟]/;

export function view() {
	const recent = recentSearches();
	const mine = recent.length ? group(t('Recent'), recent, true) : null;
	const most = h('div', { class: 'home-group', hidden: true });
	popularWords()
		.then((p) => {
			if (!p.words.length) return;
			most.replaceWith(group(t('Searched most this week'), p.words.map((w) => w.term), false));
		})
		.catch(() => {});
	return h('section', { class: 'home', 'aria-label': t('Search the dictionary') }, mine, most);
}

/**
 * @param {string} title
 * @param {string[]} words
 * @param {boolean} clearable
 */
function group(title, words, clearable) {
	const box = h(
		'div',
		{ class: 'home-group' },
		h(
			'div',
			{ class: 'home-group-head' },
			h('h2', null, clearable ? icon(ICONS.clock, 14) : icon(ICONS.chart, 14), title),
			clearable ? h('button', { type: 'button', class: 'home-clear' }, t('Clear')) : '',
		),
		h('ul', { class: 'home-chips' }, words.map((w) => h('li', null, h('a', { href: definitionHref(w), lang: MYANMAR.test(w) ? 'my' : 'en' }, w)))),
	);
	box.querySelector('.home-clear')?.addEventListener('click', () => {
		clearRecent();
		box.remove();
	});
	return box;
}
