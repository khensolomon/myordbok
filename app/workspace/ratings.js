// @ts-check
/**
 * Ratings (?s=ratings), in three columns (columns.js): the entries and
 * meanings the member rated, newest first; for editors and members shown
 * the statistics also the whole site's (&view=site), not helpful most first.
 * One list at a time (meanings or whole entries), filtered, searched by the
 * word's start, 50 rows a page. A rating opens with the meaning in its entry
 * as the dictionary has it now, and beside it a way to take one's own rating
 * back. A meaning rated before its text changed shows as changed: its rating
 * no longer counts, and rating it again does.
 *
 *   &view=site  &kind=senses|entries  &value=up|down (yours)  &order=down|up|new (site)  &q=…
 */
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { definitionHref } from '../core/routes.js';
import { react, workspaceRatings } from '../data/api.js';
import { mark, num, posName, t } from '../i18n/index.js';
import { entryMeanings, fact, listColumns, plainSense } from './columns.js';

/** @typedef {import('../data/api.js').RatedSense} RatedSense */
/** @typedef {import('../data/api.js').RatedEntry} RatedEntry */
/** @typedef {import('../data/api.js').RatingsFilter} Filter */
/** @typedef {{ lang?: 'en' | 'my', dict?: 'emd' | 'med', sense_id?: number, word: string, type?: string, sense?: string, up: number, down: number, at?: number }} Score */
/** @typedef {RatedSense | RatedEntry | Score} Item */

const WHOSE = /** @type {const} */ ([
	['mine', mark('Yours')],
	['site', mark('Whole site')],
]);
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
 * @param {HTMLElement} root
 * @param {boolean} editor  Sees the whole site's ratings (editors and up, or a member shown the statistics).
 * @param {boolean} studio  Opens words in the studio (editors and up).
 * @param {(when: number, short?: boolean) => string} ago
 */
