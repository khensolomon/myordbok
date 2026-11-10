// @ts-check
/**
 * The Inbox (?s=inbox), for admins: messages from the contact form
 * (/contact). A message is new until marked done; a reply goes by the
 * admin's own email to the address the sender left, if any.
 */
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { inboxMessages, markMessage } from '../data/api.js';
import { mark, t } from '../i18n/index.js';

/** @typedef {import('../data/api.js').InboxMessage} Message */

const FILTERS = /** @type {const} */ ([
	['new', mark('New')],
	['done', mark('Done')],
	['all', mark('All')],
]);

/** @type {Record<Message['kind'], string>} */
const KIND = {
	feedback: mark('Feedback'),
	question: mark('A question'),
	problem: mark('A problem with the site'),
	word: mark('A word to add'),
};

/**
 * The list, the message and its actions, inside the workspace frame.
 * @param {import('../core/routes.js').ViewContext} ctx
 * @param {HTMLElement} root  The workspace frame (.ws); data-open shows the message on phones.
 * @param {(when: number, short?: boolean) => string} ago
 * @param {(by: number) => void} onUnread  The rail's badge follows the unread count.
 */
export async function inboxPanes(ctx, root, ago, onUnread) {
	const asked = ctx.query.get('status');
	const filter = FILTERS.some(([s]) => s === asked) ? /** @type {'new' | 'done' | 'all'} */ (asked) : 'new';
	const listPane = h('section', { class: 'ws-list', 'aria-label': t('Inbox') });
	const work = h('main', { class: 'ws-main', 'aria-label': t('Work area') }, h('p', { class: 'ws-empty' }, t('Choose a message from the list.')));
	const inspector = h('aside', { class: 'ws-inspector', 'aria-label': t('Details') });

	const page = await inboxMessages({ status: filter });
	/** @type {Message[]} */
	const items = page.messages;
	const rows = items.map((m, i) => row(m, ago, () => open(i)));
	const ol = h('ol', { class: 'ws-rows' }, rows.length ? rows.map((b) => h('li', null, b)) : h('li', { class: 'ws-none' }, filter === 'new' ? t('No new messages.') : t('Nothing here.')));

	/** @param {number} i */
	const open = (i) => {
		const m = items[i];
		rows.forEach((r, n) => r.setAttribute('aria-current', String(n === i)));
		root.toggleAttribute('data-open', true);
		const back = h('button', { type: 'button', class: 'ws-back', 'aria-label': t('Back to the list') }, icon(ICONS.back, 20));
		back.addEventListener('click', () => root.removeAttribute('data-open'));
		work.replaceChildren(
			h('header', { class: 'ws-crumbs' }, back, h('span', null, t(KIND[m.kind])), h('span', { 'aria-hidden': 'true' }, '›'), h('span', null, ago(m.created_at))),
			h('div', { class: 'ws-work' }, h('p', { class: 'ws-message', lang: m.lang }, m.body)),
		);
		const out = h('p', { class: 'ws-result', role: 'status' });
		const toggle = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: m.status === 'new' ? 'ws-primary' : 'ws-secondary', 'data-key': 'a' }, m.status === 'new' ? t('Mark as done') : t('Mark as new')));
		toggle.addEventListener('click', async () => {
			toggle.disabled = true;
			const next = m.status === 'new' ? 'done' : 'new';
			try {
				await markMessage(m.id, next);
				onUnread(next === 'done' ? -1 : 1);
				items[i] = { ...m, status: next };
				rows[i].classList.toggle('ws-row-unread', next === 'new');
				open(i);
			} catch (err) {
				toggle.disabled = false;
				out.textContent = err instanceof Error ? err.message : String(err);
			}
		});
		inspector.replaceChildren(
			h(
				'section',
				{ class: 'ws-box' },
				h('h2', null, t('From')),
				h('p', null, m.member ?? t('A visitor, not signed in')),
				m.reply_to ? h('p', null, h('a', { href: `mailto:${m.reply_to}?subject=${encodeURIComponent('MyOrdbok')}` }, m.reply_to)) : h('p', { class: 'ws-quiet' }, t('No address for a reply.')),
				h('p', { class: 'ws-quiet' }, m.lang === 'my' ? t('Sent from the Myanmar interface.') : t('Sent from the English interface.')),
			),
			m.page ? h('section', { class: 'ws-box' }, h('h2', null, t('About the page')), h('p', null, h('a', { href: m.page }, m.page))) : '',
			h('section', { class: 'ws-box' }, toggle, out, h('p', { class: 'ws-quiet ws-keys' }, t('A mark · J K next, previous'))),
		);
		current = i;
	};
	let current = -1;

	listPane.append(
		h('header', { class: 'ws-list-head' }, h('h1', null, t('Inbox')), h('span', null, t('{n} new', { n: page.unread }))),
		h('nav', { class: 'ws-segments', 'aria-label': t('Show') }, FILTERS.map(([s, label]) => h('a', { href: `/workspace?s=inbox&status=${s}`, 'aria-current': s === filter ? 'true' : null }, t(label)))),
		ol,
		page.more ? h('p', { class: 'ws-quiet ws-more-note' }, t('Showing the latest {n}.', { n: items.length })) : '',
	);
	if (items.length && matchMedia('(min-width: 761px)').matches) open(0);

	/** @param {KeyboardEvent} ev */
	const keys = (ev) => {
		if (!root.isConnected) return document.removeEventListener('keydown', keys);
		const target = /** @type {HTMLElement} */ (ev.target);
		if (ev.metaKey || ev.ctrlKey || ev.altKey || target.closest('input, textarea, select, [contenteditable]')) return;
		const k = ev.key.toLowerCase();
		if (k === 'j' && current + 1 < items.length) open(current + 1);
		else if (k === 'k' && current > 0) open(current - 1);
		else if (k === 'a') /** @type {HTMLButtonElement | null} */ (inspector.querySelector('[data-key="a"]'))?.click();
		else return;
		ev.preventDefault();
	};
	document.addEventListener('keydown', keys);
	return [listPane, work, inspector];
}

/**
 * @param {Message} m
 * @param {(when: number, short?: boolean) => string} ago
 * @param {() => void} onOpen
 */
function row(m, ago, onOpen) {
	const b = /** @type {HTMLButtonElement} */ (
		h(
			'button',
			{ type: 'button', class: `ws-row${m.status === 'new' ? ' ws-row-unread' : ''}`, 'aria-current': 'false' },
			h('span', { class: 'ws-row-top' }, h('span', { class: 'ws-row-word' }, t(KIND[m.kind])), h('span', { class: 'ws-row-time' }, ago(m.created_at, true))),
			h('span', { class: 'ws-row-sub', lang: m.lang }, m.body.length > 90 ? `${m.body.slice(0, 90)}…` : m.body),
		)
	);
	b.addEventListener('click', onOpen);
	return b;
}
