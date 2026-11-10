// @ts-check
/**
 * The workspace's home (?s=overview), different by level:
 *
 *   everyone   their own suggestions and ratings; the dictionary as built
 *              (headwords, meanings, review progress, parts of speech, labels,
 *              change since the build before); searches of the last days; the
 *              community's totals. A member's view of the project.
 *   editors    the review queue, members by role, meanings rated down most
 *   admins     unread messages
 *
 * Figures come from /api/workspace/overview; the dictionary's are worked out
 * once per build (scripts/stats.js) and read as one row.
 */
import { h } from '../core/dom.js';
import { definitionHref } from '../core/routes.js';
import { workspaceOverview } from '../data/api.js';
import { num, posName, shortDate, t } from '../i18n/index.js';

/** @typedef {import('../data/api.js').Overview} Overview */
/** @typedef {import('../data/api.js').DictStats} DictStats */

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
	const editor = data.role === 'editor' || data.role === 'admin';
	const head = h('header', { class: 'ws-ov-head' }, h('h1', null, t('Overview')), h('span', null, me.name));
	main.append(
		h(
			'div',
			{ class: 'ws-work' },
			head,
			h(
				'div',
				{ class: 'ws-ov' },
				yours(data, editor),
				dictionary(data, health, me.role === 'admin'),
				searches(data),
				community(data),
				editor ? review(data) : '',
			),
		),
	);
	return main;
}

/**
 * @param {string} title
 * @param {...(Node | string)} body
 */
const block = (title, ...body) => h('section', { class: 'ws-block' }, h('h2', { class: 'ws-block-title' }, title), ...body);

/**
 * The member's own figures, and for editors and admins what waits for them.
 * @param {Overview} data
 * @param {boolean} editor
 */
function yours(data, editor) {
	const s = data.own.suggestions;
	const total = Object.values(s).reduce((a, b) => a + b, 0);
	return block(
		t('Yours'),
		h(
			'div',
			{ class: 'ws-tiles' },
			editor ? tile(t('Waiting'), data.suggestions?.pending ?? 0, t('suggestions to review'), '/workspace?s=suggestions') : '',
			data.unread === undefined ? '' : tile(t('Inbox'), data.unread, t('new messages'), '/workspace?s=inbox'),
			tile(t('Suggestions'), total, (s.pending ?? 0) ? t('{n} waiting', { n: s.pending ?? 0 }) : t('sent'), '/workspace?s=contributions'),
			tile(t('Approved'), (s.approved ?? 0) + (s.exported ?? 0) + (s.merged ?? 0), (s.merged ?? 0) ? t('{n} in the dictionary', { n: s.merged }) : t('so far')),
			tile(t('Meanings rated'), data.own.rated.senses, data.own.rated.entries ? t('and {n} whole entries', { n: data.own.rated.entries }) : t('up or down'), '/workspace?s=ratings'),
		),
		total || data.own.ratings ? '' : h('p', { class: 'ws-quiet ws-ov-tip' }, t('On any entry, ✎ beside a meaning suggests a correction, and the thumbs rate it. Everything you send shows up here and under Contributions.')),
	);
}

/**
 * The dictionary as built.
 * @param {Overview} data
 * @param {{ dictionary?: { database?: string, built?: string | null } | null } | null} health
 * @param {boolean} admin
 */
function dictionary(data, health, admin) {
	const d = data.dictionary;
	const s = d.stats;
	if (!s) {
		return block(
			t('Dictionary'),
			h('p', { class: 'ws-quiet' }, t('Build {build}.', { build: d.build ?? health?.dictionary?.built ?? '—' }), ' ', admin ? t('Its statistics appear once they are kept: make data-stats FILE=… APPLY=1 (make data-publish does it for each new build).') : ''),
		);
	}
	const p = d.previous;
	/** @param {number} now @param {number | undefined} before */
	const change = (now, before) => (before === undefined || now === before ? '' : `${now > before ? '+' : '−'}${num(Math.abs(now - before))} ${t('since the build before')}`);
	return block(
		t('Dictionary'),
		h(
			'div',
			{ class: 'ws-tiles' },
			tile(t('English headwords'), s.en.headwords, change(s.en.headwords, p?.en.headwords)),
			tile(t('English meanings'), s.en.senses, change(s.en.senses, p?.en.senses) || t('{n} with an example', { n: s.en.examples })),
			tile(t('Myanmar headwords'), s.my.headwords, change(s.my.headwords, p?.my.headwords)),
			tile(t('Myanmar meanings'), s.my.senses, change(s.my.senses, p?.my.senses) || t('{n} with an example', { n: s.my.examples })),
		),
		h(
			'div',
			{ class: 'ws-cards' },
			h('section', { class: 'ws-card' }, h('h2', null, t('Review')), progress(t('English → Myanmar'), s.en), progress(t('Myanmar → English'), s.my), legend()),
			h('section', { class: 'ws-card' }, h('h2', null, t('Parts of speech')), h('h3', { class: 'ws-card-sub ws-card-sub-first' }, t('English → Myanmar')), bars(s.en.pos, 'en'), h('h3', { class: 'ws-card-sub' }, t('Myanmar → English')), bars(s.my.pos, 'my')),
			h(
				'section',
				{ class: 'ws-card' },
				h('h2', null, t('Also in the dictionary')),
				h(
					'dl',
					{ class: 'ws-pairs' },
					...pair(t('Word forms (went, mice …)'), s.en.forms),
					...pair(t('Spelling variants'), s.en.variants),
					...pair(t('Synonym sets'), s.en.synsets),
					...pair(t('Links between meanings'), s.en.links),
					...pair(t('Related-word pairs'), s.en.related),
					...pair(t('Myanmar pronunciations'), s.my.pronunciations),
					...pair(t('Myanmar thesaurus links'), s.my.thesaurus),
				),
				h('p', { class: 'ws-quiet' }, t('Build {build}', { build: s.build }), s.source ? ` · ${s.source}` : '', p ? ` · ${t('compared with {build}', { build: p.build })}` : ''),
			),
		),
		Object.keys(s.en.labels).length ? h('section', { class: 'ws-card ws-card-wide' }, h('h2', null, t('Labels and glossaries')), labels(s.en.labels)) : '',
	);
}

