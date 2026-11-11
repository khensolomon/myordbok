// @ts-check
/**
 * Comments (?s=comments), for editors: every comment on an entry, newest
 * first, visible or hidden, found by word, text or author. A comment opens
 * whole, beside its entry's link; Hide takes it off the entry at once, Show
 * puts it back. Nothing is deleted here: authors delete their own.
 *
 *   &show=visible|hidden  &q=…  in the address
 */
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { definitionHref } from '../core/routes.js';
import { moderateComment, workspaceComments } from '../data/api.js';
import { mark, num, t } from '../i18n/index.js';
import { listBar } from './list-bar.js';

/** @typedef {import('../data/api.js').ModeratedComment} Comment */

const SHOWS = /** @type {const} */ ([
	['visible', mark('Visible')],
	['hidden', mark('Hidden')],
]);

/**
 * @param {import('../core/routes.js').ViewContext} ctx
 * @param {HTMLElement} root
 * @param {(when: number, short?: boolean) => string} ago
 */
export async function commentsPanes(ctx, root, ago) {
	const show = /** @type {'visible' | 'hidden'} */ (ctx.query.get('show') === 'hidden' ? 'hidden' : 'visible');
	const f = { show, q: (ctx.query.get('q') ?? '').trim() };
	const listPane = h('section', { class: 'ws-list', 'aria-label': t('Comments') });
	const work = h('main', { class: 'ws-main', 'aria-label': t('Work area') }, h('p', { class: 'ws-empty' }, t('Choose a comment from the list.')));
	const inspector = h('aside', { class: 'ws-inspector', 'aria-label': t('Details') });
	const search = /** @type {HTMLInputElement} */ (h('input', { type: 'search', placeholder: t('Word, text or name'), 'aria-label': t('Find a comment'), value: f.q }));
	const ol = h('ol', { class: 'ws-rows' });
	const head = h('span');
	const more = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-more', hidden: true }, t('Show more')));
	/** @type {Comment[]} */
	let items = [];
	/** @type {HTMLButtonElement[]} */
	let rows = [];
	let current = -1;

	/** @param {boolean} [again] */
	const load = async (again = false) => {
		const page = await workspaceComments(f, again ? items.length : 0);
		if (!again) {
			items = [];
			rows = [];
			current = -1;
			ol.replaceChildren();
		}
		const from = items.length;
		items.push(...page.comments);
		const added = page.comments.map((c, i) => row(c, ago, () => open(from + i)));
		rows.push(...added);
		ol.append(...added.map((b) => h('li', null, b)));
		if (!items.length) ol.replaceChildren(h('li', { class: 'ws-none' }, f.show === 'hidden' ? t('Nothing hidden.') : t('No comments yet.')));
		more.hidden = !page.more;
		head.textContent = num(f.show === 'hidden' ? page.counts.hidden : page.counts.visible);
		inspector.replaceChildren(
			h(
				'section',
				{ class: 'ws-box' },
				h('h2', null, t('Comments')),
				h('dl', { class: 'ws-facts' }, h('dt', null, t('Visible')), h('dd', null, num(page.counts.visible)), h('dt', null, t('Hidden')), h('dd', null, num(page.counts.hidden)), h('dt', null, t('Last {n} days', { n: 7 })), h('dd', null, num(page.counts.week))),
			),
			h('section', { class: 'ws-box' }, h('p', { class: 'ws-quiet' }, t('Comments show at once. Hiding one takes it off the entry for everyone, its author too, until it is shown again. New comments can be closed in Settings.'))),
		);
	};

	/** @param {number} i */
	const open = (i) => {
		if (i < 0 || i >= items.length) return;
		current = i;
		rows.forEach((r, n) => r.setAttribute('aria-current', String(n === i)));
		rows[i].scrollIntoView({ block: 'nearest' });
		root.toggleAttribute('data-open', true);
		const c = items[i];
		const back = h('button', { type: 'button', class: 'ws-back', 'aria-label': t('Back to the list') }, icon(ICONS.back, 20));
		back.addEventListener('click', () => root.removeAttribute('data-open'));
		const out = h('p', { class: 'ws-result', role: 'status' });
		const hidden = c.status === 'hidden';
		const toggle = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: hidden ? 'ws-secondary' : 'ws-danger' }, hidden ? t('Show it again') : t('Hide this comment')));
		toggle.addEventListener('click', async () => {
			toggle.disabled = true;
			out.textContent = t('Saving…');
			try {
				const next = hidden ? 'visible' : 'hidden';
				await moderateComment(c.id, next);
				items[i] = { ...c, status: next };
				rows[i].classList.toggle('ws-row-off', next === 'hidden');
				open(i);
			} catch (err) {
				out.textContent = err instanceof Error ? err.message : String(err);
				toggle.disabled = false;
			}
		});
		work.replaceChildren(
			h('header', { class: 'ws-crumbs' }, back, h('span', null, t('Comments')), h('span', { 'aria-hidden': 'true' }, '›'), h('span', { class: 'ws-crumb-word', lang: c.lang }, c.word)),
			h(
				'div',
				{ class: 'ws-work ws-comment' },
				h('p', { class: 'ws-quiet' }, t('{who} on {word}, {when}', { who: c.author, word: c.word, when: ago(c.at) }), hidden ? h('span', { class: 'ws-flag ws-flag-miss' }, ` · ${t('hidden')}`) : ''),
				h('blockquote', { class: 'ws-comment-body' }, c.body),
				h('div', { class: 'ws-actions' }, toggle, h('a', { class: 'ws-secondary', href: definitionHref(c.word) }, icon(ICONS.dictionary, 15), t('Open in the dictionary'))),
				out,
			),
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
			const p = new URLSearchParams({ s: 'comments' });
			if (f.show !== 'visible') p.set('show', f.show);
			if (f.q) p.set('q', f.q);
			history.replaceState(history.state, '', `/workspace?${p}`);
			load().catch((err) => ol.replaceChildren(h('li', { class: 'ws-none' }, err instanceof Error ? err.message : String(err))));
		}, 250);
	});
	listPane.append(
		...listBar({
			title: t('Comments'),
			count: head,
			groups: [{ title: t('Show'), current: f.show, fallback: 'visible', href: (s) => `/workspace?s=comments${s === 'visible' ? '' : `&show=${s}`}`, choices: SHOWS.map(([s, label]) => ({ value: s, label: t(label) })) }],
			reset: '/workspace?s=comments',
			search,
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
 * @param {Comment} c
 * @param {(when: number, short?: boolean) => string} ago
 * @param {() => void} onOpen
 */
function row(c, ago, onOpen) {
	const b = /** @type {HTMLButtonElement} */ (
		h(
			'button',
			{ type: 'button', class: `ws-row${c.status === 'hidden' ? ' ws-row-off' : ''}`, 'aria-current': 'false' },
			h('span', { class: 'ws-row-top' }, h('span', { class: 'ws-row-word', lang: c.lang }, c.word), h('span', { class: 'ws-row-time' }, ago(c.at, true))),
			h('span', { class: 'ws-row-sub ws-row-clip' }, c.body),
			h('span', { class: 'ws-row-state' }, c.author),
		)
	);
	b.addEventListener('click', onOpen);
	return b;
}
