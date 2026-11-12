// @ts-check
/**
 * /contact: feedback, questions, problems and words to add, sent to the
 * Inbox in the workspace (worker/routes/messages.js). MyOrdbok has no email
 * address; a reply goes to the address left here, if any.
 *
 *   ?kind=word&word=selfie   opens as "a word to add", with the word written in
 *   ?from=/definition?q=…    the page the message is about
 *
 * The form has a field people never see; anything that fills it is taken
 * for a script and the message is not kept.
 */
import { h } from '../core/dom.js';
import { member } from '../core/member.js';
import { sendMessage, siteSwitches } from '../data/api.js';
import { noZawgyi } from '../core/zawgyi.js';
import { getLang, mark, t } from '../i18n/index.js';
import { REPOSITORY } from '../core/config.js';

const KINDS = /** @type {const} */ ([
	['feedback', mark('Feedback')],
	['question', mark('A question')],
	['problem', mark('A problem with the site')],
	['word', mark('A word to add')],
]);
/** @typedef {typeof KINDS[number][0]} Kind */

export function title() {
	return t('Contact');
}

/** @param {import('../core/routes.js').ViewContext} ctx */
export async function view(ctx) {
	// Closed in Settings: a note instead of the form (the Worker refuses messages either way).
	const site = await siteSwitches().catch(() => null);
	if (site && !site.contact) {
		return h('section', { class: 'page contact' }, h('h1', null, t('Contact')), h('p', { class: 'notice' }, t('The contact form is closed for now. Please try again later.')));
	}
	const asked = ctx.query.get('kind');
	/** @type {Kind} */
	const kind = KINDS.some(([k]) => k === asked) ? /** @type {Kind} */ (asked) : 'feedback';
	const word = ctx.query.get('word')?.trim().slice(0, 100) ?? '';
	const from = ctx.query.get('from');
	const page = from && from.startsWith('/') && !from.startsWith('//') ? from.slice(0, 300) : '';

	const choice = /** @type {HTMLSelectElement} */ (h('select', { name: 'kind' }, KINDS.map(([k, label]) => h('option', { value: k, selected: k === kind ? true : null }, t(label)))));
	const body = /** @type {HTMLTextAreaElement} */ (h('textarea', { name: 'body', rows: 6, maxlength: 4000, required: true }, word ? t('Please add “{word}”.', { word }) : ''));
	const reply = /** @type {HTMLInputElement} */ (h('input', { type: 'email', name: 'reply_to', autocomplete: 'email', maxlength: 254, inputmode: 'email' }));
	// People never see this field; scripts that fill every field do.
	const trap = /** @type {HTMLInputElement} */ (h('input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off' }));
	const send = /** @type {HTMLButtonElement} */ (h('button', { type: 'submit', class: 'contact-send' }, t('Send')));
	const result = h('p', { class: 'contact-result', role: 'status' });

	// A signed-in member's address is known already; the field is still theirs to fill or leave.
	member()
		.then((m) => {
			if (m?.email && !reply.value) reply.placeholder = m.email;
		})
		.catch(() => {});

	const form = h(
		'form',
		{ class: 'contact-form', novalidate: true },
		h('label', null, t('What is it about?'), choice),
		h('label', null, t('Message'), body),
		h('label', null, t('Your email, for a reply (optional)'), reply, h('small', null, t('Only to answer this message; never for anything else.'))),
		h('div', { class: 'contact-trap', 'aria-hidden': 'true' }, h('label', null, 'Website', trap)),
		h('div', { class: 'contact-actions' }, send),
		result,
	);
	form.addEventListener('submit', async (ev) => {
		ev.preventDefault();
		result.className = 'contact-result';
		if (!body.value.trim()) {
			result.className = 'contact-result contact-failed';
			result.textContent = t('Write a message first.');
			body.focus();
			return;
		}
		if (!(await noZawgyi([body], result))) return;
		send.disabled = true;
		result.textContent = t('Sending…');
		try {
			await sendMessage({
				kind: /** @type {Kind} */ (choice.value),
				body: body.value,
				reply_to: reply.value.trim() || undefined,
				page: page || undefined,
				lang: getLang(),
				website: trap.value,
			});
			form.replaceWith(h('div', { class: 'contact-done', role: 'status' }, h('p', null, t('Thank you. The message has been sent.')), reply.value.trim() ? h('p', null, t('A reply, if one is needed, goes to {email}.', { email: reply.value.trim() })) : null, h('a', { href: '/' }, t('Back to the dictionary'))));
		} catch (err) {
			send.disabled = false;
			result.className = 'contact-result contact-failed';
			result.textContent = err instanceof Error ? err.message : String(err);
		}
	});

	return h(
		'section',
		{ class: 'page contact' },
		h('h1', null, t('Contact')),
		h('p', { class: 'contact-lead' }, t('Feedback, a question, a problem or a word the dictionary lacks: write it here. Messages are read by the people who run MyOrdbok.')),
		page ? h('p', { class: 'notice' }, t('About the page {page}', { page })) : null,
		form,
		h(
			'aside',
			{ class: 'contact-github' },
			h('h2', null, t('Ideas, feature requests and bugs')),
			h('p', null, t('MyOrdbok is developed in the open. A feature request, an idea or a bug report is best opened as an issue on GitHub, where anyone can follow it, add to it and see what becomes of it.')),
			h('p', null, h('a', { href: `${REPOSITORY}/issues`, target: '_blank', rel: 'noopener' }, t('Open the issues on GitHub ↗'))),
			h('p', { class: 'contact-small' }, t('The form above is for anything else, and for what should not be public.')),
		),
	);
}
