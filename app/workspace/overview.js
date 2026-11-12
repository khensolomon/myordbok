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
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { definitionHref } from '../core/routes.js';
import { workspaceOverview } from '../data/api.js';
import { atLeast } from '#shared/roles.js';
import { STALE_DAYS } from '#shared/backup.js';
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
	const editor = atLeast(data.role, 'editor');
	const build = data.dictionary.stats?.build ?? data.dictionary.build ?? health?.dictionary?.built ?? null;
	const head = h(
		'header',
		{ class: 'ws-hero' },
		h('div', null, h('p', { class: 'ws-hero-kicker' }, t('Overview')), h('h1', { class: 'ws-hero-title' }, t('Hello, {name}', { name: me.name })), h('p', { class: 'ws-hero-sub' }, roleName(data.role), build ? ` · ${t('Build {build}', { build })}` : '')),
		h('p', { class: 'ws-hero-date' }, shortDate(new Date(), { year: true })),
	);
	main.append(h('div', { class: 'ws-work' }, head, h('div', { class: 'ws-ov' }, yours(data, editor), searches(data, Boolean(data.insights)), dictionary(data, health, atLeast(me.role, 'admin')), community(data), data.insights ? offline(data.usage ?? []) : '', editor ? review(data) : '', data.backup !== undefined ? backups(data.backup) : '')));
	return main;
}

/**
 * @param {string} title
 * @param {...(Node | string)} body
 */
const block = (title, ...body) => h('section', { class: 'ws-block' }, h('h2', { class: 'ws-block-title' }, title), ...body);

/**
 * A card's heading, with a link to the section holding the whole list when
 * the role may open it (the Worker enforces it either way; this only spares
 * a link that would end in "not allowed").
 * @param {string} title
 * @param {string | null} [more]  The section's address, or null.
 */
const cardHead = (title, more) => h('div', { class: 'ws-card-head' }, h('h2', null, title), more ? h('a', { class: 'ws-card-more', href: more }, t('See all'), h('span', { 'aria-hidden': 'true' }, ' →')) : '');

