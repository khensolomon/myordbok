// @ts-check
/**
 * Searches (?s=searches), for editors and admins: every word searched over a
 * period, most searched first, 50 at a time (worker/routes/searches.js).
 * Not found is the default view: it is the list of what the dictionary
 * lacks. A word opens with its searches day by day; a word never found that
 * has since become a headword says so. The list as filtered downloads as CSV,
 * every column or the word alone (the choice kept on the device).
 *
 * Labels: an editor says what a word never found is (to add, a misspelling,
 * not a word), one word at a time on its page (keys 1 2 3, 0 takes it off;
 * the next word opens by itself) or many at once with the boxes in the list.
 * The default list holds the words still to sort and those to add, so that
 * working down it leaves nothing behind; the filters narrow it further.
 *
 *   &show=missed|found|all  &days=1|3|5|7|30|90|0  &lang=en|my  &q=…  &order=…
 *   &label=open|none|add|misspelling|noise|all  &min=…  &spread=…
 *   &shape=word|phrase|digits  &fresh=1  &noted=1          in the address
 */
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { definitionHref } from '../core/routes.js';
import { markSearches, pruneSearches, searchedWord, searchesQuery, workspaceSearches } from '../data/api.js';
import { mark, num, shortDate, t } from '../i18n/index.js';
import { chart, everyDay, figure } from './overview.js';
import { listBar } from './list-bar.js';

/** @typedef {import('../data/api.js').SearchFilter} Filter */
/** @typedef {import('../data/api.js').SearchedWord} Word */
/** @typedef {import('../data/api.js').SearchLabel} Label */

