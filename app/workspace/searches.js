// @ts-check
/**
 * Searches (?s=searches), for editors and admins: every word searched over a
 * period, most searched first, 50 at a time (worker/routes/searches.js).
 * Not found is the default view: it is the list of what the dictionary
 * lacks. A word opens with its searches day by day; a word never found that
 * has since become a headword says so. The list as filtered downloads as CSV.
 *
 *   &show=missed|found|all  &days=7|30|90|0  &lang=en|my  &q=…  in the address
 */
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { definitionHref } from '../core/routes.js';
import { pruneSearches, searchedWord, searchesQuery, workspaceSearches } from '../data/api.js';
import { mark, num, shortDate, t } from '../i18n/index.js';
import { chart, everyDay, figure } from './overview.js';
import { listBar } from './list-bar.js';

/** @typedef {import('../data/api.js').SearchFilter} Filter */
/** @typedef {import('../data/api.js').SearchedWord} Word */

const SHOWS = /** @type {const} */ ([
	['missed', mark('Not found')],
	['found', mark('Found')],
	['all', mark('All')],
]);
const PERIODS = /** @type {const} */ ([
	[7, mark('7 days')],
	[30, mark('30 days')],
	[90, mark('90 days')],
	[0, mark('All time')],
]);
const ORDERS = /** @type {const} */ ([
	['hits', mark('Most searched')],
	['recent', mark('Last searched')],
	['days', mark('Most days')],
	['az', mark('A to Z')],
]);
const LANGS = /** @type {const} */ ([
	['', mark('Both')],
	['en', mark('English')],
	['my', mark('Myanmar')],
]);
/** Days the chart of one word covers. */
const CHART_DAYS = 90;

/**
 * @param {import('../core/routes.js').ViewContext} ctx
 * @param {HTMLElement} root
 * @param {boolean} admin  May delete older counts.
 */
