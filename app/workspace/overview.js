// @ts-check
/**
 * The workspace's home (?s=overview). A member sees where their suggestions
 * stand and how many meanings they rated; editors and admins see the site:
 * searches (counted per word and day, nobody's identity), the words searched
 * most, the words searched but missing, suggestions, members and the meanings
 * rated down most. Figures come from /api/workspace/overview.
 */
import { h } from '../core/dom.js';
import { definitionHref } from '../core/routes.js';
import { workspaceOverview } from '../data/api.js';
import { num, shortDate, t } from '../i18n/index.js';

/** @typedef {import('../data/api.js').Overview} Overview */

/**
 * @param {import('../core/member.js').Member} me
 * @param {{ dictionary?: { database?: string, built?: string | null } | null } | null} health
 */
export async function overviewPane(me, health) {
	const main = h('main', { class: 'ws-main ws-overview', 'aria-label': t('Overview') });
	/** @type {Overview} */
	let data;
	try {
		data = await workspaceOverview();
	} catch (err) {
		main.append(h('div', { class: 'ws-work' }, h('p', { class: 'ws-result', role: 'alert' }, err instanceof Error ? err.message : String(err))));
		return main;
	}
	const head = h('header', { class: 'ws-ov-head' }, h('h1', null, t('Overview')), h('span', null, me.name));
	main.append(h('div', { class: 'ws-work' }, head, data.searches ? site(data, health) : own(data)));
	return main;
}

/**
 * A member's own figures.
 * @param {Overview} data
 */
function own(data) {
	const s = data.own.suggestions;
	const total = Object.values(s).reduce((a, b) => a + b, 0);
	return h(
		'div',
		{ class: 'ws-ov' },
		h(
			'div',
			{ class: 'ws-tiles' },
			tile(t('Suggestions'), total, t('sent'), '/workspace?s=contributions'),
			tile(t('Waiting'), s.pending ?? 0, t('for review')),
			tile(t('Approved'), (s.approved ?? 0) + (s.exported ?? 0) + (s.merged ?? 0), (s.merged ?? 0) ? t('{n} in the dictionary', { n: s.merged }) : t('so far')),
			tile(t('Meanings rated'), data.own.ratings, t('up or down')),
		),
		total
			? null
			: h('p', { class: 'ws-quiet ws-ov-tip' }, t('On any entry, ✎ beside a meaning suggests a correction, and the thumbs rate it. Everything you send shows up here and under Contributions.')),
	);
}

/**
 * The site's figures, for editors and admins.
 * @param {Overview} data
 * @param {{ dictionary?: { database?: string, built?: string | null } | null } | null} health
 */
function site(data, health) {
	const searches = /** @type {NonNullable<Overview['searches']>} */ (data.searches);
	const days = data.days ?? 30;
	const missed = searches.daily.reduce((a, d) => a + d.missed, 0);
	const sug = data.suggestions ?? {};
	const roles = data.members?.roles ?? {};
	const members = Object.values(roles).reduce((a, b) => a + b, 0);
	const db = health?.dictionary;
	return h(
		'div',
		{ class: 'ws-ov' },
		h(
			'div',
			{ class: 'ws-tiles' },
			tile(t('Searches today'), searches.today),
			tile(t('Last {n} days', { n: 7 }), searches.week),
			tile(t('Last {n} days', { n: days }), searches.month, searches.month ? t('{pct} not found', { pct: percent(missed, searches.month) }) : ''),
			tile(t('Waiting'), sug.pending ?? 0, t('suggestions to review'), '/workspace?s=suggestions'),
			tile(t('Members'), members, data.members?.joinedWeek ? t('{n} joined this week', { n: data.members.joinedWeek }) : t('none joined this week')),
		),
		h('section', { class: 'ws-card ws-card-wide' }, h('h2', null, t('Searches, last {n} days', { n: days })), chart(searches.daily, days)),
		h('div', { class: 'ws-cards' }, words(t('Searched most'), searches.top, t('Nothing searched yet.')), words(t('Searched, not found'), searches.wanted, t('Every search found something.')), disliked(data.disliked ?? [])),
		h(
			'div',
			{ class: 'ws-cards' },
			pairs(t('Suggestions'), [
				[t('Waiting'), sug.pending ?? 0],
				[t('Approved, not yet exported'), sug.approved ?? 0],
				[t('Exported'), sug.exported ?? 0],
				[t('In the dictionary'), sug.merged ?? 0],
				[t('Declined'), sug.rejected ?? 0],
				[t('Needs a look'), sug.conflict ?? 0],
			]),
			pairs(t('Members'), [
				[t('Administrators'), roles.admin ?? 0],
				[t('Editors'), roles.editor ?? 0],
				[t('Members'), roles.member ?? 0],
			]),
			h(
				'section',
				{ class: 'ws-card' },
				h('h2', null, t('Dictionary')),
				h('dl', { class: 'ws-pairs' }, h('dt', null, t('Database')), h('dd', null, db?.database ?? t('unavailable')), h('dt', null, t('Build')), h('dd', null, db?.built ?? '—')),
				h('p', { class: 'ws-quiet' }, t('Search counts keep the word, the day and whether it was found; nothing about who searched.')),
			),
		),
	);
}

