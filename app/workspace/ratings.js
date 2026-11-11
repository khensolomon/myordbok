// @ts-check
/**
 * Ratings (?s=ratings): the entries and meanings the member rated, newest
 * first, each with a way to take the rating back; for editors and admins
 * also the whole site's (?view=site), not helpful most first. One list at a
 * time (meanings or whole entries), filtered, searched by the word's start,
 * and 50 rows a page. A meaning rated before its text changed shows as
 * changed: its rating no longer counts, and rating it again does.
 *
 *   &kind=senses|entries  &value=up|down (yours)  &order=down|up|new (site)  &q=…
 */
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { definitionHref } from '../core/routes.js';
import { react, workspaceRatings } from '../data/api.js';
import { mark, num, posName, t } from '../i18n/index.js';

/** @typedef {import('../data/api.js').RatedSense} RatedSense */
/** @typedef {import('../data/api.js').RatedEntry} RatedEntry */
/** @typedef {import('../data/api.js').RatingsFilter} Filter */

const KINDS = /** @type {const} */ ([
	['senses', mark('Meanings')],
	['entries', mark('Whole entries')],
]);
const VALUES = /** @type {const} */ ([
	['all', mark('All')],
	['up', mark('Helpful')],
	['down', mark('Not helpful')],
]);
const ORDERS = /** @type {const} */ ([
	['down', mark('Not helpful most')],
	['up', mark('Helpful most')],
	['new', mark('Newest')],
]);

/**
 * @param {import('../core/routes.js').ViewContext} ctx
 * @param {boolean} editor
 * @param {(when: number, short?: boolean) => string} ago
 */
export async function ratingsPane(ctx, editor, ago) {
	const q = ctx.query;
	/** @type {Filter} */
	const f = {
		scope: editor && q.get('view') === 'site' ? 'site' : 'mine',
		kind: q.get('kind') === 'entries' ? 'entries' : 'senses',
		value: /** @type {Filter['value']} */ (VALUES.some(([v]) => v === q.get('value')) ? q.get('value') : 'all'),
		order: /** @type {Filter['order']} */ (ORDERS.some(([o]) => o === q.get('order')) ? q.get('order') : 'down'),
		q: (q.get('q') ?? '').trim(),
	};
	const site = f.scope === 'site';
	/** @param {Partial<Filter>} change */
	const href = (change) => {
		const n = { ...f, ...change };
		const p = new URLSearchParams({ s: 'ratings' });
		if (n.scope === 'site') p.set('view', 'site');
		if (n.kind !== 'senses') p.set('kind', n.kind);
		if (n.scope === 'mine' && n.value !== 'all') p.set('value', n.value);
		if (n.scope === 'site' && n.order !== 'down') p.set('order', n.order);
		if (n.q) p.set('q', n.q);
		return `/workspace?${p}`;
	};
	const segments = (/** @type {string} */ label, /** @type {ReadonlyArray<readonly [string, string]>} */ options, /** @type {string} */ now, /** @type {(v: any) => Partial<Filter>} */ change) =>
		h('nav', { class: 'ws-segments', 'aria-label': label }, options.map(([v, text]) => h('a', { href: href(change(v)), 'aria-current': v === now ? 'true' : null }, t(text))));

	const main = h('main', { class: 'ws-main ws-overview ws-ratings', 'aria-label': t('Ratings') });
	const head = h(
		'header',
		{ class: 'ws-ov-head' },
		h('h1', null, t('Ratings')),
		editor
			? h(
					'nav',
					{ class: 'ws-segments', 'aria-label': t('Whose') },
					h('a', { href: href({ scope: 'mine', q: '' }), 'aria-current': site ? null : 'true' }, t('Yours')),
					h('a', { href: href({ scope: 'site', q: '' }), 'aria-current': site ? 'true' : null }, t('Whole site')),
				)
			: '',
	);
	const tiles = h('div', { class: 'ws-tiles' });
	const search = /** @type {HTMLInputElement} */ (h('input', { type: 'search', placeholder: t('Word starts with…'), 'aria-label': t('Find a word'), value: f.q }));
	const list = h('ul', { class: 'ws-rated' });
	const more = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-more', hidden: true }, t('Show more')));
	const card = h(
		'section',
		{ class: 'ws-card ws-card-wide ws-rated-card' },
		h(
			'div',
			{ class: 'ws-rated-bar' },
			segments(t('Kind'), KINDS, f.kind, (v) => ({ kind: v })),
			site ? segments(t('Order'), ORDERS, f.order, (v) => ({ order: v })) : segments(t('Show'), VALUES, f.value, (v) => ({ value: v })),
			h('label', { class: 'ws-search' }, icon(ICONS.search, 14), search),
		),
		site && f.kind === 'senses' ? h('p', { class: 'ws-quiet' }, t('Only ratings of a meaning as it reads now count; a meaning edited since starts again.')) : '',
		list,
		more,
	);
	let shown = 0;

	/** @param {boolean} [again] */
	const load = async (again = false) => {
		const page = await workspaceRatings(f, again ? shown : 0);
		const c = page.counts;
		tiles.replaceChildren(tile(t('Meanings rated'), c.senses), tile(t('Entries rated'), c.entries), tile(t('Helpful'), c.up), tile(t('Not helpful'), c.down));
		if (!again) {
			list.replaceChildren();
			shown = 0;
		}
		shown += page.items.length;
		list.append(
			...page.items.map((r) =>
				site
					? scoreRow(/** @type {any} */ (r), f.kind, ago)
					: f.kind === 'senses'
						? senseRow(/** @type {RatedSense} */ (r), ago)
						: entryRow(/** @type {RatedEntry} */ (r), ago),
			),
		);
		if (!shown) {
			const nothing = f.q || f.value !== 'all' ? t('Nothing matches.') : site ? t('None yet.') : t('Nothing rated yet. On any entry, the thumbs beside a meaning, or beside the whole entry, rate it; what you rate shows up here.');
			list.replaceChildren(h('li', { class: 'ws-quiet ws-rated-none' }, nothing));
		}
		more.hidden = !page.more;
	};

	more.addEventListener('click', () => {
		more.disabled = true;
		load(true)
			.catch((err) => list.append(h('li', { class: 'ws-quiet' }, err instanceof Error ? err.message : String(err))))
			.finally(() => (more.disabled = false));
	});
	let timer = 0;
	search.addEventListener('input', () => {
		clearTimeout(timer);
		timer = window.setTimeout(() => {
			f.q = search.value.trim();
			history.replaceState(history.state, '', href({}));
			load().catch((err) => list.replaceChildren(h('li', { class: 'ws-quiet' }, err instanceof Error ? err.message : String(err))));
		}, 250);
	});

	main.append(h('div', { class: 'ws-work' }, head, h('div', { class: 'ws-ov' }, tiles, card)));
	await load();
	return main;
}

