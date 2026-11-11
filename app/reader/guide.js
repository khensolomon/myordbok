// @ts-check
/**
 * /definition with no word: how to search, with examples to try, and the
 * dictionary in figures (/api/stats). The figures arrive after the page is
 * shown; without them the page reads the same, less the numbers.
 */
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { definitionHref } from '../core/routes.js';
import { dictionaryStats } from '../data/api.js';
import { mark, num, t } from '../i18n/index.js';

/** What can be typed: a title, what it does, and examples that open it. */
const WAYS = /** @type {const} */ ([
	['dictionary', mark('A word'), mark('In English or in Myanmar; Myanmar written without spaces is split into its words.'), ['love', 'beautiful', 'ချစ်']],
	['grammar', mark('A phrase or a sentence'), mark('A phrase is read from its words’ entries; a sentence opens one word at a time.'), ['king of Norway', 'I love you']],
	['search', mark('A question'), mark('Ask the way you would ask a person; the part asked about opens.'), ['what is love', 'similar word of love', 'opposite of love']],
	['chart', mark('A number'), mark('Read in words both ways, in Western and Myanmar digits.'), ['10000', '၁၀၀၀၀', 'ten thousand']],
	['document', mark('A sum'), mark('Worked out on the device, percentages too.'), ['x=3/4*12', '10% of 70']],
	['clock', mark('The time or the date'), mark('From the device’s clock, in English and in Myanmar.'), ['what time is it', 'what is the date']],
]);

export function guide() {
	const figures = h('div', { class: 'guide-figures', hidden: true });
	const page = h(
		'section',
		{ class: 'page guide' },
		h(
			'header',
			{ class: 'guide-hero' },
			h('p', { class: 'guide-kicker' }, 'English ⇄ ', h('span', { lang: 'my' }, 'မြန်မာ')),
			h('h1', null, t('Look up anything, either way')),
			h('p', { class: 'guide-lead' }, t('Type in the box above, in English or in Myanmar. What you type is read before it is looked up, so a word, a phrase, a question, a number or a sum each gets the answer it needs.')),
			figures,
		),
		h(
			'div',
			{ class: 'guide-ways' },
			WAYS.map(([glyph, title, about, examples]) =>
				h(
					'article',
					{ class: 'guide-way' },
					h('span', { class: 'guide-icon', 'aria-hidden': 'true' }, icon(ICONS[glyph], 20)),
					h('h2', null, t(title)),
					h('p', null, t(about)),
					h('p', { class: 'guide-tries' }, examples.map((q) => h('a', { href: definitionHref(q), lang: /[က-႟]/.test(q) ? 'my' : 'en' }, q))),
				),
			),
		),
		h(
			'aside',
			{ class: 'guide-tips' },
			h('p', { class: 'guide-keys' }, h('kbd', null, '/'), ' ', t('or'), ' ', h('kbd', null, 'Ctrl K'), ' ', t('puts the cursor in the search box from anywhere.')),
			h('p', null, t('Signed-in members can keep the definitions on the device and look words up offline.')),
			h('p', null, t('Also here:'), ' ', h('a', { href: '/grammar' }, t('Myanmar grammar')), ' · ', h('a', { href: '/myanmar-fonts' }, t('Myanmar fonts'))),
		),
	);
	dictionaryStats()
		.then(({ stats }) => {
			if (!stats) return;
			const figure = (/** @type {number} */ n, /** @type {string} */ label) => h('div', { class: 'guide-figure' }, h('strong', null, num(n)), h('span', null, label));
			figures.replaceChildren(
				figure(stats.en.headwords, t('English words')),
				figure(stats.en.senses, t('English meanings')),
				figure(stats.my.headwords, t('Myanmar words')),
				figure(stats.my.senses, t('Myanmar meanings')),
			);
			figures.hidden = false;
		})
		.catch((err) => console.warn('Dictionary figures unavailable:', err));
	return page;
}