/** @param {string} role */
const roleName = (role) => (role === 'owner' ? t('Owner') : role === 'admin' ? t('Administrator') : role === 'editor' ? t('Editor') : t('Member'));

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
			editor ? tile(t('Waiting'), data.suggestions?.pending ?? 0, t('suggestions to review'), '/workspace?s=suggestions', ICONS.document) : '',
			data.unread === undefined ? '' : tile(t('Inbox'), data.unread, t('new messages'), '/workspace?s=inbox', ICONS.inbox),
			tile(t('Suggestions'), total, (s.pending ?? 0) ? t('{n} waiting', { n: s.pending ?? 0 }) : t('sent'), '/workspace?s=contributions', ICONS.suggest),
			tile(t('Approved'), (s.approved ?? 0) + (s.exported ?? 0) + (s.merged ?? 0), (s.merged ?? 0) ? t('{n} in the dictionary', { n: s.merged }) : t('so far'), undefined, ICONS.check),
			tile(t('Meanings rated'), data.own.rated.senses, data.own.rated.entries ? t('and {n} whole entries', { n: data.own.rated.entries }) : t('up or down'), '/workspace?s=ratings', ICONS.thumbUp),
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
			{ class: 'ws-tiles ws-tiles-big' },
			tile(t('English headwords'), s.en.headwords, change(s.en.headwords, p?.en.headwords)),
			tile(t('English meanings'), s.en.senses, change(s.en.senses, p?.en.senses) || t('{n} with an example', { n: s.en.examples })),
			tile(t('Myanmar headwords'), s.my.headwords, change(s.my.headwords, p?.my.headwords)),
			tile(t('Myanmar meanings'), s.my.senses, change(s.my.senses, p?.my.senses) || t('{n} with an example', { n: s.my.examples })),
		),
		h(
			'div',
			{ class: 'ws-grid' },
			h('section', { class: 'ws-card ws-third' }, h('h2', null, t('Review')), progress(t('English → Myanmar'), s.en), progress(t('Myanmar → English'), s.my), legend()),
			h('section', { class: 'ws-card ws-third' }, h('h2', null, t('Parts of speech')), h('h3', { class: 'ws-card-sub ws-card-sub-first' }, t('English → Myanmar')), bars(s.en.pos, 'en'), h('h3', { class: 'ws-card-sub' }, t('Myanmar → English')), bars(s.my.pos, 'my')),
			h(
				'section',
				{ class: 'ws-card ws-third ws-third-last' },
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
			Object.keys(s.en.labels).length ? h('section', { class: 'ws-card ws-full' }, h('h2', null, t('Labels and glossaries')), labels(s.en.labels)) : '',
		),
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
 * Searches of the last days: the figures over the daily chart, beside it the
 * words searched most and those the dictionary did not have.
 * @param {Overview} data
 * @param {boolean} editor  Links to the Searches section: editors and members shown the statistics.
 */
function searches(data, editor) {
	const searches = data.searches;
	const days = data.days ?? 30;
	const all = everyDay(searches.daily, days);
	const missed = all.reduce((a, d) => a + d.missed, 0);
	const sum = (/** @type {typeof all} */ list) => list.reduce((a, d) => a + d.hits, 0);
	const last = sum(all.slice(-7));
	const before = sum(all.slice(-14, -7));
	return block(
		t('Searches'),
		h(
			'div',
			{ class: 'ws-grid' },
			h(
				'section',
				{ class: 'ws-card ws-wide-col ws-chart-card' },
				h(
					'div',
					{ class: 'ws-figures' },
					figure(t('Today'), searches.today),
					figure(t('Last {n} days', { n: 7 }), searches.week, before ? trend(last, before) : ''),
					figure(t('Last {n} days', { n: days }), searches.month, searches.month ? t('{pct} not found', { pct: percent(missed, searches.month) }) : ''),
				),
				chart(all),
			),
			h(
				'div',
				{ class: 'ws-side-col' },
				words(t('Searched most'), searches.top, t('Nothing searched yet.'), editor ? '/workspace?s=searches&show=found' : null),
				words(t('Searched, not found'), searches.wanted, t('Every search found something.'), editor ? '/workspace?s=searches&show=missed' : null),
			),
		),
		h(
			'p',
			{ class: 'ws-quiet ws-foot' },
			t('Search counts keep the word, the day and whether it was found; nothing about who searched.'),
		),
	);
}

/**
 * Every day of the window, zero or not, oldest first.
 * @param {Array<{ day: string, hits: number, missed: number }>} daily
 * @param {number} days
 */
export function everyDay(daily, days) {
	const byDay = new Map(daily.map((d) => [d.day, d]));
	return Array.from({ length: days }, (_, i) => {
		const day = new Date(Date.now() - (days - 1 - i) * 86400000).toISOString().slice(0, 10);
		return byDay.get(day) ?? { day, hits: 0, missed: 0 };
	});
}

/**
 * A headline figure over the chart.
 * @param {string} label
 * @param {number} value
 * @param {Node | string} [note]
 */
export function figure(label, value, note = '') {
	return h('div', { class: 'ws-figure' }, h('span', { class: 'ws-figure-label' }, label), h('strong', { class: 'ws-figure-value' }, num(value)), h('span', { class: 'ws-figure-note' }, note));
}

/**
 * The last seven days against the seven before: "↑ 12% on the week before".
 * @param {number} now
 * @param {number} before
 */
function trend(now, before) {
	const pct = Math.round(((now - before) / before) * 100);
	if (!pct) return t('as many as the week before');
	return h('span', { class: `ws-trend ${pct > 0 ? 'ws-trend-up' : 'ws-trend-down'}` }, h('span', { 'aria-hidden': 'true' }, pct > 0 ? '↑ ' : '↓ '), pct > 0 ? t('{pct} more than the week before', { pct: `${num(pct)}%` }) : t('{pct} fewer than the week before', { pct: `${num(-pct)}%` }));
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
			tile(t('Members'), c.members, data.members?.joinedWeek ? t('{n} joined this week', { n: data.members.joinedWeek }) : '', atLeast(data.role, 'admin') ? '/workspace?s=members' : undefined),
			tile(t('Suggestions accepted'), c.accepted, c.merged ? t('{n} in the dictionary', { n: c.merged }) : ''),
			tile(t('Ratings'), c.ratings, t('of entries and meanings'), data.insights ? '/workspace?s=ratings&view=site' : undefined),
		),
	);
}

/**
 * Offline use, for editors and admins (usage_counts): devices keeping the
 * definitions, words answered from them, and downloads, over the last seven
 * days. The word lists download by themselves on a first visit, so theirs
 * stand for new devices rather than a choice to go offline.
 * @param {Array<{ day: string, name: string, n: number }>} usage  Two weeks, from the server.
 */
