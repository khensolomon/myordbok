// @ts-check
/**
 * Ratings (?s=ratings): the entries and meanings the member rated, each with
 * a way to take the rating back; for editors and admins also the site's most
 * liked and disliked (?view=site). A meaning rated before its text changed
 * shows as changed: its rating no longer counts, and rating it again does.
 */
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { definitionHref } from '../core/routes.js';
import { react, workspaceRatings } from '../data/api.js';
import { num, posName, t } from '../i18n/index.js';

/** @typedef {import('../data/api.js').RatedSense} RatedSense */
/** @typedef {import('../data/api.js').RatedEntry} RatedEntry */

/**
 * @param {import('../core/routes.js').ViewContext} ctx
 * @param {boolean} editor
 * @param {(when: number, short?: boolean) => string} ago
 */
export async function ratingsPane(ctx, editor, ago) {
	const site = editor && ctx.query.get('view') === 'site';
	const main = h('main', { class: 'ws-main ws-overview ws-ratings', 'aria-label': t('Ratings') });
	const head = h(
		'header',
		{ class: 'ws-ov-head' },
		h('h1', null, t('Ratings')),
		editor
			? h(
					'nav',
					{ class: 'ws-segments', 'aria-label': t('Show') },
					h('a', { href: '/workspace?s=ratings', 'aria-current': site ? null : 'true' }, t('Yours')),
					h('a', { href: '/workspace?s=ratings&view=site', 'aria-current': site ? 'true' : null }, t('Whole site')),
				)
			: '',
	);
	const work = h('div', { class: 'ws-work' }, head);
	main.append(work);
	work.append(site ? await sitePane() : await minePane(ago));
	return main;
}

/** @param {(when: number, short?: boolean) => string} ago */
async function minePane(ago) {
	const data = await workspaceRatings('mine');
	if (!data.entries.length && !data.senses.length) {
		return h('p', { class: 'ws-quiet ws-ov-tip' }, t('Nothing rated yet. On any entry, the thumbs beside a meaning, or beside the whole entry, rate it; what you rate shows up here.'));
	}
	const total = (/** @type {Array<{ value: number }>} */ list, /** @type {number} */ v) => list.filter((r) => r.value === v).length;
	return h(
		'div',
		{ class: 'ws-ov' },
		h(
			'div',
			{ class: 'ws-tiles' },
			tile(t('Meanings rated'), data.senses.length),
			tile(t('Helpful'), total(data.senses, 1) + total(data.entries, 1)),
			tile(t('Not helpful'), total(data.senses, -1) + total(data.entries, -1)),
			tile(t('Entries rated'), data.entries.length),
		),
		data.senses.length ? h('section', { class: 'ws-card ws-card-wide' }, h('h2', null, t('Meanings')), h('ul', { class: 'ws-rated' }, data.senses.map((s) => senseRow(s, ago)))) : '',
		data.entries.length ? h('section', { class: 'ws-card ws-card-wide' }, h('h2', null, t('Whole entries')), h('ul', { class: 'ws-rated' }, data.entries.map((e) => entryRow(e, ago)))) : '',
	);
}

/**
 * @param {RatedSense} s
 * @param {(when: number, short?: boolean) => string} ago
 */
function senseRow(s, ago) {
	const lang = s.dict === 'emd' ? 'en' : 'my';
	const undo = takeBack(() => react(lang, /** @type {string} */ (s.word), 0, s.sense_id));
	return h(
		'li',
		{ class: `ws-rated-row${s.state === 'current' ? '' : ' ws-rated-stale'}` },
		thumb(s.value),
		h(
			'div',
			{ class: 'ws-rated-text' },
			s.word ? h('a', { href: definitionHref(s.word), lang }, s.word) : h('span', null, t('A meaning no longer in the dictionary')),
			s.type ? h('em', null, ` ${posName(s.type)}`) : '',
			s.sense ? h('span', { class: 'ws-sense', lang: lang === 'en' ? 'my' : 'en' }, s.sense) : '',
			s.state === 'changed' ? h('span', { class: 'ws-flag' }, t('changed since you rated it; the rating no longer counts')) : '',
		),
		h('span', { class: 'ws-rated-time' }, ago(s.at, true)),
		s.word ? undo : '',
	);
}