export async function searchesPanes(ctx, root, admin) {
	const q = ctx.query;
	/** @type {Filter} */
	const f = {
		show: /** @type {Filter['show']} */ (SHOWS.some(([s]) => s === q.get('show')) ? q.get('show') : 'missed'),
		days: /** @type {Filter['days']} */ (PERIODS.some(([d]) => String(d) === q.get('days')) ? Number(q.get('days')) : 30),
		lang: /** @type {Filter['lang']} */ (LANGS.some(([l]) => l === q.get('lang')) ? q.get('lang') : ''),
		q: (q.get('q') ?? '').trim(),
		order: /** @type {Filter['order']} */ (ORDERS.some(([o]) => o === q.get('order')) ? q.get('order') : 'hits'),
	};
	/** The address with one part of the filter changed. @param {Partial<Filter>} change */
	const href = (change) => {
		const p = searchesQuery({ ...f, ...change });
		p.set('s', 'searches');
		return `/workspace?${p}`;
	};

	const listPane = h('section', { class: 'ws-list', 'aria-label': t('Searches') });
	const work = h('main', { class: 'ws-main', 'aria-label': t('Work area') }, h('p', { class: 'ws-empty' }, t('Choose a word from the list.')));
	const inspector = h('aside', { class: 'ws-inspector', 'aria-label': t('Details') });
	const search = /** @type {HTMLInputElement} */ (h('input', { type: 'search', placeholder: t('Contains…'), 'aria-label': t('Find a word'), value: f.q }));
	const ol = h('ol', { class: 'ws-rows' });
	const head = h('span');
	const more = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-more', hidden: true }, t('Show more')));
	/** @type {Word[]} */
	let items = [];
	/** @type {HTMLButtonElement[]} */
	let rows = [];
	let current = -1;

	/** @param {boolean} [again]  Adds the next page instead of starting over. */
	const load = async (again = false) => {
		const page = await workspaceSearches(f, again ? items.length : 0);
		if (!again) {
			items = [];
			rows = [];
			current = -1;
		}
		const from = items.length;
		items.push(...page.words);
		const added = page.words.map((w, i) => row(w, () => open(from + i)));
		rows.push(...added);
		if (!again) ol.replaceChildren();
		ol.append(...added.map((b) => h('li', null, b)));
		if (!items.length) ol.replaceChildren(h('li', { class: 'ws-none' }, f.show === 'missed' ? t('Every search found something.') : t('Nothing searched yet.')));
		more.hidden = !page.more;
		const c = page.counts;
		head.textContent = t('{n} words', { n: num(f.show === 'missed' ? c.missed : f.show === 'found' ? c.found : c.words) });
		summary(c);
	};

	/** @param {number} i */
	const open = async (i) => {
		if (i < 0 || i >= items.length) return;
		current = i;
		rows.forEach((r, n) => r.setAttribute('aria-current', String(n === i)));
		rows[i].scrollIntoView({ block: 'nearest' });
		root.toggleAttribute('data-open', true);
		const w = items[i];
		const back = h('button', { type: 'button', class: 'ws-back', 'aria-label': t('Back to the list') }, icon(ICONS.back, 20));
		back.addEventListener('click', () => root.removeAttribute('data-open'));
		const crumbs = h('header', { class: 'ws-crumbs' }, back, h('span', null, t('Searches')), h('span', { 'aria-hidden': 'true' }, '›'), h('span', { class: 'ws-crumb-word', lang: w.lang }, w.term));
		work.replaceChildren(crumbs, h('div', { class: 'ws-work' }, h('p', { class: 'ws-quiet' }, t('Loading…'))));
		try {
			const d = await searchedWord(w.lang, w.term);
			if (current !== i) return;
			const all = everyDay(
				d.daily.map((x) => ({ day: x.day, hits: x.hits, missed: x.found ? 0 : x.hits })),
				CHART_DAYS,
			);
			const days = d.daily.length;
			const day = (/** @type {string} */ s) => shortDate(new Date(`${s}T00:00:00Z`), { utc: true });
			const copyLabel = h('span', null, t('Copy the word'));
			const copy = h('button', { type: 'button', class: 'ws-secondary' }, icon(ICONS.copy, 15), copyLabel);
			copy.addEventListener('click', () => {
				navigator.clipboard?.writeText(d.term).then(
					() => (copyLabel.textContent = t('Copied')),
					() => {},
				);
			});
			work.replaceChildren(
				crumbs,
				h(
					'div',
					{ class: 'ws-work ws-searched' },
					h('h1', { class: 'ws-searched-word', lang: d.lang }, d.term),
					h('p', { class: 'ws-searched-state' }, state(d.found, d.now)),
					h(
						'div',
						{ class: 'ws-figures' },
						figure(t('Searches'), d.hits, t('since counting began')),
						figure(t('Days searched'), days),
						h('div', { class: 'ws-figure' }, h('span', { class: 'ws-figure-label' }, t('Last searched')), h('strong', { class: 'ws-figure-value ws-figure-date' }, day(d.daily[days - 1].day)), h('span', { class: 'ws-figure-note' }, t('first {when}', { when: day(d.daily[0].day) }))),
					),
					h('h2', { class: 'ws-sub' }, t('The last {n} days', { n: CHART_DAYS })),
					chart(all),
					h('div', { class: 'ws-actions' }, h('a', { class: 'ws-secondary', href: definitionHref(d.term) }, icon(ICONS.dictionary, 15), t('Open in the dictionary')), copy),
				),
			);
		} catch (err) {
			if (current === i) work.replaceChildren(crumbs, h('div', { class: 'ws-work' }, h('p', { class: 'ws-quiet' }, err instanceof Error ? err.message : String(err))));
		}
	};

	/** The inspector: the list's figures and its download. @param {import('../data/api.js').SearchesPage['counts']} c */
	const summary = (c) => {
		const out = h('p', { class: 'ws-result', role: 'status' });
		const download = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-secondary' }, icon(ICONS.download, 15), t('Download as CSV')));
		download.addEventListener('click', async () => {
			download.disabled = true;
			out.textContent = t('Preparing…');
			try {
				const res = await fetch(`/api/workspace/searches?${searchesQuery(f)}&format=csv`, { credentials: 'same-origin' });
				if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message ?? `Download failed with status ${res.status}`);
				const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'searches.csv';
				const url = URL.createObjectURL(await res.blob());
				h('a', { href: url, download: name }).click();
				setTimeout(() => URL.revokeObjectURL(url), 10000);
				out.textContent = '';
			} catch (err) {
				out.textContent = err instanceof Error ? err.message : String(err);
			} finally {
				download.disabled = false;
			}
		});
		const pair = (/** @type {string} */ label, /** @type {number} */ value) => [h('dt', null, label), h('dd', null, num(value))];
		inspector.replaceChildren(
			h(
				'section',
				{ class: 'ws-box' },
				h('h2', null, f.days ? t('Last {n} days', { n: f.days }) : t('All time')),
				h('dl', { class: 'ws-facts' }, pair(t('Words'), c.words), pair(t('Never found'), c.missed), pair(t('Found'), c.found), pair(t('Searches'), c.hits)),
			),
			h('section', { class: 'ws-box' }, h('h2', null, t('This list')), h('p', { class: 'ws-quiet' }, t('Every word that matches the filter, with its figures, for a spreadsheet.')), download, out),
			admin ? pruneBox(() => load()) : '',
			h('section', { class: 'ws-box' }, h('p', { class: 'ws-quiet' }, t('Search counts keep the word, the day and whether it was found; nothing about who searched.'))),
		);
	};

	more.addEventListener('click', () => {
		more.disabled = true;
		load(true)
			.catch((err) => ol.append(h('li', { class: 'ws-none' }, err instanceof Error ? err.message : String(err))))
			.finally(() => (more.disabled = false));
	});
	let timer = 0;
	search.addEventListener('input', () => {
		clearTimeout(timer);
		timer = window.setTimeout(() => {
			f.q = search.value.trim();
			history.replaceState(history.state, '', href({}));
			load().catch((err) => ol.replaceChildren(h('li', { class: 'ws-none' }, err instanceof Error ? err.message : String(err))));
		}, 250);
	});

	/** @param {ReadonlyArray<readonly [string | number, string]>} options */
	const choices = (options) => options.map(([v, text]) => ({ value: String(v), label: t(text) }));
	listPane.append(
		...listBar({
			title: t('Searches'),
			count: head,
			main: { title: t('Show'), current: f.show, fallback: 'missed', href: (v) => href({ show: /** @type {Filter['show']} */ (v) }), choices: choices(SHOWS) },
			search,
			more: [
				{ title: t('Period'), current: String(f.days), fallback: '30', href: (v) => href({ days: /** @type {Filter['days']} */ (Number(v)) }), choices: choices(PERIODS) },
				{ title: t('Language'), current: f.lang, fallback: '', href: (v) => href({ lang: /** @type {Filter['lang']} */ (v) }), choices: choices(LANGS) },
				{ title: t('Sort'), current: f.order, fallback: 'hits', href: (v) => href({ order: /** @type {Filter['order']} */ (v) }), choices: choices(ORDERS) },
			],
			reset: href({ days: 30, lang: '', order: 'hits' }),
		}),
		ol,
		more,
	);
	await load();
	if (items.length && matchMedia('(min-width: 761px)').matches) open(0);

	/** @param {KeyboardEvent} ev */
	const keys = (ev) => {
		if (!root.isConnected) return document.removeEventListener('keydown', keys);
		const target = /** @type {HTMLElement} */ (ev.target);
		if (ev.metaKey || ev.ctrlKey || ev.altKey || target.closest('input, textarea, select, [contenteditable]')) return;
		const k = ev.key.toLowerCase();
		if (k === 'j') open(current + 1);
		else if (k === 'k') open(current - 1);
		else return;
		ev.preventDefault();
	};
	document.addEventListener('keydown', keys);
	return [listPane, work, inspector];
}