/**
 * A meaning or an entry of the whole site, with its counts.
 * @param {{ lang?: 'en' | 'my', dict?: 'emd' | 'med', word: string, type?: string, sense?: string, up: number, down: number, at?: number }} r
 * @param {'senses' | 'entries'} kind
 * @param {(when: number, short?: boolean) => string} ago
 */
function scoreRow(r, kind, ago) {
	const lang = kind === 'senses' ? (r.dict === 'emd' ? 'en' : 'my') : /** @type {'en' | 'my'} */ (r.lang);
	return h(
		'li',
		{ class: 'ws-rated-row ws-scored-row' },
		h('span', { class: 'ws-score', title: t('{down} down, {up} up', { down: r.down, up: r.up }) }, h('span', { class: 'ws-score-down' }, `${num(r.down)} ↓`), h('span', { class: 'ws-score-up' }, `${num(r.up)} ↑`)),
		h(
			'div',
			{ class: 'ws-rated-text' },
			h('a', { href: definitionHref(r.word), lang }, r.word),
			r.type ? h('em', null, ` ${posName(r.type)}`) : '',
			r.sense ? h('span', { class: 'ws-sense', lang: lang === 'en' ? 'my' : 'en' }, r.sense) : '',
		),
		h('span', { class: 'ws-rated-time' }, r.at ? ago(r.at, true) : ''),
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

/**
 * @param {string} label
 * @param {number} value
 */
function tile(label, value) {
	return h('div', { class: 'ws-tile' }, h('span', { class: 'ws-tile-label' }, label), h('strong', { class: 'ws-tile-value' }, num(value)), h('span', { class: 'ws-tile-sub' }, ''));
}
