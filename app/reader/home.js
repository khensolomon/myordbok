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
import { clearRecent, recentSearches, removeRecent } from '../data/recent.js';
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
 * A centred heading over centred words. Recent searches can be cleared all
 * at once, or one at a time with the × in each.
 * @param {string} title
 * @param {string[]} words
 * @param {boolean} mine  This device's recent searches.
 */
function group(title, words, mine) {
	/** @param {string} w */
	const chip = (w) => {
		const link = h('a', { href: definitionHref(w), lang: MYANMAR.test(w) ? 'my' : 'en' }, w);
		if (!mine) return h('li', { class: 'home-chip' }, link);
		const remove = h('button', { type: 'button', class: 'home-remove', 'aria-label': t('Remove “{word}”', { word: w }), title: t('Remove “{word}”', { word: w }) }, icon(ICONS.close, 14));
		const item = h('li', { class: 'home-chip' }, link, remove);
		remove.addEventListener('click', () => {
			if (removeRecent(w).length) item.remove();
			else box.remove();
		});
		return item;
	};
	const clear = mine ? h('button', { type: 'button', class: 'home-clear' }, t('Clear')) : '';
	const box = h(
		'div',
		{ class: 'home-group' },
		h('div', { class: 'home-group-head' }, h('h2', null, mine ? icon(ICONS.clock, 14) : icon(ICONS.chart, 14), title), clear),
		h('ul', { class: 'home-chips' }, words.map(chip)),
	);
	if (clear)
		clear.addEventListener('click', () => {
			clearRecent();
			box.remove();
		});
	return box;
}
