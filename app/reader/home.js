// @ts-check
/**
 * Home: the page shell's search bar, with the logo above it (styled by
 * body[data-route="home"]); below it, this device's recent searches and the
 * words searched most this week. Recent searches never leave the device;
 * the most searched come from /api/popular (found words only, each searched
 * by several people). Last, a quiet line inviting readers to support
 * MyOrdbok (one of the lines the owner writes in Sponsors, another each visit), when Settings asks for it (support.ask), not for members who
 * support it, and not on a device where it was hidden in the last months.
 */
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { definitionHref } from '../core/routes.js';
import { popularWords, siteSwitches } from '../data/api.js';
import { member } from '../core/member.js';
import { clearRecent, recentSearches, removeRecent } from '../data/recent.js';
import { getLang, t } from '../i18n/index.js';

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
	const ask = h('div', { class: 'home-support', hidden: true });
	supportLine(ask);
	return h('section', { class: 'home', 'aria-label': t('Search the dictionary') }, mine, most, ask);
}

const HIDDEN_KEY = 'mo:support-hidden';
/** Hidden on this device for about four months. */
const HIDDEN_MS = 120 * 86400000;

/**
 * Shows the line in `box` when it should be.
 * @param {HTMLElement} box
 */
async function supportLine(box) {
	try {
		if (Number(localStorage.getItem(HIDDEN_KEY)) > Date.now()) return;
	} catch {
		// storage blocked: shown, and hiding lasts this visit
	}
	const [site, me] = await Promise.all([siteSwitches(), member().catch(() => null)]);
	if (!site.support_ask || me?.supporter) return;
	const hide = h('button', { type: 'button', class: 'home-support-hide', 'aria-label': t('Hide for now'), title: t('Hide for now') }, icon(ICONS.close, 14));
	hide.addEventListener('click', () => {
		try {
			localStorage.setItem(HIDDEN_KEY, String(Date.now() + HIDDEN_MS));
		} catch {
			// storage blocked: hidden for this visit
		}
		box.remove();
	});
	box.replaceChildren(
		h('span', { class: 'home-support-icon', 'aria-hidden': 'true' }, icon(ICONS.like, 16)),
		h('p', null, pickLine(site.support_lines), ' ', h('a', { href: '/support' }, t('Support MyOrdbok'))),
		hide,
	);
	box.hidden = false;
}

const LAST_KEY = 'mo:support-line';

/**
 * One of the lines the owner wrote (Sponsors), in the interface language
 * when it has that, and not the one shown last on this device.
 * @param {Array<{ en: string, my?: string }>} lines
 */
function pickLine(lines) {
	let last = -1;
	try {
		last = Number(localStorage.getItem(LAST_KEY) ?? -1);
	} catch {
		// storage blocked: any line
	}
	const choices = lines.map((_, i) => i).filter((i) => i !== last || lines.length === 1);
	const at = choices[Math.floor(Math.random() * choices.length)];
	try {
		localStorage.setItem(LAST_KEY, String(at));
	} catch {
		// storage blocked: the next one may repeat
	}
	const line = lines[at];
	return getLang() === 'my' && line.my ? line.my : line.en;
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
