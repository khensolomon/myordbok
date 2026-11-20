// @ts-check
/**
 * The three columns of a list section (Ratings, Questions, Votes), laid out
 * as Members and Searches are: the list on the left (list-bar.js head, rows,
 * Show more), the chosen row in the middle, its facts and actions on the
 * right. On a phone the list comes first and a row opens over it, with a
 * way back. The section says what a page of the list is, how a row reads and
 * what an item shows; this module does the rest.
 *
 * Also the entry a row is about, as the dictionary has it now (entryMeanings),
 * for the middle column: the meanings of the word, the one concerned marked.
 */
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { definitionHref } from '../core/routes.js';
import { lookup } from '../data/api.js';
import { num, posName, t } from '../i18n/index.js';
import { glossesOf } from '#shared/markup.js';
import { plainItem } from '#shared/quiz.js';
import { listBar } from './list-bar.js';

/**
 * How a row reads in the list.
 * @typedef {object} RowText
 * @property {string} word
 * @property {'en' | 'my'} [lang]
 * @property {string} [tag]  A short label at the right of the first line.
 * @property {string} [aside]  A figure at the right of the first line, instead of a tag.
 * @property {string} [sub]  The second line, cut to one line.
 * @property {'en' | 'my'} [subLang]
 * @property {string} [state]  The small third line.
 * @property {boolean} [off]  Done with, shown faded.
 */

/**
 * What an item shows in the middle and right columns.
 * @typedef {object} ItemView
 * @property {string} name  In the trail above the middle column.
 * @property {'en' | 'my'} [lang]
 * @property {Array<Node | string | null>} main
 * @property {Array<Node | string | null>} side
 */

/**
 * @template T
 * @typedef {object} Columns
 * @property {HTMLElement} root  The workspace grid: data-open marks a row open (phones).
 * @property {string} title
 * @property {string} choose  The middle column with nothing chosen.
 * @property {(filtered: boolean) => string} nothing  The list with no rows.
 * @property {(offset: number) => Promise<{ items: T[], more: boolean }>} fetch  A page of the list, as filtered.
 * @property {(page: { items: T[], more: boolean }) => Omit<Parameters<typeof listBar>[0], 'title' | 'count'>} bar  The filters, made once from the first page (its counts).
 * @property {(page: { items: T[], more: boolean }) => string} count  The head's count, from each first page.
 * @property {HTMLInputElement} search
 * @property {(item: T) => RowText} row
 * @property {(item: T, then: { update: (item: T) => void, reload: () => void }) => ItemView | Promise<ItemView>} show
 * @property {Array<Node | null>} [above]  Between the filters and the rows.
 * @property {Array<Node | null>} [foot]  Under the rows.
 * @property {(list: { reload: () => void }) => void} [ready]  Given the list's reload, for controls outside a row.
 */

/**
 * @template T
 * @param {Columns<T>} o
 * @returns {Promise<HTMLElement[]>}  The list, middle and right columns.
 */
