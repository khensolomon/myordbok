// @ts-check
/**
 * /link?code=ABCD-EFGH: linking the MyOrdbok app to the account signed in
 * here (worker/routes/link.js). The app opens this page with its code in
 * the address; signed out, the member signs in first and comes back here.
 * The page names the kind of device asking, so a code sent by someone else
 * is easy to turn down.
 */
import { getJSON, postJSON } from '#platform/http.js';
import { h } from '../core/dom.js';
import { DEVICE_NAMES, member, providerLinks } from '../core/member.js';
import { t } from '../i18n/index.js';

export function title() {
	return t('Link the app');
}

/** @param {import('../core/routes.js').ViewContext} ctx */
export async function view(ctx) {
	const given = (ctx.query.get('code') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
	const shown = given.length === 8 ? `${given.slice(0, 4)}-${given.slice(4)}` : '';
	const page = h('section', { class: 'page link' }, h('h1', null, t('Link the app')));
	const me = await member().catch(() => null);
	if (!me) {
		page.append(
			h('p', null, t('Sign in to link the MyOrdbok app on your phone or tablet to your account.')),
			providerLinks('ws-provider', `/link${shown ? `?code=${shown}` : ''}`),
		);
		return page;
	}

	const field = /** @type {HTMLInputElement} */ (
		h('input', { type: 'text', value: shown, maxlength: 9, autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'ABCD-EFGH', 'aria-label': t('The code the app shows') })
	);
	const asking = h('div', { class: 'link-asking', role: 'status' });
	const result = h('p', { class: 'link-result', role: 'alert' });
	const approve = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'link-approve', disabled: true }, t('Link this device')));
	const deny = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'link-deny', disabled: true }, t('Not me: cancel')));
	/** The code checked last, ready to answer. */
	let ready = '';

	const check = async () => {
		const code = field.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
		ready = '';
		approve.disabled = deny.disabled = true;
		result.textContent = '';
		asking.replaceChildren();
		if (code.length !== 8) return;
		try {
			const ask = await getJSON(`/api/link/code/${code}`);
			ready = code;
			asking.replaceChildren(
				h('p', null, h('strong', null, t(DEVICE_NAMES[ask.device] ?? ask.device)), ' ', t('asks to use MyOrdbok as {name}.', { name: me.name })),
				h('p', { class: 'ws-quiet' }, t('Link it only if it is yours and in your hand now, showing this code.')),
			);
			approve.disabled = deny.disabled = false;
		} catch (err) {
			result.textContent = err instanceof Error ? err.message : String(err);
		}
	};
	field.addEventListener('input', () => {
		if (field.value.replace(/[^A-Za-z0-9]/g, '').length === 8) check();
		else {
			ready = '';
			approve.disabled = deny.disabled = true;
			asking.replaceChildren();
		}
	});

	/** @param {boolean} yes */
	const answer = async (yes) => {
		if (!ready) return;
		approve.disabled = deny.disabled = field.disabled = true;
		try {
			await postJSON(`/api/link/code/${ready}`, { approve: yes });
			form.replaceChildren(
				h('p', { class: 'link-done' }, yes ? t('Linked. Go back to the app: it is signed in as {name}.', { name: me.name }) : t('Cancelled. The device was not linked.')),
				h('p', { class: 'ws-quiet' }, t('Linked devices are listed on your account page, where each can be removed.'), ' ', h('a', { href: '/workspace?s=account' }, t('Account'))),
			);
		} catch (err) {
			field.disabled = false;
			result.textContent = err instanceof Error ? err.message : String(err);
		}
	};
	approve.addEventListener('click', () => answer(true));
	deny.addEventListener('click', () => answer(false));

	const form = h(
		'div',
		{ class: 'link-form' },
		h('label', { class: 'link-code' }, t('The code the app shows'), field),
		asking,
		h('div', { class: 'link-actions' }, approve, deny),
		result,
	);
	page.append(h('p', null, t('Signed in as {name}.', { name: me.name })), form);
	if (shown) check();
	return page;
}
