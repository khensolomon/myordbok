// @ts-check
/**
 * The Inbox (?s=inbox), for admins: messages from the contact form
 * (/contact). A message is unread until opened, then read; an admin marks
 * it replied once answered (by their own mail, to the address left) and done
 * when nothing is left to do. Any state can be set again. Each message can
 * carry a note for the admins; the sender never sees it.
 */
import { listBar } from './list-bar.js';
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { inboxMessages, updateMessage } from '../data/api.js';
import { mark, num, t } from '../i18n/index.js';

/** @typedef {import('../data/api.js').InboxMessage} Message */
/** @typedef {import('../data/api.js').MessageState} State */

/** @type {ReadonlyArray<[State, string]>} */
const STATES = [
	['new', mark('Unread')],
	['read', mark('Read')],
	['replied', mark('Replied')],
	['done', mark('Done')],
];

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
 * @param {(unread: number) => void} onUnread  The rail's badge follows the unread count.
 */
export async function inboxPanes(ctx, root, ago, onUnread) {
	const asked = ctx.query.get('status');
	/** @type {State | 'all'} */
	const filter = asked === 'all' || STATES.some(([s]) => s === asked) ? /** @type {State | 'all'} */ (asked) : 'new';
	const listPane = h('section', { class: 'ws-list', 'aria-label': t('Inbox') });
	const work = h('main', { class: 'ws-main', 'aria-label': t('Work area') }, h('p', { class: 'ws-empty' }, t('Choose a message from the list.')));
	const inspector = h('aside', { class: 'ws-inspector', 'aria-label': t('Details') });

	const page = await inboxMessages({ status: filter });
	const counts = { ...page.counts };
	/** @type {Message[]} */
	const items = page.messages;
	const rows = items.map((m, i) => row(m, ago, () => open(i)));
	const ol = h('ol', { class: 'ws-rows' }, rows.length ? rows.map((b) => h('li', null, b)) : h('li', { class: 'ws-none' }, filter === 'new' ? t('No unread messages.') : t('Nothing here.')));
	const bar = h('div', { class: 'ws-list-top' });
	const href = (/** @type {string} */ s) => `/workspace?s=inbox${s === 'new' ? '' : `&status=${s}`}`;
	/** The head and its filters; drawn again when a count changes. */
	const drawSegments = () =>
		bar.replaceChildren(
			...listBar({
				title: t('Inbox'),
				count: t('{n} unread', { n: counts.new }),
				main: { title: t('Show'), current: filter, fallback: 'new', href, choices: [{ value: 'new', label: t('Unread'), count: counts.new }, { value: 'all', label: t('All') }] },
				more: [{ title: t('Status'), current: filter, fallback: 'new', href, choices: [...STATES, /** @type {[string, string]} */ (['all', mark('All')])].map(([s, label]) => ({ value: s, label: t(label), count: s === 'all' ? undefined : counts[/** @type {State} */ (s)] })) }],
				reset: href('new'),
			}),
		);
	drawSegments();

	/**
	 * Saves a change and shows it everywhere it appears.
	 * @param {number} i
	 * @param {{ status?: State, note?: string | null }} change
	 */
	const save = async (i, change) => {
		const before = items[i];
		const saved = await updateMessage(before.id, change);
		if (saved.status !== before.status) {
			counts[before.status]--;
			counts[saved.status]++;
			onUnread(counts.new);
			drawSegments();
		}
		items[i] = { ...before, status: saved.status, note: saved.note, handled_by: t('you'), handled_at: Math.floor(Date.now() / 1000) };
		rows[i].classList.toggle('ws-row-unread', saved.status === 'new');
		rows[i].querySelector('.ws-row-state')?.replaceChildren(stateName(saved.status));
	};

	/** @param {number} i */
	const open = async (i) => {
		current = i;
		rows.forEach((r, n) => r.setAttribute('aria-current', String(n === i)));
		root.toggleAttribute('data-open', true);
		// Opening a message reads it.
		if (items[i].status === 'new') await save(i, { status: 'read' }).catch(() => {});
		const m = items[i];
		const back = h('button', { type: 'button', class: 'ws-back', 'aria-label': t('Back to the list') }, icon(ICONS.back, 20));
		back.addEventListener('click', () => root.removeAttribute('data-open'));
		work.replaceChildren(
			h('header', { class: 'ws-crumbs' }, back, h('span', null, t(KIND[m.kind])), h('span', { 'aria-hidden': 'true' }, '›'), h('span', null, ago(m.created_at))),
			h('div', { class: 'ws-work' }, h('p', { class: 'ws-message', lang: m.lang }, m.body)),
		);

		const out = h('p', { class: 'ws-result', role: 'status' });
		const stateButtons = STATES.map(([s, label], n) => {
			const b = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-state', 'aria-pressed': String(m.status === s), 'data-key': String(n + 1) }, t(label)));
			b.addEventListener('click', async () => {
				if (items[i].status === s) return;
				stateButtons.forEach((x) => (x.disabled = true));
				out.textContent = '';
				try {
					await save(i, { status: s });
					stateButtons.forEach((x, k) => x.setAttribute('aria-pressed', String(STATES[k][0] === s)));
					who.textContent = handled(items[i], ago);
				} catch (err) {
					out.textContent = err instanceof Error ? err.message : String(err);
				} finally {
					stateButtons.forEach((x) => (x.disabled = false));
				}
			});
			return b;
		});
		const who = h('p', { class: 'ws-quiet' }, handled(m, ago));
		const note = /** @type {HTMLTextAreaElement} */ (h('textarea', { rows: 3, maxlength: 2000, placeholder: t('Only admins see this note') }, m.note ?? ''));
		const keep = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-secondary', disabled: true }, t('Save note')));
		note.addEventListener('input', () => (keep.disabled = note.value.trim() === (items[i].note ?? '')));
		keep.addEventListener('click', async () => {
			keep.disabled = true;
			try {
				await save(i, { note: note.value.trim() || null });
				out.textContent = t('Note saved.');
			} catch (err) {
				keep.disabled = false;
				out.textContent = err instanceof Error ? err.message : String(err);
			}
		});
		const reply = m.reply_to
			? h('a', { class: 'ws-primary ws-reply', href: `mailto:${m.reply_to}?subject=${encodeURIComponent(t('Your message to MyOrdbok'))}&body=${encodeURIComponent(`\n\n> ${m.body.split('\n').join('\n> ')}`)}` }, t('Reply by email'))
			: null;

		inspector.replaceChildren(
			h(
				'section',
				{ class: 'ws-box' },
				h('h2', null, t('From')),
				h('p', null, m.member ?? t('A visitor, not signed in')),
				m.reply_to ? h('p', null, m.reply_to) : h('p', { class: 'ws-quiet' }, t('No address for a reply.')),
				reply ?? '',
				h('p', { class: 'ws-quiet' }, m.lang === 'my' ? t('Sent from the Myanmar interface.') : t('Sent from the English interface.')),
			),
			m.page ? h('section', { class: 'ws-box' }, h('h2', null, t('About the page')), h('p', null, h('a', { href: m.page }, m.page))) : '',
			h('section', { class: 'ws-box' }, h('h2', null, t('State')), h('div', { class: 'ws-states', role: 'group', 'aria-label': t('State') }, stateButtons), who),
			h('section', { class: 'ws-box' }, h('h2', null, t('Note')), note, keep, out, h('p', { class: 'ws-quiet ws-keys' }, t('1–4 state · J K next, previous'))),
		);
	};
	let current = -1;

	listPane.append(
		bar,
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
		else if (/^[1-4]$/.test(k)) /** @type {HTMLButtonElement | null} */ (inspector.querySelector(`[data-key="${k}"]`))?.click();
		else return;
		ev.preventDefault();
	};
	document.addEventListener('keydown', keys);
	return [listPane, work, inspector];
}

/** @param {State} s */
const stateName = (s) => t(/** @type {[State, string]} */ (STATES.find(([x]) => x === s))[1]);

/**
 * "Replied · by Khen, 2 h ago"
 * @param {Message} m
 * @param {(when: number, short?: boolean) => string} ago
 */
function handled(m, ago) {
	if (!m.handled_at) return '';
	return m.handled_by ? t('Last changed by {who}, {when}', { who: m.handled_by, when: ago(m.handled_at) }) : t('Last changed {when}', { when: ago(m.handled_at) });
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
			h('span', { class: 'ws-row-state' }, stateName(m.status)),
		)
	);
	b.addEventListener('click', onOpen);
	return b;
}