/**
 * @param {string} label
 * @param {number} value
 * @param {string} [sub]
 * @param {string} [href]
 */
function tile(label, value, sub = '', href) {
	const body = [h('span', { class: 'ws-tile-label' }, label), h('strong', { class: 'ws-tile-value' }, num(value)), h('span', { class: 'ws-tile-sub' }, sub)];
	return href ? h('a', { class: 'ws-tile', href }, body) : h('div', { class: 'ws-tile' }, body);
}

/**
 * Daily searches as stacked bars: found, then not found on top. Every day
 * of the window has a bar, zero or not; each says its numbers on hover and
 * to screen readers, and the table below holds them all.
 * @param {Array<{ day: string, hits: number, missed: number }>} daily
 * @param {number} days
 */
function chart(daily, days) {
	const byDay = new Map(daily.map((d) => [d.day, d]));
	const all = Array.from({ length: days }, (_, i) => {
		const day = new Date(Date.now() - (days - 1 - i) * 86400000).toISOString().slice(0, 10);
		return byDay.get(day) ?? { day, hits: 0, missed: 0 };
	});
	const max = Math.max(1, ...all.map((d) => d.hits));
	const top = niceMax(max);
	const label = (/** @type {string} */ day) => shortDate(new Date(`${day}T00:00:00Z`), { utc: true });
	const bars = all.map((d) => {
		const found = d.hits - d.missed;
		const text = t('{day}: {hits} searches, {missed} not found', { day: label(d.day), hits: d.hits, missed: d.missed });
		return h(
			'div',
			{ class: 'ws-bar', role: 'img', 'aria-label': text, title: text, tabindex: 0 },
			h('span', { class: 'ws-bar-miss', style: `height:${(d.missed / top) * 100}%` }),
			h('span', { class: 'ws-bar-found', style: `height:${(found / top) * 100}%` }),
		);
	});
	return h(
		'div',
		{ class: 'ws-chart' },
		h('div', { class: 'ws-legend' }, h('span', { class: 'ws-key ws-key-found' }, t('Found')), h('span', { class: 'ws-key ws-key-miss' }, t('Not found'))),
		h(
			'div',
			{ class: 'ws-plot' },
			h('div', { class: 'ws-axis', 'aria-hidden': 'true' }, h('span', null, num(top)), h('span', null, num(top / 2)), h('span', null, num(0))),
			h('div', { class: 'ws-bars' }, bars),
		),
		h('div', { class: 'ws-dates', 'aria-hidden': 'true' }, h('span', null, label(all[0].day)), h('span', null, t('today'))),
		h(
			'details',
			{ class: 'ws-table' },
			h('summary', null, t('Show as a table')),
			h(
				'table',
				null,
				h('thead', null, h('tr', null, h('th', null, t('Day')), h('th', null, t('Searches')), h('th', null, t('Not found')))),
				h(
					'tbody',
					null,
					all
						.filter((d) => d.hits)
						.reverse()
						.map((d) => h('tr', null, h('td', null, label(d.day)), h('td', null, num(d.hits)), h('td', null, num(d.missed)))),
				),
			),
		),
	);
}

/** @param {number} n  A round axis top at or above n. */
function niceMax(n) {
	if (n <= 4) return 4;
	const step = 10 ** Math.floor(Math.log10(n));
	for (const m of [1, 2, 2.5, 5, 10]) if (m * step >= n) return m * step;
	return 10 * step;
}

/**
 * @param {string} title
 * @param {Array<{ lang: string, term: string, hits: number }>} list
 * @param {string} empty
 */
function words(title, list, empty) {
	return h(
		'section',
		{ class: 'ws-card' },
		h('h2', null, title),
		list.length
			? h(
					'ol',
					{ class: 'ws-words' },
					list.map((w) => h('li', null, h('a', { href: definitionHref(w.term), lang: w.lang }, w.term), h('span', null, num(w.hits)))),
				)
			: h('p', { class: 'ws-quiet' }, empty),
	);
}

/** @param {NonNullable<Overview['disliked']>} list */
function disliked(list) {
	return h(
		'section',
		{ class: 'ws-card' },
		h('h2', null, t('Meanings rated down most')),
		list.length
			? h(
					'ol',
					{ class: 'ws-words ws-disliked' },
					list.map((s) =>
						h(
							'li',
							null,
							h('span', null, h('a', { href: definitionHref(s.word), lang: s.dict === 'emd' ? 'en' : 'my' }, s.word), h('span', { class: 'ws-sense', lang: s.dict === 'emd' ? 'my' : 'en' }, s.sense)),
							h('span', { title: t('{down} down, {up} up', { down: s.down, up: s.up }) }, `${num(s.down)} ↓ ${num(s.up)} ↑`),
						),
					),
				)
			: h('p', { class: 'ws-quiet' }, t('No meaning is rated down.')),
	);
}

/**
 * @param {string} title
 * @param {Array<[string, number]>} rows
 */
function pairs(title, rows) {
	return h('section', { class: 'ws-card' }, h('h2', null, title), h('dl', { class: 'ws-pairs' }, rows.flatMap(([k, v]) => [h('dt', null, k), h('dd', null, num(v))])));
}

/**
 * @param {number} part
 * @param {number} whole
 */
function percent(part, whole) {
	return `${num(Math.round((part / whole) * 100))}%`;
}