export async function ratingsPanes(ctx, root, editor, studio, ago) {
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
	const search = /** @type {HTMLInputElement} */ (h('input', { type: 'search', placeholder: t('Word starts with…'), 'aria-label': t('Find a word'), value: f.q }));
	/** Ratings taken back here, by row key, so the row stays and reads so. */
	const taken = new Set();
	const key = (/** @type {Item} */ r) => `${'sense_id' in r ? r.sense_id : ''}|${r.word}`;
	/** @type {(r: Item) => 'en' | 'my'} */
	const langOf = (r) => ('dict' in r && r.dict ? (r.dict === 'emd' ? 'en' : 'my') : 'lang' in r && r.lang ? r.lang : 'en');
	const other = (/** @type {'en' | 'my'} */ lang) => (lang === 'en' ? 'my' : 'en');

	return listColumns({
		root,
		title: t('Ratings'),
		choose: t('Choose a rating from the list.'),
		nothing: (filtered) => (filtered || f.value !== 'all' ? t('Nothing matches.') : site ? t('None yet.') : t('Nothing rated yet. On any entry, the thumbs beside a meaning, or beside the whole entry, rate it; what you rate shows up here.')),
		search,
		fetch: async (offset) => {
			const page = await workspaceRatings({ ...f, q: search.value.trim() }, offset);
			return { items: /** @type {Item[]} */ (page.items), more: page.more, counts: page.counts };
		},
		count: (page) => t('{n} in all', { n: num(/** @type {any} */ (page).counts[f.kind]) }),
		bar: () => ({
			groups: [
				...(editor ? [{ title: t('Whose'), current: f.scope, fallback: 'mine', href: (/** @type {string} */ v) => href({ scope: /** @type {Filter['scope']} */ (v), q: '' }), choices: WHOSE.map(([v, l]) => ({ value: v, label: t(l) })) }] : []),
				{ title: t('Kind'), current: f.kind, fallback: 'senses', href: (v) => href({ kind: /** @type {Filter['kind']} */ (v) }), choices: KINDS.map(([v, l]) => ({ value: v, label: t(l) })) },
				site
					? { title: t('Order'), current: f.order, fallback: 'down', href: (v) => href({ order: /** @type {Filter['order']} */ (v) }), choices: ORDERS.map(([v, l]) => ({ value: v, label: t(l) })) }
					: { title: t('Show'), current: f.value, fallback: 'all', href: (v) => href({ value: /** @type {Filter['value']} */ (v) }), choices: VALUES.map(([v, l]) => ({ value: v, label: t(l) })) },
			],
			search,
			reset: href({ kind: 'senses', value: 'all', order: 'down', q: '' }),
		}),
		row: (r) => {
			const lang = langOf(r);
			const sense = 'sense' in r && r.sense ? plainSense(r.sense) || r.sense : undefined;
			if ('up' in r) {
				return { word: r.word, lang, aside: `${num(r.down)} ↓  ${num(r.up)} ↑`, sub: sense ?? t('The whole entry'), subLang: sense ? other(lang) : undefined, state: [r.type ? posName(r.type) : '', r.at ? ago(r.at, true) : ''].filter(Boolean).join(' · ') };
			}
			const gone = taken.has(key(r));
			const changed = 'state' in r && r.state === 'changed';
			return {
				word: r.word ?? t('A meaning no longer in the dictionary'),
				lang,
				tag: r.value > 0 ? t('Helpful') : t('Not helpful'),
				sub: f.kind === 'senses' ? sense ?? '—' : t('The whole entry'),
				subLang: sense ? other(lang) : undefined,
				state: gone ? t('Taken back') : changed ? t('changed since you rated it') : ago(r.at, true),
				off: gone || ('state' in r && r.state === 'gone'),
			};
		},
		show: (r, then) => {
			const lang = langOf(r);
			const sense = 'sense' in r && r.sense ? plainSense(r.sense) || r.sense : null;
			const senseId = 'sense_id' in r ? r.sense_id : null;
			const type = 'type' in r && r.type ? r.type : null;
			const head = h('header', { class: 'ws-item-head' }, h('h1', { lang }, r.word ?? t('A meaning no longer in the dictionary')), type ? h('em', null, posName(type)) : null);
			const what = sense ? h('p', { class: 'ws-item-sense', lang: other(lang) }, sense) : h('p', { class: 'ws-quiet' }, t('The whole entry'));
			/** @type {Array<Node | null>} */
			const side = [];
			if ('up' in r) {
				const all = r.up + r.down;
				side.push(
					h(
						'section',
						{ class: 'ws-box' },
						h('h2', null, t('Ratings')),
						h('dl', { class: 'ws-facts ws-facts-side' }, ...fact(t('Not helpful'), r.down), ...fact(t('Helpful'), r.up), ...fact(t('Helpful share'), all ? `${num(Math.round((r.up / all) * 100))}%` : '—'), ...(r.at ? fact(t('Last rated'), ago(r.at)) : [])),
						f.kind === 'senses' ? h('p', { class: 'ws-quiet' }, t('Only ratings of a meaning as it reads now count; a meaning edited since starts again.')) : null,
					),
				);
			} else {
				const gone = taken.has(key(r));
				const undo = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-secondary', disabled: gone || !r.word ? true : null }, gone ? t('Taken back') : t('Take back')));
				const out = h('p', { class: 'ws-result', role: 'status' });
				undo.addEventListener('click', async () => {
					undo.disabled = true;
					try {
						await react(lang, /** @type {string} */ (r.word), 0, senseId ?? undefined);
						taken.add(key(r));
						then.update(r);
					} catch (err) {
						undo.disabled = false;
						out.textContent = err instanceof Error ? err.message : String(err);
					}
				});
				side.push(
					h(
						'section',
						{ class: 'ws-box ws-item-side-act' },
						h('h2', null, t('Your rating')),
						h('p', { class: `ws-rating-is ${r.value > 0 ? 'ws-thumb-up' : 'ws-thumb-down'}` }, icon(r.value > 0 ? ICONS.thumbUp : ICONS.thumbDown, 16), r.value > 0 ? t('Helpful') : t('Not helpful'), h('span', { class: 'ws-quiet' }, ` · ${ago(r.at)}`)),
						'state' in r && r.state === 'changed' ? h('p', { class: 'ws-quiet' }, t('The meaning changed since you rated it; the rating no longer counts. Rating it again on the entry does.')) : null,
						undo,
						out,
					),
				);
			}
			if (r.word) {
				side.push(
					h(
						'section',
						{ class: 'ws-box ws-links' },
						h('h2', null, t('Entry')),
						h('a', { href: definitionHref(r.word) }, t('Open the entry')),
						studio ? h('a', { href: `/workspace?s=studio&word=${encodeURIComponent(r.word)}` }, t('Open in the studio')) : null,
					),
				);
			}
			return {
				name: r.word ?? '—',
				lang,
				main: [head, what, r.word ? entryMeanings(r.word, { id: senseId, type }) : null],
				side,
			};
		},
	});
}