/**
 * Deleting the counts older than a number of days, for admins; asks twice.
 * @param {() => Promise<void>} reload
 */
function pruneBox(reload) {
	const days = /** @type {HTMLInputElement} */ (h('input', { type: 'number', min: 30, step: 1, value: 730, class: 'ws-days', 'aria-label': t('Days to keep') }));
	const out = h('p', { class: 'ws-result', role: 'status' });
	const go = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-danger' }, t('Delete older counts')));
	let sure = false;
	go.addEventListener('click', async () => {
		const n = Number(days.value);
		if (!Number.isInteger(n) || n < 30) {
			out.textContent = t('Keep at least {n} days.', { n: 30 });
			return;
		}
		if (!sure) {
			sure = true;
			go.textContent = t('Delete counts older than {n} days?', { n: num(n) });
			setTimeout(() => {
				sure = false;
				if (go.isConnected) go.textContent = t('Delete older counts');
			}, 4000);
			return;
		}
		sure = false;
		go.disabled = true;
		out.textContent = t('Deleting…');
		try {
			const { deleted } = await pruneSearches(n);
			out.textContent = t('{n} day counts deleted.', { n: num(deleted) });
			await reload();
		} catch (err) {
			out.textContent = err instanceof Error ? err.message : String(err);
		} finally {
			go.disabled = false;
			go.textContent = t('Delete older counts');
		}
	});
	return h(
		'section',
		{ class: 'ws-box' },
		h('h2', null, t('Older counts')),
		h('p', { class: 'ws-quiet' }, t('Counts of days older than this are deleted for good; the word lists above then cover less time.')),
		h('label', { class: 'ws-days-row' }, t('Keep the last'), days, t('days')),
		go,
		out,
	);
}

/**
 * @param {boolean} found
 * @param {boolean} now
 */
function state(found, now) {
	if (found) return h('span', { class: 'ws-flag ws-flag-found' }, t('Found'));
	if (now) return h('span', { class: 'ws-flag ws-flag-now' }, t('Not found when searched; now in the dictionary'));
	return h('span', { class: 'ws-flag ws-flag-miss' }, t('Not in the dictionary'));
}

/**
 * @param {Word} w
 * @param {() => void} onOpen
 */
function row(w, onOpen) {
	const last = shortDate(new Date(`${w.last}T00:00:00Z`), { utc: true });
	const b = /** @type {HTMLButtonElement} */ (
		h(
			'button',
			{ type: 'button', class: `ws-row${w.now ? ' ws-row-done' : ''}`, 'aria-current': 'false' },
			h('span', { class: 'ws-row-top' }, h('span', { class: 'ws-row-word', lang: w.lang }, w.term), h('span', { class: 'ws-row-count' }, num(w.hits))),
			h('span', { class: 'ws-row-sub' }, w.days > 1 ? t('{n} days · last {when}', { n: num(w.days), when: last }) : last, w.now ? h('span', { class: 'ws-flag ws-flag-now' }, ` · ${t('now in the dictionary')}`) : ''),
		)
	);
	b.addEventListener('click', onOpen);
	return b;
}

