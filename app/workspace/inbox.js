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
 *
 * The list is narrowed in the address (&status= &kind= &from= &lang=
 * &answer= &q=) and read 30 at a time. The boxes pick several messages for
 * one action: a state, thanks to each member in their language, or deleting
 * them for good (asked twice).
 */
import { listBar } from './list-bar.js';
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { bulkMessages, inboxMessages, inboxQuery, updateMessage } from '../data/api.js';
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

/** Most messages one action takes (worker/routes/messages.js BULK_MAX). */
const BULK_MAX = 200;

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
	const q0 = ctx.query;
	const one = (/** @type {readonly string[]} */ allowed, /** @type {string} */ name, /** @type {string} */ fallback) => (allowed.includes(q0.get(name) ?? '') ? /** @type {string} */ (q0.get(name)) : fallback);
	/** @type {import('../data/api.js').InboxFilter} */
	const f = {
		status: /** @type {State | 'all'} */ (one([...STATES.map(([s]) => s), 'all'], 'status', 'new')),
		kind: /** @type {import('../data/api.js').InboxFilter['kind']} */ (one(Object.keys(KIND), 'kind', '')),
		from: /** @type {'' | 'member' | 'visitor'} */ (one(['member', 'visitor'], 'from', '')),
		lang: /** @type {'' | 'en' | 'my'} */ (one(['en', 'my'], 'lang', '')),
		answer: /** @type {'' | 'yes' | 'no'} */ (one(['yes', 'no'], 'answer', '')),
		q: (q0.get('q') ?? '').trim(),
	};
	/** The address with one part of the filter changed. @param {Partial<typeof f>} change */
	const href = (change) => {
		const p = inboxQuery({ ...f, ...change });
		p.set('s', 'inbox');
		return `/workspace?${p}`;
	};
	const listPane = h('section', { class: 'ws-list', 'aria-label': t('Inbox') });
	const work = h('main', { class: 'ws-main', 'aria-label': t('Work area') }, h('p', { class: 'ws-empty' }, t('Choose a message from the list.')));
	const inspector = h('aside', { class: 'ws-inspector', 'aria-label': t('Details') });
	const ol = h('ol', { class: 'ws-rows ws-rows-pick' });
	const bar = h('div', { class: 'ws-list-top' });
	const bulk = h('div', { class: 'ws-bulk', hidden: true, role: 'region', 'aria-label': t('Selected messages') });
	const more = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-more', hidden: true }, t('Show more')));
	// Searches every message of the filter, on the server, a moment after typing stops.
	const search = /** @type {HTMLInputElement} */ (h('input', { type: 'search', placeholder: t('Text, member or email'), 'aria-label': t('Find a message'), value: f.q }));

	/** @type {Message[]} */
	let items = [];
	/** @type {HTMLButtonElement[]} */
	let rows = [];
	/** @type {HTMLInputElement[]} */
	let boxes = [];
	let current = -1;
	/** The box last ticked or cleared, for a range with Shift. */
	let anchor = -1;
	/** @type {Record<State, number>} */
	let counts = { new: 0, read: 0, replied: 0, done: 0 };
	/** Every unread message, whatever the list is narrowed to (the rail's badge). */
	let unread = 0;

	/** @param {ReadonlyArray<readonly [string, string]>} options */
	const choices = (options) => options.map(([v, text]) => ({ value: v, label: t(text) }));
	const any = /** @type {const} */ (['', mark('Any')]);
	/** The head and its filters; drawn again when a count changes. */
	const drawSegments = () =>
		bar.replaceChildren(
			...listBar({
				title: t('Inbox'),
				count: t('{n} unread', { n: unread }),
				// Most important first: the ones that do not fit the column go under ⋯.
				groups: [
					{ title: t('Status'), current: f.status, fallback: 'new', href: (s) => href({ status: /** @type {State | 'all'} */ (s) }), choices: [...STATES, /** @type {[string, string]} */ (['all', mark('All')])].map(([s, label]) => ({ value: s, label: t(label), count: s === 'all' ? undefined : counts[/** @type {State} */ (s)] })) },
					{ title: t('Kind'), current: f.kind, fallback: '', href: (v) => href({ kind: /** @type {typeof f.kind} */ (v) }), choices: choices([any, ...Object.entries(KIND)]) },
					{ title: t('From'), current: f.from, fallback: '', href: (v) => href({ from: /** @type {typeof f.from} */ (v) }), choices: choices([any, ['member', mark('Members')], ['visitor', mark('Visitors')]]) },
					{ title: t('Answer'), current: f.answer, fallback: '', href: (v) => href({ answer: /** @type {typeof f.answer} */ (v) }), choices: choices([any, ['yes', mark('Answered')], ['no', mark('Not answered')]]) },
					{ title: t('Language'), current: f.lang, fallback: '', href: (v) => href({ lang: /** @type {typeof f.lang} */ (v) }), choices: choices([['', mark('Both')], ['en', mark('English')], ['my', mark('Myanmar')]]) },
				],
				reset: href({ status: 'new', kind: '', from: '', lang: '', answer: '' }),
				search,
			}),
		);

	/** A state changed: the counts, the rail's badge and the row follow. @param {number} i @param {State} to */
	const moved = (i, to) => {
		const from = items[i].status;
		if (from === to) return;
		counts[from]--;
		counts[to]++;
		unread += (to === 'new' ? 1 : 0) - (from === 'new' ? 1 : 0);
		rows[i].classList.toggle('ws-row-unread', to === 'new');
		rows[i].querySelector('.ws-row-state')?.replaceChildren(stateName(to));
	};

	/**
	 * Saves a change and shows it everywhere it appears.
	 * @param {number} i
	 * @param {{ status?: State, note?: string | null, answer?: string | null }} change
	 */
	const save = async (i, change) => {
		const before = items[i];
		const saved = await updateMessage(before.id, change);
		if (saved.status !== before.status) {
			moved(i, saved.status);
			onUnread(unread);
			drawSegments();
		}
		items[i] = { ...before, status: saved.status, note: saved.note, answer: saved.answer, answered_at: saved.answered_at, answer_seen: change.answer === undefined ? before.answer_seen : false, handled_by: t('you'), handled_at: Math.floor(Date.now() / 1000) };
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
		/** @param {'new' | 'read' | 'done' | 'thank' | 'delete'} action */
		const go = async (action) => {
			if (picked.length > BULK_MAX) {
				out.textContent = t('At most {n} messages at once.', { n: num(BULK_MAX) });
				return;
			}
			for (const b of bulk.querySelectorAll('button')) b.disabled = true;
			try {
				const done = await bulkMessages(picked.map((i) => items[i].id), action, action === 'thank' ? { en: SAVED[0].en, my: SAVED[0].my } : undefined);
				// Deleted messages leave the list, and thanks change what a message shows: the list is read again.
				await load();
				if (done.skipped && action === 'thank') bulk.replaceChildren(h('span', { role: 'status' }, t('{n} thanked; {m} were from visitors, who have no Inbox.', { n: num(done.changed), m: num(done.skipped) }))), (bulk.hidden = false);
			} catch (err) {
				out.textContent = err instanceof Error ? err.message : String(err);
				for (const b of bulk.querySelectorAll('button')) b.disabled = false;
			}
		};
		const act = (/** @type {string} */ text, /** @type {() => void} */ on, cls = 'ws-bulk-act') => {
			const b = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: cls }, text));
			b.addEventListener('click', on);
			return b;
		};
		// Deleting asks twice: it cannot be taken back.
		let sure = false;
		const del = act(t('Delete'), () => {
			if (sure) return go('delete');
			sure = true;
			del.textContent = t('Delete {n} for good?', { n: num(picked.length) });
			setTimeout(() => {
				sure = false;
				if (del.isConnected) del.textContent = t('Delete');
			}, 4000);
		}, 'ws-bulk-act ws-bulk-danger');
		bulk.replaceChildren(
			h('strong', null, t('{n} selected', { n: num(picked.length) })),
			h('span', { class: 'ws-bulk-acts' }, act(t('Read'), () => go('read')), act(t('Done'), () => go('done')), act(t('Thank and close'), () => go('thank')), act(t('Unread'), () => go('new')), del),
			h(
				'span',
				{ class: 'ws-bulk-acts' },
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

	/** @param {boolean} [again]  Adds the next page instead of starting over. */
	const load = async (again = false) => {
		const page = await inboxMessages(f, again && items.length ? items[items.length - 1].id : undefined);
		if (!again) {
			items = [];
			rows = [];
			boxes = [];
			current = -1;
			anchor = -1;
			ol.replaceChildren();
		}
		const from = items.length;
		items.push(...page.messages);
		ol.append(
			...page.messages.map((m, n) => {
				const i = from + n;
				const b = row(m, ago, () => open(i));
				rows.push(b);
				const box = /** @type {HTMLInputElement} */ (h('input', { type: 'checkbox', class: 'ws-pick', 'aria-label': t('Select this message') }));
				boxes.push(box);
				box.addEventListener('click', (ev) => {
					// Shift takes every box between this one and the last one touched.
					if (ev.shiftKey && anchor >= 0 && anchor !== i) {
						const [a, z] = anchor < i ? [anchor, i] : [i, anchor];
						for (let k = a; k <= z; k++) boxes[k].checked = box.checked;
					}
					anchor = i;
					drawBulk();
				});
				return h('li', null, box, b);
			}),
		);
		if (!items.length) ol.replaceChildren(h('li', { class: 'ws-none' }, f.status === 'new' && !f.kind && !f.from && !f.lang && !f.answer && !f.q ? t('No unread messages.') : t('Nothing here.')));
		more.hidden = !page.more;
		counts = { ...page.counts };
		unread = page.unread;
		onUnread(unread);
		drawSegments();
		drawBulk();
		if (!again && !items.length) {
			work.replaceChildren(h('p', { class: 'ws-empty' }, t('Choose a message from the list.')));
			inspector.replaceChildren();
		}
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
		// Who the answer is for and how it reaches them, where it is written.
		const to = h(
			'p',
			{ class: 'ws-answer-to' },
			signedIn || m.reply_to ? h('strong', null, t('To {name}', { name: m.member ?? m.reply_to ?? '' })) : null,
			h('span', { class: `ws-who ws-who-${signedIn ? 'member' : 'visitor'}` }, signedIn ? t('Member') : t('Visitor')),
			h('span', null, signedIn ? t('reads it in their Inbox') : m.reply_to ? t('goes by email') : t('no address')),
		);
		const answerBox = h(
			'section',
			{ class: 'ws-answer' },
			h('h2', null, t('Answer')),
			to,
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
	listPane.append(bar, bulk, ol, more);
	await load();
	if (items.length && matchMedia('(min-width: 761px)').matches) open(0);

	/** @param {KeyboardEvent} ev */
	const keys = (ev) => {
		if (!root.isConnected) return document.removeEventListener('keydown', keys);
		const target = /** @type {HTMLElement} */ (ev.target);
		if (ev.metaKey || ev.ctrlKey || ev.altKey || target.closest('input:not([type=checkbox]), textarea, select, [contenteditable]')) return;
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
			h('span', { class: 'ws-row-meta' }, h('span', { class: 'ws-row-state' }, stateName(m.status)), h('span', { class: `ws-who ws-who-${m.member !== null ? 'member' : 'visitor'}` }, m.member !== null ? t('Member') : t('Visitor'))),
		)
	);
	b.addEventListener('click', onOpen);
	return b;
}