export async function listColumns(o) {
	const listPane = h('section', { class: 'ws-list', 'aria-label': o.title });
	const work = h('main', { class: 'ws-main', 'aria-label': t('Work area') }, h('p', { class: 'ws-empty' }, o.choose));
	const inspector = h('aside', { class: 'ws-inspector', 'aria-label': t('Details') });
	const ol = h('ol', { class: 'ws-rows' });
	const head = h('span');
	const next = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-more', hidden: true }, t('Show more')));
	/** @type {T[]} */
	let items = [];
	/** @type {HTMLButtonElement[]} */
	let rows = [];
	let current = -1;
	let asked = 0; // a later load wins over an earlier one still on its way

	const say = (/** @type {unknown} */ err) => h('li', { class: 'ws-none' }, err instanceof Error ? err.message : String(err));

	/** @param {T} item @param {number} i */
	const button = (item, i) => {
		const r = o.row(item);
		const b = /** @type {HTMLButtonElement} */ (
			h(
				'button',
				{ type: 'button', class: `ws-row${r.off ? ' ws-row-done' : ''}`, 'aria-current': String(i === current) },
				h(
					'span',
					{ class: 'ws-row-top' },
					h('span', { class: 'ws-row-word', lang: r.lang ?? null }, r.word),
					r.aside ? h('span', { class: 'ws-row-count' }, r.aside) : r.tag ? h('span', { class: 'ws-role' }, r.tag) : null,
				),
				r.sub ? h('span', { class: 'ws-row-sub ws-row-line', lang: r.subLang ?? null }, r.sub) : null,
				r.state ? h('span', { class: 'ws-row-state' }, r.state) : null,
			)
		);
		b.addEventListener('click', () => open(i));
		return b;
	};

	/** @param {{ items: T[], more: boolean }} page @param {boolean} again */
	const fill = (page, again) => {
		if (!again) {
			items = [];
			rows = [];
			current = -1;
			ol.replaceChildren();
			head.textContent = o.count(page);
		}
		const from = items.length;
		items.push(...page.items);
		const added = page.items.map((item, n) => button(item, from + n));
		rows.push(...added);
		ol.append(...added.map((b) => h('li', null, b)));
		if (!items.length) ol.replaceChildren(h('li', { class: 'ws-none' }, o.nothing(o.search.value.trim() !== '')));
		next.hidden = !page.more;
	};

	/** @param {boolean} [again] */
	const load = async (again = false) => {
		const mine = ++asked;
		const page = await o.fetch(again ? items.length : 0);
		if (mine === asked) fill(page, again);
	};

	/** @param {number} i */
	const open = async (i) => {
		if (i < 0 || i >= items.length) return;
		current = i;
		rows.forEach((r, n) => r.setAttribute('aria-current', String(n === i)));
		root().toggleAttribute('data-open', true);
		const then = {
			update: (/** @type {T} */ item) => {
				items[i] = item;
				const b = button(item, i);
				rows[i].replaceWith(b);
				rows[i] = b;
				if (current === i) open(i);
			},
			reload: () => reload(i),
		};
		try {
			const view = await o.show(items[i], then);
			if (current !== i) return;
			const back = h('button', { type: 'button', class: 'ws-back', 'aria-label': t('Back to the list') }, icon(ICONS.back, 20));
			back.addEventListener('click', () => root().removeAttribute('data-open'));
			work.replaceChildren(
				h('header', { class: 'ws-crumbs' }, back, h('span', null, o.title), h('span', { 'aria-hidden': 'true' }, '›'), h('span', { class: 'ws-crumb-word', lang: view.lang ?? null }, view.name)),
				h('div', { class: 'ws-work ws-item' }, ...view.main),
			);
			inspector.replaceChildren(...view.side.filter((n) => n !== null));
		} catch (err) {
			work.replaceChildren(h('p', { class: 'ws-empty' }, err instanceof Error ? err.message : String(err)));
			inspector.replaceChildren();
		}
	};
	const clear = () => {
		work.replaceChildren(h('p', { class: 'ws-empty' }, o.choose));
		inspector.replaceChildren();
	};
	const root = () => o.root;
	/**
	 * The list again from its start, after a change that moves rows (a
	 * decision); the row at `at`, or the one now in its place, opens.
	 * @param {number} [at]
	 */
	const reload = (at = 0) => {
		load()
			.then(() => (matchMedia('(min-width: 761px)').matches && items.length ? open(Math.min(at, items.length - 1)) : clear()))
			.catch((err) => ol.replaceChildren(say(err)));
	};

	next.addEventListener('click', () => {
		next.disabled = true;
		load(true)
			.catch((err) => ol.append(say(err)))
			.finally(() => (next.disabled = false));
	});
	let timer = 0;
	o.search.addEventListener('input', () => {
		clearTimeout(timer);
		timer = window.setTimeout(() => {
			const url = new URL(location.href);
			if (o.search.value.trim()) url.searchParams.set('q', o.search.value.trim());
			else url.searchParams.delete('q');
			history.replaceState(history.state, '', url);
			load()
				.then(clear)
				.catch((err) => ol.replaceChildren(say(err)));
		}, 250);
	});
	// Arrow keys move through the list once a row has focus.
	ol.addEventListener('keydown', (ev) => {
		if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
		const i = rows.indexOf(/** @type {HTMLButtonElement} */ (document.activeElement));
		if (i < 0) return;
		ev.preventDefault();
		const to = Math.max(0, Math.min(rows.length - 1, i + (ev.key === 'ArrowDown' ? 1 : -1)));
		rows[to].focus();
		open(to);
	});

	const first = await o.fetch(0);
	listPane.append(...listBar({ title: o.title, count: head, ...o.bar(first) }), ...(o.above ?? []).filter((n) => n !== null), ol, next, ...(o.foot?.some((n) => n !== null) ? [h('div', { class: 'ws-list-foot' }, ...o.foot)] : []));
	fill(first, false);
	o.ready?.({ reload: () => reload() });
	if (items.length && matchMedia('(min-width: 761px)').matches) await open(0);
	return [listPane, work, inspector];
}

/**
 * The meanings of a word as the dictionary has them now, `id` marked; for
 * the middle column. Only the part of speech of the marked meaning when
 * there is one, so a long entry stays short.
 * @param {string} word
 * @param {{ id?: number | null, type?: string | null }} [mark]
 */
export function entryMeanings(word, mark = {}) {
	const box = h('section', { class: 'ws-meanings' }, h('h2', null, t('In the dictionary now')), h('p', { class: 'ws-quiet' }, t('Loading…')));
	lookup(word)
		.then((r) => {
			const all = /** @type {Array<{ id?: number, type: string, sense: string }>} */ (r.entries);
			const type = mark.type ?? all.find((s) => s.id === mark.id)?.type ?? null;
			const senses = type ? all.filter((s) => s.type === type) : all;
			const lang = r.language === 'en' ? 'my' : 'en';
			box.replaceChildren(
				h('h2', null, t('In the dictionary now'), ' ', h('a', { href: definitionHref(word), class: 'ws-meanings-open' }, t('Open the entry'))),
				senses.length
					? h(
							'ol',
							null,
							senses.map((s) =>
								h(
									'li',
									{ class: s.id !== undefined && s.id === mark.id ? 'is-marked' : null },
									type ? null : h('em', null, `${posName(s.type)} `),
									h('span', { lang }, plainSense(s.sense) || '—'),
								),
							),
						)
					: h('p', { class: 'ws-quiet' }, t('The word has no entry now.')),
				mark.id && !senses.some((s) => s.id === mark.id) ? h('p', { class: 'ws-quiet' }, t('The meaning concerned is no longer in the entry.')) : '',
			);
		})
		.catch((err) => box.replaceChildren(h('h2', null, t('In the dictionary now')), h('p', { class: 'ws-quiet' }, err instanceof Error ? err.message : String(err))));
	return box;
}

/**
 * A sense's glosses as plain text, its markup, notes and English explanation
 * left out.
 * @param {string | null | undefined} sense
 */
export function plainSense(sense) {
	return glossesOf(sense)
		.map((g) => plainItem(g))
		.filter(Boolean)
		.join(' · ');
}

/**
 * A figure in the right column.
 * @param {string} label
 * @param {number | string} value
 */
export function fact(label, value) {
	return [h('dt', null, label), h('dd', null, typeof value === 'number' ? num(value) : value)];
}