/**
 * Reviewed, awaiting a native speaker, draft: one bar of the language's meanings.
 * @param {string} title
 * @param {{ senses: number, awaiting: number, drafts: number }} side
 */
function progress(title, side) {
	const reviewed = side.senses - side.awaiting - side.drafts;
	const part = (/** @type {number} */ n) => (side.senses ? (n / side.senses) * 100 : 0);
	const text = t('{reviewed} reviewed, {awaiting} awaiting a native speaker, {drafts} drafts', { reviewed, awaiting: side.awaiting, drafts: side.drafts });
	return h(
		'div',
		{ class: 'ws-progress' },
		h('div', { class: 'ws-progress-head' }, h('span', null, title), h('strong', null, `${num(Math.round(part(reviewed)))}%`)),
		h(
			'div',
			{ class: 'ws-stack', role: 'img', 'aria-label': text, title: text },
			h('span', { class: 'ws-stack-done', style: `width:${part(reviewed)}%` }),
			h('span', { class: 'ws-stack-wait', style: `width:${part(side.awaiting)}%` }),
			h('span', { class: 'ws-stack-draft', style: `width:${part(side.drafts)}%` }),
		),
		h('p', { class: 'ws-stack-note' }, text),
	);
}

function legend() {
	return h('div', { class: 'ws-legend' }, h('span', { class: 'ws-key ws-key-found' }, t('Reviewed')), h('span', { class: 'ws-key ws-key-miss' }, t('Awaiting review')), h('span', { class: 'ws-key ws-key-draft' }, t('Draft')));
}

/**
 * Meanings by part of speech, the largest first (eight, then the rest together).
 * @param {Record<string, number>} counts
 * @param {'en' | 'my'} lang
 */
function bars(counts, lang) {
	const list = Object.entries(counts).sort((a, b) => b[1] - a[1]);
	const shown = list.slice(0, 6);
	const rest = list.slice(6).reduce((a, [, n]) => a + n, 0);
	if (rest) shown.push([t('others'), rest]);
	const max = Math.max(1, ...shown.map(([, n]) => n));
	return h(
		'ul',
		{ class: 'ws-hbars', 'aria-label': lang === 'en' ? t('English → Myanmar') : t('Myanmar → English') },
		shown.map(([name, n]) =>
			h('li', { title: `${num(n)}` }, h('span', { class: 'ws-hbar-name' }, name === t('others') ? name : posName(name)), h('span', { class: 'ws-hbar' }, h('span', { style: `width:${(n / max) * 100}%` })), h('span', { class: 'ws-hbar-n' }, num(n))),
		),
	);
}

/**
 * Sense labels (idiom, slang, the school glossaries …), as the dataset names them.
 * @param {Record<string, number>} counts
 */
function labels(counts) {
	return h(
		'ul',
		{ class: 'ws-chips', lang: 'en' },
		Object.entries(counts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 24)
			.map(([name, n]) => h('li', null, h('span', null, name), h('strong', null, num(n)))),
	);
}

/** @param {string} label @param {number} value */
const pair = (label, value) => [h('dt', null, label), h('dd', null, num(value))];

/**
 * Searches of the last days.
 * @param {Overview} data
 */
function searches(data) {
	const searches = data.searches;
	const days = data.days ?? 30;
	const missed = searches.daily.reduce((a, d) => a + d.missed, 0);
	return block(
		t('Searches'),
		h(
			'div',
			{ class: 'ws-tiles' },
			tile(t('Searches today'), searches.today),
			tile(t('Last {n} days', { n: 7 }), searches.week),
			tile(t('Last {n} days', { n: days }), searches.month, searches.month ? t('{pct} not found', { pct: percent(missed, searches.month) }) : ''),
		),
		h('section', { class: 'ws-card ws-card-wide' }, h('h2', null, t('Searches, last {n} days', { n: days })), chart(searches.daily, days)),
		h('div', { class: 'ws-cards' }, words(t('Searched most'), searches.top, t('Nothing searched yet.')), words(t('Searched, not found'), searches.wanted, t('Every search found something.'))),
		h('p', { class: 'ws-quiet' }, t('Search counts keep the word, the day and whether it was found; nothing about who searched.')),
	);
}

/**
 * The community's totals.
 * @param {Overview} data
 */
function community(data) {
	const c = data.community;
	return block(
		t('Community'),
		h(
			'div',
			{ class: 'ws-tiles' },
			tile(t('Members'), c.members, data.members?.joinedWeek ? t('{n} joined this week', { n: data.members.joinedWeek }) : ''),
			tile(t('Suggestions accepted'), c.accepted, c.merged ? t('{n} in the dictionary', { n: c.merged }) : ''),
			tile(t('Ratings'), c.ratings, t('of entries and meanings')),
		),
	);
}

/**
 * The review queue and the members, for editors and admins.
 * @param {Overview} data
 */
function review(data) {
	const sug = data.suggestions ?? {};
	const roles = data.members?.roles ?? {};
	return block(
		t('For editors'),
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
			disliked(data.disliked ?? []),
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