function offline(usage) {
	const weekStart = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
	const today = new Date().toISOString().slice(0, 10);
	/** @param {(name: string) => boolean} which @param {(day: string) => boolean} when */
	const sum = (which, when) => usage.reduce((a, u) => (which(u.name) && when(u.day) ? a + u.n : a), 0);
	const week = (/** @type {string} */ day) => day >= weekStart;
	const before = (/** @type {string} */ day) => day < weekStart;
	const is = (/** @type {string} */ name) => (/** @type {string} */ n) => n === name;
	const definitions = (/** @type {string} */ end) => (/** @type {string} */ n) => n.startsWith('download.') && !n.startsWith('download.words-') && n.endsWith(end);
	const wordLists = (/** @type {string} */ n) => n.startsWith('download.words-') && n.endsWith('.new');

	const devicesToday = sum(is('offline.devices'), (d) => d === today);
	const devicesDaily = Math.round(sum(is('offline.devices'), week) / 7);
	const lookups = sum(is('offline.lookups'), week);
	const lookupsBefore = sum(is('offline.lookups'), before);
	const updates = sum(definitions('.update'), week);
	return block(
		t('Offline'),
		h(
			'div',
			{ class: 'ws-tiles' },
			tile(t('Devices keeping definitions'), devicesDaily, t('a day on average; {n} today', { n: num(devicesToday) })),
			tile(t('Words answered offline'), lookups, lookupsBefore ? trend(lookups, lookupsBefore) : t('in the last {n} days', { n: 7 })),
			tile(t('Definitions downloaded'), sum(definitions('.new'), week), updates ? t('{n} updated to a new build', { n: num(updates) }) : t('in the last {n} days', { n: 7 })),
			tile(t('Word lists downloaded'), sum(wordLists, week), t('new devices, in the last {n} days', { n: 7 })),
		),
		h('p', { class: 'ws-quiet ws-foot' }, t('A device keeping definitions checks in once a day with how many words it answered offline: no words and nothing that identifies it.')),
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
			{ class: 'ws-grid ws-grid-thirds' },
			pairs(t('Suggestions'), '/workspace?s=suggestions', [
				[t('Waiting'), sug.pending ?? 0],
				[t('Approved, not yet exported'), sug.approved ?? 0],
				[t('Exported'), sug.exported ?? 0],
				[t('In the dictionary'), sug.merged ?? 0],
				[t('Declined'), sug.rejected ?? 0],
				[t('Needs a look'), sug.conflict ?? 0],
			]),
			pairs(t('Members'), atLeast(data.role, 'admin') ? '/workspace?s=members' : null, [
				[t('Administrators'), roles.admin ?? 0],
				[t('Editors'), roles.editor ?? 0],
				[t('Members'), roles.member ?? 0],
			]),
			disliked(data.disliked ?? []),
		),
	);
}

/**
 * The newest backup of the app database, for admins: when it was made, and
 * a warning once the weekly one is late.
 * @param {NonNullable<Overview['backup']> | null} b
 */
function backups(b) {
	if (b && 'error' in b) return block(t('Backups'), h('p', { class: 'ws-alert', role: 'alert' }, b.error));
	if (!b) return block(t('Backups'), h('p', { class: 'ws-quiet' }, t('No backup of the app database yet. The weekly one runs on Sunday night; one now: make backup-now APPLY=1')));
	const days = Math.floor((Date.now() - Date.parse(b.at)) / 86400000);
	const when = days < 1 ? t('today') : days === 1 ? t('yesterday') : t('{n} days ago', { n: num(days) });
	return block(
		t('Backups'),
		days > STALE_DAYS ? h('p', { class: 'ws-alert', role: 'alert' }, t('The weekly backup is late: the newest is {n} days old. Its runs are in Cloudflare under Workers → Workflows → myordbok-backup.', { n: num(days) })) : '',
		h('p', { class: 'ws-quiet' }, t('The app database was last backed up {when}, {date}. Backups kept: {n}.', { when, date: shortDate(new Date(b.at), { year: true }), n: num(b.kept) })),
	);
}

/**
 * @param {string} label
 * @param {number} value
 * @param {string | Node} [sub]
 * @param {string} [href]
 * @param {string} [glyph]  An icon from ICONS beside the label.
 */
function tile(label, value, sub = '', href, glyph) {
	const body = [h('span', { class: 'ws-tile-label' }, glyph ? h('span', { class: 'ws-tile-icon', 'aria-hidden': 'true' }, icon(glyph, 15)) : '', label), h('strong', { class: 'ws-tile-value' }, num(value)), h('span', { class: 'ws-tile-sub' }, sub)];
	return href ? h('a', { class: 'ws-tile', href }, body) : h('div', { class: 'ws-tile' }, body);
}

/**
 * Daily searches as stacked bars: found, then not found on top. Every day
 * of the window has a bar, zero or not; each says its numbers on hover and
 * to screen readers, and the table below holds them all.
 * @param {Array<{ day: string, hits: number, missed: number }>} all  Every day, oldest first.
 */
export function chart(all) {
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
 * @param {string | null} [more]  The section with the whole list, for editors.
 */
function words(title, list, empty, more) {
	return h(
		'section',
		{ class: 'ws-card' },
		cardHead(title, more),
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
		cardHead(t('Meanings rated down most'), '/workspace?s=ratings&view=site'),
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
 * @param {string | null} more  The section with the whole list, when the role may open it.
 * @param {Array<[string, number]>} rows
 */
function pairs(title, more, rows) {
	return h('section', { class: 'ws-card' }, cardHead(title, more), h('dl', { class: 'ws-pairs' }, rows.flatMap(([k, v]) => [h('dt', null, k), h('dd', null, num(v))])));
}

/**
 * @param {number} part
 * @param {number} whole
 */
function percent(part, whole) {
	return `${num(Math.round((part / whole) * 100))}%`;
}
