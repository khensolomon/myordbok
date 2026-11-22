// @ts-check
/**
 * /liked: the entries and meanings the member rated, from their own
 * ratings (GET /api/workspace/ratings?scope=mine): no list of its own to
 * keep. "Liked" holds those rated helpful, "Not helpful" the others,
 * newest first. A meaning changed since it was rated is marked Updated:
 * worth reading again, and rating it again counts (the old rating no
 * longer does).
 *
 *   ?value=down   the Not helpful list
 */
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { member, providerLinks } from '../core/member.js';
import { definitionHref } from '../core/routes.js';
import { workspaceRatings } from '../data/api.js';
import { posName, t } from '../i18n/index.js';
import { plainSense } from '../workspace/columns.js';

/** @typedef {import('../data/api.js').RatedSense} RatedSense */
/** @typedef {import('../data/api.js').RatedEntry} RatedEntry */

const MYANMAR = /[က-႟]/;

export function title() {
	return t('Liked');
}

/** @param {import('../core/routes.js').ViewContext} ctx */
export async function view(ctx) {
	const value = ctx.query.get('value') === 'down' ? 'down' : 'up';
	const page = h('section', { class: 'page liked' }, h('h1', { class: 'large-title' }, t('Liked')));
	const me = await member().catch(() => null);
	if (!me) {
		page.append(h('p', { class: 'liked-lead' }, t('Words and meanings you rate helpful are kept here. Sign in to rate them.')), providerLinks('ws-provider', '/liked'));
		return page;
	}
	page.append(
		h(
			'div',
			{ class: 'segmented', role: 'group', 'aria-label': t('Which ratings') },
			h('a', { href: '/liked', 'aria-current': value === 'up' ? 'page' : null }, t('Liked')),
			h('a', { href: '/liked?value=down', 'aria-current': value === 'down' ? 'page' : null }, t('Not helpful')),
		),
	);
	/** @type {import('../data/api.js').RatingsFilter} */
	const f = { scope: 'mine', kind: 'entries', value, order: 'new', q: '' };
	const [entries, senses] = await Promise.all([workspaceRatings(f), workspaceRatings({ ...f, kind: 'senses' })]);
	const items = [.../** @type {RatedEntry[]} */ (entries.items), .../** @type {RatedSense[]} */ (senses.items)].sort((a, b) => b.at - a.at);
	if (!items.length) {
		page.append(
			h(
				'p',
				{ class: 'liked-empty' },
				value === 'up'
					? t('Nothing yet. The thumb on an entry, or beside a meaning, keeps it here.')
					: t('Nothing rated not helpful. Those ratings tell editors which meanings to look at.'),
			),
		);
		return page;
	}
	page.append(h('ul', { class: 'liked-list' }, items.map(row)));
	if (entries.more || senses.more) page.append(h('p', { class: 'liked-more' }, h('a', { href: `/workspace?s=ratings${value === 'down' ? '&value=down' : '&value=up'}` }, t('All your ratings, in the workspace'))));
	return page;
}

/**
 * A rated entry (the word) or a rated meaning (the word, the meaning).
 * @param {RatedEntry | RatedSense} item
 */
function row(item) {
	if ('lang' in item) {
		return h('li', null, h('a', { href: definitionHref(item.word) }, h('span', { class: 'liked-word', lang: item.lang }, item.word), h('span', { class: 'liked-what' }, t('Whole entry')), icon(ICONS.chevron, 14)));
	}
	const word = item.word ?? '';
	const meaning = item.sense ? plainSense(item.sense) : '';
	return h(
		'li',
		null,
		h(
			'a',
			{ href: word ? definitionHref(word) : '#', 'aria-disabled': word ? null : 'true' },
			h('span', { class: 'liked-word', lang: MYANMAR.test(word) ? 'my' : 'en' }, word || t('(removed)')),
			item.state === 'changed' ? h('span', { class: 'liked-updated' }, t('Updated')) : null,
			h('span', { class: 'liked-what', lang: MYANMAR.test(meaning) ? 'my' : null }, item.state === 'gone' ? t('No longer in the dictionary') : [item.type ? `${posName(item.type)} · ` : '', meaning]),
			icon(ICONS.chevron, 14),
		),
	);
}
