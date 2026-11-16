// @ts-check
/**
 * The Inbox (?s=inbox), for admins: messages from the contact form
 * (/contact). A message is unread until opened, then read; an admin marks
 * it replied once answered and done when nothing is left to do. Any state
 * can be set again. Each message can carry a note for the admins; the
 * sender never sees it.
 *
 * Answering: a member who wrote while signed in reads the answer, and the
 * state, in their own Inbox (messages.js); nothing is mailed. A visitor has
 * no Inbox, so theirs is written in the admin's own mail, to the address
 * left. Either way the saved answers below start the text, in the language
 * the message was sent from, to be changed before it goes.
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

/**
 * Answers written often, in both languages the site is read in. They are
 * sent to readers, so they are kept here as texts of their own, not as
 * interface words: the one in the sender's language is used.
 * @type {ReadonlyArray<{ label: string, en: string, my: string }>}
 */
const SAVED = [
	{ label: mark('Thank you'), en: 'Thank you for the kind words. They are read, and they help.', my: 'ကြင်နာသော စကားများအတွက် ကျေးဇူးတင်ပါသည်။ ဖတ်ရှုပြီး အားတက်ရပါသည်။' },
	{ label: mark('On the list'), en: 'Thank you for the idea. It is on the list; a date cannot be promised yet.', my: 'အကြံပြုချက်အတွက် ကျေးဇူးတင်ပါသည်။ စာရင်းတွင် ထည့်ထားပါသည်။ ရက်စွဲကိုမူ မကတိပြုနိုင်သေးပါ။' },
	{ label: mark('It is fixed'), en: 'Thank you for telling us. It is fixed and on the site now.', my: 'အသိပေးသည့်အတွက် ကျေးဇူးတင်ပါသည်။ ပြင်ဆင်ပြီး ဝက်ဘ်ဆိုက်တွင် ရောက်ရှိနေပါပြီ။' },
	{ label: mark('The word is noted'), en: 'Thank you. The word is noted for the dictionary.', my: 'ကျေးဇူးတင်ပါသည်။ ထိုစကားလုံးကို အဘိဓာန်အတွက် မှတ်သားထားပါသည်။' },
	{ label: mark('More detail, please'), en: 'Thank you. To look into it, a little more is needed: which word or page was it, and what did you expect to see?', my: 'ကျေးဇူးတင်ပါသည်။ စစ်ဆေးနိုင်ရန် အနည်းငယ် ထပ်သိလိုပါသည်။ မည်သည့် စကားလုံး သို့မဟုတ် စာမျက်နှာ ဖြစ်ပြီး မည်သို့ မြင်ရမည်ဟု မျှော်လင့်ခဲ့ပါသနည်း။' },
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
	// Searches the messages in the list (the latest of the filter), as typed.
	const search = /** @type {HTMLInputElement} */ (h('input', { type: 'search', placeholder: t('Text, member or email'), 'aria-label': t('Find a message') }));
	search.addEventListener('input', () => {
		const q = search.value.trim().toLowerCase();
		items.forEach((m, i) => {
			const hit = !q || [m.body, m.member, m.reply_to, m.note].some((v) => v?.toLowerCase().includes(q));
			/** @type {HTMLElement} */ (rows[i].parentElement).hidden = !hit;
		});
	});
	const href = (/** @type {string} */ s) => `/workspace?s=inbox${s === 'new' ? '' : `&status=${s}`}`;
	/** The head and its filters; drawn again when a count changes. */
	const drawSegments = () =>
		bar.replaceChildren(
			...listBar({
				title: t('Inbox'),
				count: t('{n} unread', { n: counts.new }),
				groups: [{ title: t('Status'), current: filter, fallback: 'new', href, choices: [...STATES, /** @type {[string, string]} */ (['all', mark('All')])].map(([s, label]) => ({ value: s, label: t(label), count: s === 'all' ? undefined : counts[/** @type {State} */ (s)] })) }],
				reset: href('new'),
				search,
			}),
		);
	drawSegments();

	/**
	 * Saves a change and shows it everywhere it appears.
	 * @param {number} i
	 * @param {{ status?: State, note?: string | null, answer?: string | null }} change
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
		items[i] = { ...before, status: saved.status, note: saved.note, answer: saved.answer, answered_at: saved.answered_at, answer_seen: change.answer === undefined ? before.answer_seen : false, handled_by: t('you'), handled_at: Math.floor(Date.now() / 1000) };
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
		const out = h('p', { class: 'ws-result', role: 'status' });
		/** The states follow whatever was just saved. */
		const showState = () => {
			stateButtons.forEach((x, k) => x.setAttribute('aria-pressed', String(STATES[k][0] === items[i].status)));
			who.textContent = handled(items[i], ago);
		};

		// The answer: to a member's Inbox, or begun here for the admin's own mail.
		const signedIn = m.member !== null;
		const text = /** @type {HTMLTextAreaElement} */ (h('textarea', { class: 'ws-answer-text', rows: 4, maxlength: 2000, lang: m.lang, placeholder: signedIn ? t('An answer {name} reads in their Inbox', { name: m.member ?? '' }) : t('An answer to send by email') }, m.answer ?? ''));
		const sent = h('p', { class: 'ws-quiet' });
		const showSent = () => {
			const now = items[i];
			sent.textContent = now.answer ? (now.answer_seen ? t('Answered {when}; seen by the sender.', { when: ago(now.answered_at ?? 0) }) : t('Answered {when}; not seen yet.', { when: ago(now.answered_at ?? 0) })) : '';
		};
		showSent();
		const said = h('p', { class: 'ws-result', role: 'status' });
		const sendIt = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-primary' }, t('Send the answer')));
		const mail = /** @type {HTMLAnchorElement} */ (h('a', { class: 'ws-primary ws-reply' }, t('Reply by email')));
		const quoted = `\n\n> ${m.body.split('\n').join('\n> ')}`;
		const sync = () => {
			const written = text.value.trim();
			sendIt.disabled = !written || written === (items[i].answer ?? '');
			if (m.reply_to) mail.href = `mailto:${m.reply_to}?subject=${encodeURIComponent(t('Your message to MyOrdbok'))}&body=${encodeURIComponent(`${written}${quoted}`)}`;
		};
		text.addEventListener('input', sync);
		sync();
		/** @param {string} answer @param {State} [status] */
		const answerWith = async (answer, status) => {
			said.textContent = '';
			sendIt.disabled = true;
			thank.disabled = true;
			try {
				await save(i, status ? { answer, status } : { answer });
				text.value = answer;
				showState();
				showSent();
				said.textContent = t('The answer is in their Inbox.');
			} catch (err) {
				said.textContent = err instanceof Error ? err.message : String(err);
			}
			thank.disabled = false;
			sync();
		};
		sendIt.addEventListener('click', () => answerWith(text.value.trim()));
		const saved = h(
			'div',
			{ class: 'ws-saved', role: 'group', 'aria-label': t('Saved answers') },
			SAVED.map((s) => {
				const b = h('button', { type: 'button', class: 'ws-saved-one', title: s[m.lang] }, t(s.label));
				b.addEventListener('click', () => {
					text.value = s[m.lang];
					sync();
					text.focus();
				});
				return b;
			}),
		);
		// One press for the commonest answer: thanks, and nothing left to do.
		const thank = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-secondary' }, icon(ICONS.like, 15), t('Thank and close')));
		thank.addEventListener('click', () => answerWith(SAVED[0][m.lang], 'done'));
		const answerBox = h(
			'section',
			{ class: 'ws-answer' },
			h('h2', null, t('Answer')),
			signedIn || m.reply_to ? saved : '',
			signedIn || m.reply_to ? text : h('p', { class: 'ws-quiet' }, t('Sent without signing in and without an address: there is nowhere to answer. The state is still yours to set.')),
			signedIn ? h('div', { class: 'ws-answer-go' }, sendIt, thank) : m.reply_to ? h('div', { class: 'ws-answer-go' }, mail) : '',
			said,
			signedIn ? sent : m.reply_to ? h('p', { class: 'ws-quiet' }, t('Not signed in: the answer goes from your own mail to {email}. Set the state to Replied once sent.', { email: m.reply_to })) : '',
			signedIn && m.reply_to ? h('p', { class: 'ws-quiet' }, t('An address was left too:'), ' ', mail) : '',
		);

		work.replaceChildren(
			h('header', { class: 'ws-crumbs' }, back, h('span', null, t(KIND[m.kind])), h('span', { 'aria-hidden': 'true' }, '›'), h('span', null, ago(m.created_at))),
			h('div', { class: 'ws-work' }, h('p', { class: 'ws-message', lang: m.lang }, m.body), answerBox),
		);

		const stateButtons = STATES.map(([s, label], n) => {
			const b = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-state', 'aria-pressed': String(m.status === s), 'data-key': String(n + 1) }, t(label)));
			b.addEventListener('click', async () => {
				if (items[i].status === s) return;
				stateButtons.forEach((x) => (x.disabled = true));
				out.textContent = '';
				try {
					await save(i, { status: s });
					showState();
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
		inspector.replaceChildren(
			h(
				'section',
				{ class: 'ws-box' },
				h('h2', null, t('From')),
				h('p', null, m.member ?? t('A visitor, not signed in')),
				m.reply_to ? h('p', null, m.reply_to) : h('p', { class: 'ws-quiet' }, t('No address for a reply.')),
				h('p', { class: 'ws-quiet' }, signedIn ? t('Signed in: an answer shows in their Inbox.') : t('Not signed in: no Inbox to answer in.')),
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