/**
 * @param {RatedEntry} e
 * @param {(when: number, short?: boolean) => string} ago
 */
function entryRow(e, ago) {
	return h(
		'li',
		{ class: 'ws-rated-row' },
		thumb(e.value),
		h('div', { class: 'ws-rated-text' }, h('a', { href: definitionHref(e.word), lang: e.lang }, e.word)),
		h('span', { class: 'ws-rated-time' }, ago(e.at, true)),
		takeBack(() => react(e.lang, e.word, 0)),
	);
}

/** @param {number} value */
function thumb(value) {
	return h('span', { class: `ws-thumb ${value > 0 ? 'ws-thumb-up' : 'ws-thumb-down'}`, title: value > 0 ? t('Helpful') : t('Not helpful'), role: 'img', 'aria-label': value > 0 ? t('Helpful') : t('Not helpful') }, icon(value > 0 ? ICONS.thumbUp : ICONS.thumbDown, 16));
}

/**
 * A button that takes a rating back and then strikes the row through.
 * @param {() => Promise<unknown>} undo
 */
function takeBack(undo) {
	const b = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-link-button' }, t('Take back')));
	b.addEventListener('click', async () => {
		b.disabled = true;
		try {
			await undo();
			b.closest('li')?.classList.add('ws-rated-gone');
			b.textContent = t('Taken back');
		} catch (err) {
			b.disabled = false;
			b.title = err instanceof Error ? err.message : String(err);
		}
	});
	return b;
}

async function sitePane() {
	const data = await workspaceRatings('site');
	/**
	 * @param {string} title
	 * @param {import('../data/api.js').SenseScore[]} list
	 * @param {'up' | 'down'} by
	 */
	const senses = (title, list, by) =>
		h(
			'section',
			{ class: 'ws-card' },
			h('h2', null, title),
			list.length
				? h(
						'ol',
						{ class: 'ws-words ws-disliked' },
						list.map((s) =>
							h(
								'li',
								null,
								h('span', null, h('a', { href: definitionHref(s.word), lang: s.dict === 'emd' ? 'en' : 'my' }, s.word), h('span', { class: 'ws-sense', lang: s.dict === 'emd' ? 'my' : 'en' }, s.sense)),
								h('span', { title: t('{down} down, {up} up', { down: s.down, up: s.up }) }, by === 'up' ? `${num(s.up)} ↑ ${num(s.down)} ↓` : `${num(s.down)} ↓ ${num(s.up)} ↑`),
							),
						),
					)
				: h('p', { class: 'ws-quiet' }, t('None yet.')),
		);
	/**
	 * @param {string} title
	 * @param {import('../data/api.js').EntryScore[]} list
	 * @param {'up' | 'down'} by
	 */
	const entries = (title, list, by) =>
		h(
			'section',
			{ class: 'ws-card' },
			h('h2', null, title),
			list.length
				? h(
						'ol',
						{ class: 'ws-words' },
						list.map((e) => h('li', null, h('a', { href: definitionHref(e.word), lang: e.lang }, e.word), h('span', null, by === 'up' ? `${num(e.up)} ↑ ${num(e.down)} ↓` : `${num(e.down)} ↓ ${num(e.up)} ↑`))),
					)
				: h('p', { class: 'ws-quiet' }, t('None yet.')),
		);
	return h(
		'div',
		{ class: 'ws-ov' },
		h('p', { class: 'ws-quiet' }, t('Only ratings of a meaning as it reads now count; a meaning edited since starts again.')),
		h('div', { class: 'ws-cards' }, senses(t('Meanings rated down most'), data.senses.disliked, 'down'), senses(t('Meanings rated up most'), data.senses.liked, 'up')),
		h('div', { class: 'ws-cards' }, entries(t('Entries rated down most'), data.entries.disliked, 'down'), entries(t('Entries rated up most'), data.entries.liked, 'up')),
	);
}

/**
 * @param {string} label
 * @param {number} value
 */
function tile(label, value) {
	return h('div', { class: 'ws-tile' }, h('span', { class: 'ws-tile-label' }, label), h('strong', { class: 'ws-tile-value' }, num(value)), h('span', { class: 'ws-tile-sub' }, ''));
}