/** Device key: what a CSV holds, every column or the word alone. */
const CSV_KEY = 'mo:searches-csv';
const SHOWS = /** @type {const} */ ([
	['missed', mark('Not found')],
	['found', mark('Found')],
	['all', mark('All')],
]);
/** A label an editor gives, with its key on the word's page. */
const LABELS = /** @type {ReadonlyArray<readonly [Label, string, string]>} */ ([
	['add', mark('To add'), '1'],
	['misspelling', mark('Misspelling'), '2'],
	['noise', mark('Not a word'), '3'],
]);
/** What the list shows by label; "open" is what is left to do. */
const LABEL_VIEWS = /** @type {const} */ ([
	['open', mark('To do')],
	['none', mark('To sort')],
	['add', mark('To add')],
	['misspelling', mark('Misspelling')],
	['noise', mark('Not a word')],
	['all', mark('All')],
]);
const PERIODS = /** @type {const} */ ([
	[1, mark('Today')],
	[3, mark('3 days')],
	[5, mark('5 days')],
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
const MINS = /** @type {const} */ ([
	[1, mark('Any')],
	[2, mark('2+')],
	[5, mark('5+')],
	[10, mark('10+')],
	[25, mark('25+')],
]);
const SPREADS = /** @type {const} */ ([
	[1, mark('Any')],
	[2, mark('2+ days')],
	[5, mark('5+ days')],
]);
const SHAPES = /** @type {const} */ ([
	['', mark('Any')],
	['word', mark('One word')],
	['phrase', mark('Several words')],
	['digits', mark('With a number')],
]);
const LANGS = /** @type {const} */ ([
	['', mark('Both')],
	['en', mark('English')],
	['my', mark('Myanmar')],
]);
/** Days the chart of one word covers. */
const CHART_DAYS = 90;
/** Most words labelled in one go (worker/routes/searches.js MARK_MAX). */
const MARK_MAX = 200;

/** @param {Label | null} label */
const labelName = (label) => (label ? t(/** @type {readonly [Label, string, string]} */ (LABELS.find(([l]) => l === label))[1]) : '');

/**
 * @param {import('../core/routes.js').ViewContext} ctx
 * @param {HTMLElement} root
 * @param {{ admin: boolean, editor: boolean }} may  admin: deletes older counts; editor: labels words.
 */
export async function searchesPanes(ctx, root, may) {
	const q = ctx.query;
	const one = (/** @type {ReadonlyArray<readonly [string | number, string]>} */ options, /** @type {string} */ name, /** @type {string | number} */ fallback) => {
		const hit = options.find(([v]) => String(v) === q.get(name));
		return hit ? hit[0] : fallback;
	};
	/** @type {Filter} */
	const f = {
		show: /** @type {Filter['show']} */ (one(SHOWS, 'show', 'missed')),
		days: /** @type {Filter['days']} */ (one(PERIODS, 'days', 30)),
		lang: /** @type {Filter['lang']} */ (one(LANGS, 'lang', '')),
		q: (q.get('q') ?? '').trim(),
		order: /** @type {Filter['order']} */ (one(ORDERS, 'order', 'hits')),
		label: /** @type {Filter['label']} */ (one(LABEL_VIEWS, 'label', 'open')),
		min: /** @type {Filter['min']} */ (one(MINS, 'min', 1)),
		spread: /** @type {Filter['spread']} */ (one(SPREADS, 'spread', 1)),
		shape: /** @type {Filter['shape']} */ (one(SHAPES, 'shape', '')),
		fresh: q.get('fresh') === '1',
		noted: q.get('noted') === '1',
	};
	/** The address with one part of the filter changed. @param {Partial<Filter>} change */
	const href = (change) => {
		const p = searchesQuery({ ...f, ...change });
		p.set('s', 'searches');
		return `/workspace?${p}`;
	};
	/** Whether a word with this label belongs to the list as filtered. @param {Label | null} label */
	const listed = (label) => f.show !== 'missed' || f.label === 'all' || (f.label === 'open' ? label === null || label === 'add' : f.label === 'none' ? label === null : f.label === label);

	const listPane = h('section', { class: 'ws-list', 'aria-label': t('Searches') });
	const work = h('main', { class: 'ws-main', 'aria-label': t('Work area') }, h('p', { class: 'ws-empty' }, t('Choose a word from the list.')));
	const inspector = h('aside', { class: 'ws-inspector', 'aria-label': t('Details') });
	const search = /** @type {HTMLInputElement} */ (h('input', { type: 'search', placeholder: t('Searched word contains…'), 'aria-label': t('Find a word'), value: f.q }));
	const ol = h('ol', { class: `ws-rows${may.editor ? ' ws-rows-pick' : ''}` });
	const head = h('span');
	const more = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-more', hidden: true }, t('Show more')));
	const bulk = h('div', { class: 'ws-bulk', hidden: true, role: 'region', 'aria-label': t('Selected words') });
	/** @type {Word[]} */
	let items = [];
	/** @type {HTMLButtonElement[]} */
	let rows = [];
	/** @type {HTMLInputElement[]} */
	let boxes = [];
	let current = -1;
	/** The box last ticked or cleared, for a range with Shift. */
	let anchor = -1;
	/** @type {import('../data/api.js').SearchesPage['counts'] | null} */
	let counts = null;

	const showCount = () => {
		if (counts) head.textContent = t('{n} words', { n: num(counts.listed) });
	};

	/** The row follows the word's label; a word that left the list as filtered is dimmed until the list is loaded again. @param {number} i */
	const redraw = (i) => {
		const w = items[i];
		rows[i].classList.toggle('ws-row-done', w.now || !listed(w.label));
		const chip = rows[i].querySelector('.ws-label');
		if (chip) {
			chip.textContent = labelName(w.label);
			chip.className = `ws-label${w.label ? ` ws-label-${w.label}` : ''}`;
			/** @type {HTMLElement} */ (chip).hidden = !w.label;
		}
	};

	/**
	 * Labels words and shows it: in the list, in the counts, on the open word.
	 * @param {number[]} which  Their places in the list.
	 * @param {Label | null} label
	 */
	const label = async (which, label) => {
		const changed = which.filter((i) => items[i].label !== label && !items[i].found);
		if (!changed.length) return 0;
		await markSearches(changed.map((i) => ({ lang: items[i].lang, term: items[i].term })), { label });
		for (const i of changed) {
			const before = items[i].label;
			if (counts) {
				counts.labels[before ?? 'none']--;
				counts.labels[label ?? 'none']++;
				if (listed(before) !== listed(label)) counts.listed += listed(label) ? 1 : -1;
			}
			items[i] = { ...items[i], label };
			redraw(i);
		}
		showCount();
		if (counts) summary(counts);
		return changed.length;
	};

	/** The bar over the list while boxes are ticked. */
	const drawBulk = () => {
		const picked = boxes.flatMap((b, i) => (b.checked ? [i] : []));
		bulk.hidden = picked.length === 0;
		ol.classList.toggle('ws-rows-picking', picked.length > 0);
		if (!picked.length) return;
		const out = h('span', { class: 'ws-bulk-out', role: 'status' });
		const clear = () => {
			boxes.forEach((b) => (b.checked = false));
			anchor = -1;
			drawBulk();
		};
		/** @param {Label | null} to */
		const go = async (to) => {
			if (picked.length > MARK_MAX) {
				out.textContent = t('At most {n} words at once.', { n: num(MARK_MAX) });
				return;
			}
			for (const b of bulk.querySelectorAll('button')) b.disabled = true;
			try {
				await label(picked, to);
				clear();
			} catch (err) {
				out.textContent = err instanceof Error ? err.message : String(err);
				for (const b of bulk.querySelectorAll('button')) b.disabled = false;
			}
		};
		const act = (/** @type {string} */ text, /** @type {() => void} */ on, cls = 'ws-bulk-act') => {
			const b = h('button', { type: 'button', class: cls }, text);
			b.addEventListener('click', on);
			return b;
		};
		bulk.replaceChildren(
			h('strong', null, t('{n} selected', { n: num(picked.length) })),
			h('span', { class: 'ws-bulk-acts' }, LABELS.map(([l, name]) => act(t(name), () => go(l))), act(t('No label'), () => go(null))),
			h(
				'span',
				{ class: 'ws-bulk-acts' },
				act(t('Copy'), () => navigator.clipboard?.writeText(picked.map((i) => items[i].term).join('\n')).then(() => (out.textContent = t('Copied')), () => {}), 'ws-bulk-link'),
				picked.length < items.length
					? act(t('Select all {n} shown', { n: num(items.length) }), () => {
							boxes.forEach((b) => (b.checked = true));
							drawBulk();
						}, 'ws-bulk-link')
					: '',
				act(t('Clear'), clear, 'ws-bulk-link'),
			),
			out,
		);
	};

	/**
	 * Shift and a press on a row: every row from the last one picked (or the
	 * one open) to this one is ticked, and nothing is opened.
	 * @param {number} i
	 */
	const pickTo = (i) => {
		const start = anchor >= 0 ? anchor : current >= 0 ? current : i;
		const [a, z] = start < i ? [start, i] : [i, start];
		for (let k = a; k <= z; k++) if (!boxes[k].disabled) boxes[k].checked = true;
		anchor = i;
		drawBulk();
	};

	/** @param {boolean} [again]  Adds the next page instead of starting over. */
	const load = async (again = false) => {
		const page = await workspaceSearches(f, again ? items.length : 0);
		if (!again) {
			items = [];
			rows = [];
			boxes = [];
			current = -1;
			anchor = -1;
		}
		const from = items.length;
		items.push(...page.words);
		const added = page.words.map((w, n) => {
			const i = from + n;
			const b = row(w, listed(w.label), (ev) => (ev.shiftKey && may.editor ? pickTo(i) : open(i)));
			rows.push(b);
			if (!may.editor) return h('li', null, b);
			// A word that was found has nothing to label.
			const box = /** @type {HTMLInputElement} */ (h('input', { type: 'checkbox', class: 'ws-pick', 'aria-label': t('Select {word}', { word: w.term }), disabled: w.found ? true : null }));
			boxes.push(box);
			box.addEventListener('click', (ev) => {
				// Shift takes every box between this one and the last one touched.
				if (ev.shiftKey && anchor >= 0 && anchor !== i) {
					const [a, z] = anchor < i ? [anchor, i] : [i, anchor];
					for (let k = a; k <= z; k++) if (!boxes[k].disabled) boxes[k].checked = box.checked;
				}
				anchor = i;
				drawBulk();
			});
			return h('li', null, box, b);
		});
		if (!again) ol.replaceChildren();
		ol.append(...added);
		if (!items.length) ol.replaceChildren(h('li', { class: 'ws-none' }, f.show === 'missed' ? (f.label === 'open' || f.label === 'none' ? t('Nothing left to sort here.') : t('Every search found something.')) : t('Nothing searched yet.')));
		more.hidden = !page.more;
		counts = page.counts;
		showCount();
		drawBulk();
		summary(counts);
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
					d.found ? '' : sorting(i, d),
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

	/**
	 * What a word never found is: headwords spelled nearly the same, its label
	 * and its note. Readers of the statistics see them; editors set them.
	 * @param {number} i
	 * @param {import('../data/api.js').SearchedDetail} d
	 */
	const sorting = (i, d) => {
		const out = h('p', { class: 'ws-result', role: 'status' });
		const near = d.near.length
			? h('p', { class: 'ws-near' }, t('Spelled nearly the same:'), ' ', d.near.flatMap((n, k) => [k ? ', ' : '', h('a', { href: definitionHref(n) }, n)]))
			: d.now
				? ''
				: h('p', { class: 'ws-near ws-quiet' }, t('No headword is spelled nearly the same.'));
		if (!may.editor) {
			return h('section', { class: 'ws-sort' }, near, d.label ? h('p', null, h('span', { class: `ws-label ws-label-${d.label}` }, labelName(d.label))) : '', d.note ? h('p', { class: 'ws-sort-note' }, d.note) : '');
		}
		const buttons = [...LABELS.map(([l, name, key]) => /** @type {const} */ ([l, t(name), key])), /** @type {const} */ ([null, t('No label'), '0'])].map(([l, name, key]) => {
			const b = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-state', 'aria-pressed': String(items[i].label === l), 'data-key': key, title: t('Key {key}', { key }) }, name));
			b.addEventListener('click', async () => {
				if (items[i].label === l) return;
				out.textContent = '';
				try {
					await label([i], l);
					// On to the next word: sorting a list is one key a word.
					if (l !== null && i + 1 < items.length) open(i + 1);
					else buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
				} catch (err) {
					out.textContent = err instanceof Error ? err.message : String(err);
				}
			});
			return b;
		});
		const note = /** @type {HTMLTextAreaElement} */ (h('textarea', { rows: 2, maxlength: 500, placeholder: t('A note for the editors, if one helps') }, d.note ?? ''));
		const keep = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-secondary', disabled: true }, t('Save note')));
		note.addEventListener('input', () => (keep.disabled = note.value.trim() === (items[i].note ?? '')));
		keep.addEventListener('click', async () => {
			keep.disabled = true;
			try {
				const saved = await markSearches([{ lang: d.lang, term: d.term }], { note: note.value.trim() || null });
				items[i] = { ...items[i], note: saved.note ?? null };
				out.textContent = t('Note saved.');
			} catch (err) {
				keep.disabled = false;
				out.textContent = err instanceof Error ? err.message : String(err);
			}
		});
		return h(
			'section',
			{ class: 'ws-sort' },
			near,
			h('div', { class: 'ws-sort-labels', role: 'group', 'aria-label': t('Label') }, buttons),
			d.marked_by && d.marked_at ? h('p', { class: 'ws-quiet' }, t('Last changed by {who}, {when}', { who: d.marked_by, when: shortDate(new Date(d.marked_at * 1000)) })) : '',
			h('div', { class: 'ws-sort-note-row' }, note, keep),
			out,
		);
	};

	/** The inspector: the list's figures, what is left to sort, and its download. @param {import('../data/api.js').SearchesPage['counts']} c */
	const summary = (c) => {
		const out = h('p', { class: 'ws-result', role: 'status' });
		const download = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-secondary' }, icon(ICONS.download, 15), t('Download as CSV')));
		const columns = /** @type {HTMLSelectElement} */ (h('select', { 'aria-label': t('Columns') }, h('option', { value: 'all' }, t('All columns')), h('option', { value: 'word' }, t('Word only'))));
		try {
			columns.value = localStorage.getItem(CSV_KEY) === 'word' ? 'word' : 'all';
		} catch {
			// storage blocked: every column, as by default
		}
		columns.addEventListener('change', () => {
			try {
				localStorage.setItem(CSV_KEY, columns.value);
			} catch {
				// storage blocked: the choice holds for this page only
			}
		});
		download.addEventListener('click', async () => {
			download.disabled = true;
			out.textContent = t('Preparing…');
			try {
				const res = await fetch(`/api/workspace/searches?${searchesQuery(f)}&format=csv&columns=${columns.value}`, { credentials: 'same-origin' });
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
		const sorted = (/** @type {string} */ name, /** @type {Filter['label']} */ view, /** @type {number} */ n) => [h('dt', null, h('a', { href: href({ show: 'missed', label: view }) }, name)), h('dd', null, num(n))];
		inspector.replaceChildren(
			h(
				'section',
				{ class: 'ws-box' },
				h('h2', null, f.days === 1 ? t('Today') : f.days ? t('Last {n} days', { n: f.days }) : t('All time')),
				h('dl', { class: 'ws-facts' }, pair(t('Words'), c.words), pair(t('Never found'), c.missed), pair(t('Found'), c.found), pair(t('Searches'), c.hits)),
			),
			h(
				'section',
				{ class: 'ws-box' },
				h('h2', null, t('Never found, by label')),
				h('dl', { class: 'ws-facts' }, sorted(t('To sort'), 'none', c.labels.none), sorted(t('To add'), 'add', c.labels.add), sorted(t('Misspelling'), 'misspelling', c.labels.misspelling), sorted(t('Not a word'), 'noise', c.labels.noise)),
				h('p', { class: 'ws-quiet' }, t('Within the period and the other filters. A word added to the dictionary since shows as such whatever its label.')),
			),
			h('section', { class: 'ws-box' }, h('h2', null, t('This list')), h('p', { class: 'ws-quiet' }, t('Every word that matches the filter, with its figures and its label, or the words alone.')), h('div', { class: 'ws-csv-row' }, columns, download), out),
			may.admin ? pruneBox(() => load()) : '',
			h('section', { class: 'ws-box' }, h('p', { class: 'ws-quiet' }, may.editor ? t('1 2 3 label · 0 no label · J K next, previous · Shift and a click selects a range') : t('J K next, previous')), h('p', { class: 'ws-quiet' }, t('Search counts keep the word, the day and whether it was found; nothing about who searched.'))),
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
	const yesNo = (/** @type {string} */ yes) => [{ value: '', label: t('Any') }, { value: '1', label: yes }];
	listPane.append(
		...listBar({
			title: t('Searches'),
			count: head,
			// Most important first: the ones that do not fit the column go under ⋯.
			groups: [
				{ title: t('Show'), current: f.show, fallback: 'missed', href: (v) => href({ show: /** @type {Filter['show']} */ (v) }), choices: choices(SHOWS) },
				// A label says what a word never found is; the other views have none to filter by.
				...(f.show === 'missed' ? [{ title: t('Label'), current: f.label, fallback: 'open', href: (/** @type {string} */ v) => href({ label: /** @type {Filter['label']} */ (v) }), choices: choices(LABEL_VIEWS) }] : []),
				{ title: t('Period'), current: String(f.days), fallback: '30', href: (v) => href({ days: /** @type {Filter['days']} */ (Number(v)) }), choices: choices(PERIODS) },
				{ title: t('Searches'), current: String(f.min), fallback: '1', href: (v) => href({ min: /** @type {Filter['min']} */ (Number(v)) }), choices: choices(MINS) },
				{ title: t('Sort'), current: f.order, fallback: 'hits', href: (v) => href({ order: /** @type {Filter['order']} */ (v) }), choices: choices(ORDERS) },
				{ title: t('Days searched'), current: String(f.spread), fallback: '1', href: (v) => href({ spread: /** @type {Filter['spread']} */ (Number(v)) }), choices: choices(SPREADS) },
				{ title: t('Shape'), current: f.shape, fallback: '', href: (v) => href({ shape: /** @type {Filter['shape']} */ (v) }), choices: choices(SHAPES) },
				...(f.days ? [{ title: t('First searched'), current: f.fresh ? '1' : '', fallback: '', href: (/** @type {string} */ v) => href({ fresh: v === '1' }), choices: yesNo(t('In this period')) }] : []),
				{ title: t('Note'), current: f.noted ? '1' : '', fallback: '', href: (v) => href({ noted: v === '1' }), choices: yesNo(t('With a note')) },
				{ title: t('Language'), current: f.lang, fallback: '', href: (v) => href({ lang: /** @type {Filter['lang']} */ (v) }), choices: choices(LANGS) },
			],
			search,
			reset: href({ show: 'missed', days: 30, lang: '', order: 'hits', label: 'open', min: 1, spread: 1, shape: '', fresh: false, noted: false }),
		}),
		bulk,
		ol,
		more,
	);
	await load();
	if (items.length && matchMedia('(min-width: 761px)').matches) open(0);

	/** @param {KeyboardEvent} ev */
	const keys = (ev) => {
		if (!root.isConnected) return document.removeEventListener('keydown', keys);
		const target = /** @type {HTMLElement} */ (ev.target);
		if (ev.metaKey || ev.ctrlKey || ev.altKey || target.closest('input:not([type=checkbox]), textarea, select, [contenteditable]')) return;
		const k = ev.key.toLowerCase();
		if (k === 'j') open(current + 1);
		else if (k === 'k') open(current - 1);
		else if (/^[0-3]$/.test(k)) /** @type {HTMLButtonElement | null} */ (work.querySelector(`.ws-sort [data-key="${k}"]`))?.click();
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
 * @param {boolean} listed  Whether its label belongs to the list as filtered.
 * @param {(ev: MouseEvent) => void} onOpen
 */
function row(w, listed, onOpen) {
	const last = shortDate(new Date(`${w.last}T00:00:00Z`), { utc: true });
	const b = /** @type {HTMLButtonElement} */ (
		h(
			'button',
			{ type: 'button', class: `ws-row${w.now || !listed ? ' ws-row-done' : ''}`, 'aria-current': 'false' },
			h('span', { class: 'ws-row-top' }, h('span', { class: 'ws-row-word', lang: w.lang }, w.term), h('span', { class: 'ws-row-count' }, num(w.hits))),
			h(
				'span',
				{ class: 'ws-row-sub ws-row-meta' },
				h('span', null, w.days > 1 ? t('{n} days · last {when}', { n: num(w.days), when: last }) : last, w.now ? h('span', { class: 'ws-flag ws-flag-now' }, ` · ${t('now in the dictionary')}`) : ''),
				h('span', { class: `ws-label${w.label ? ` ws-label-${w.label}` : ''}`, hidden: w.label ? null : true }, labelName(w.label)),
			),
		)
	);
	b.addEventListener('click', onOpen);
	return b;
}
