// @ts-check
/**
 * A member's own Inbox (?s=inbox, for members who are not admins): the
 * messages they sent through the contact form while signed in, newest
 * first, each with where it stands and what was answered
 * (worker/routes/messages.js). Opening the page marks the answers seen.
 */
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { messagesSeen, myMessages } from '../data/api.js';
import { mark, t } from '../i18n/index.js';

/** @typedef {import('../data/api.js').OwnMessage} OwnMessage */

/** What the sender is told of a message's state. */
const STATE = /** @type {Record<OwnMessage['status'], string>} */ ({
	new: mark('Sent'),
	read: mark('Read'),
	replied: mark('Answered'),
	done: mark('Done'),
});

/** @type {Record<OwnMessage['kind'], string>} */
const KIND = {
	feedback: mark('Feedback'),
	question: mark('A question'),
	problem: mark('A problem with the site'),
	word: mark('A word to add'),
};

/**
 * @param {(when: number, short?: boolean) => string} ago
 * @param {() => void} onSeen  The rail's badge is cleared once the answers are seen.
 */
export async function messagesPane(ago, onSeen) {
	const { messages } = await myMessages();
	const write = h('a', { class: 'ws-primary ws-msgs-write', href: '/contact?from=/workspace' }, icon(ICONS.suggest, 16), t('Write a message'));
	const page = h(
		'div',
		{ class: 'ws-work ws-msgs' },
		h('h1', { class: 'ws-settings-title' }, t('Inbox')),
		h('p', { class: 'ws-msgs-lead' }, t('What you sent through the contact form, and what was answered. Thanks and ideas are read even when no answer is written.')),
		write,
		messages.length ? h('ol', { class: 'ws-msgs-list' }, messages.map((m) => h('li', null, card(m, ago)))) : h('p', { class: 'ws-none' }, t('Nothing sent yet.')),
	);
	if (messages.some((m) => m.unseen)) {
		// Seen once shown; a failure only leaves the badge for the next visit.
		messagesSeen().then(onSeen, (err) => console.warn('messages seen:', err));
	}
	return page;
}

/**
 * @param {OwnMessage} m
 * @param {(when: number, short?: boolean) => string} ago
 */
function card(m, ago) {
	return h(
		'article',
		{ class: `ws-msg${m.unseen ? ' ws-msg-new' : ''}` },
		h('header', { class: 'ws-msg-head' }, h('span', { class: 'ws-msg-kind' }, t(KIND[m.kind])), h('span', { class: 'ws-msg-time' }, ago(m.created_at)), h('span', { class: `ws-msg-state ws-msg-${m.status}` }, t(STATE[m.status]))),
		h('p', { class: 'ws-msg-body', lang: m.lang }, m.body),
		m.answer
			? h(
					'div',
					{ class: 'ws-msg-answer' },
					h('p', { class: 'ws-msg-from' }, h('strong', null, 'MyOrdbok'), m.answered_at ? h('span', null, ago(m.answered_at)) : null, m.unseen ? h('span', { class: 'ws-msg-fresh' }, t('New')) : null),
					h('p', { class: 'ws-msg-text', lang: m.lang }, m.answer),
				)
			: null,
	);
}
