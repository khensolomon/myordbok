// @ts-check
/**
 * Definition page: /definition?q=word
 * Senses grouped by part of speech: an open timeline on wide screens and one
 * card per part of speech on phones (CSS decides, the markup is the same).
 */
import { AppError } from '#shared/errors.js';
import { detectLang } from '#shared/validate.js';
import { h } from '../core/dom.js';
import { renderMarkup } from '../core/markup.js';
import { definitionHref } from '../core/routes.js';
import { entry, search } from '../data/api.js';
import './search-box.js';

/** @param {import('../core/routes.js').ViewContext} ctx */
export function title(ctx) {
	return ctx.query.get('q') ?? 'Definition';
}

/** @param {import('../core/routes.js').ViewContext} ctx */
export async function view(ctx) {
	const q = (ctx.query.get('q') ?? '').trim();
	const box = h('mo-search', { class: 'search-top', value: q });
	box.addEventListener('mo-search', (e) => ctx.go(definitionHref(/** @type {CustomEvent<string>} */ (e).detail)));

	if (!q) return h('section', { class: 'page' }, box, h('p', { class: 'notice' }, 'Type a word to look it up.'));

	const lang = detectLang(q);
	try {
		const data = await entry(lang, q);
		return h('article', { class: 'entry', lang: data.lang === 'my' ? 'my' : 'en' }, box, head(data), senses(data));
	} catch (err) {
		if (err instanceof AppError && err.code === 'not_found') return missing(box, q);
		throw err;
	}
}

/** @param {import('#shared/types.js').Entry} data */
function head(data) {
	return h(
		'header',
		{ class: 'entry-head' },
		h('span', { class: 'lang-badge', 'aria-label': data.lang === 'en' ? 'English' : 'Myanmar' }, data.lang),
		h('h1', { class: 'headword' }, data.word),
	);
}

/** @param {import('#shared/types.js').Entry} data */
function senses(data) {
	const otherLang = data.lang === 'en' ? 'my' : 'en';
	return h(
		'div',
		{ class: 'timeline' },
		data.pos.map((pos) =>
			h(
				'section',
				{ class: 'pos' },
				h('h2', { class: 'pos-name' }, pos.name),
				h(
					'ul',
					{ class: 'senses' },
					pos.senses.map((s) =>
						h(
							'li',
							{ class: 'sense' },
							h('p', { class: 'gloss', lang: otherLang }, renderMarkup(s.sense)),
							s.exam ? h('p', { class: 'example' }, renderMarkup(s.exam)) : null,
						),
					),
				),
			),
		),
	);
}

/**
 * @param {HTMLElement} box
 * @param {string} q
 */
async function missing(box, q) {
	const { words } = await search(q).catch(() => ({ words: /** @type {string[]} */ ([]) }));
	return h(
		'section',
		{ class: 'page' },
		box,
		h('h1', { class: 'notice-title' }, `No entry for “${q}”`),
		words.length
			? h('div', null, h('p', null, 'Words that start the same way:'), h('ul', { class: 'chips' }, words.map((w) => h('li', null, h('a', { href: definitionHref(w) }, w)))))
			: h('p', null, 'Check the spelling, or try the root form of the word.'),
	);
}
