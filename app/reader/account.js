// @ts-check
/**
 * /account: sign in with Google or GitHub, or, signed in, the account: who
 * it is, the providers linked to it, and signing out. Sign-in itself happens
 * on the provider's page; failures come back here as ?error=….
 */
import { h } from '../core/dom.js';
import { member, signInHref, signOut } from '../core/member.js';

/** @type {Record<string, string>} */
const ERRORS = {
	cancelled: 'Sign-in was cancelled.',
	expired: 'The sign-in took too long or was started in another tab. Please try again.',
	provider: 'The sign-in could not be completed. Please try again.',
	not_configured: 'Signing in with this provider is not available on this site yet.',
	suspended: 'This account is suspended.',
	linked_elsewhere: 'That account is already linked to another MyOrdbok account.',
};

/** @type {Record<'google' | 'github', string>} */
const LABEL = { google: 'Google', github: 'GitHub' };

export function title() {
	return 'Account';
}

/** @param {import('../core/routes.js').ViewContext} ctx */
export async function view(ctx) {
	const error = ctx.query.get('error');
	const back = safeBack(ctx.query.get('return'));
	const me = await member({ fresh: true });
	const missing = ctx.query.get('missing');
	const notice = error
		? h('p', { class: 'account-error', role: 'alert' }, ERRORS[error] ?? 'The sign-in could not be completed.', missing && /^[A-Z_]+$/.test(missing) ? ` (${missing} is not set.)` : null)
		: null;
	if (me && back !== '/account') {
		// Signed in already, or just now: straight back to where it started.
		ctx.replace(back);
		return h('div');
	}
	return me ? signedIn(me, notice, ctx) : signedOut(notice, back);
}

/**
 * A path on this site to come back to, never another site.
 * @param {string | null} value
 */
function safeBack(value) {
	return value && /^\/(?!\/)[^\\\s]*$/.test(value) && !value.startsWith('/api/') ? value : '/account';
}

/**
 * @param {HTMLElement | null} notice
 * @param {string} back
 */
function signedOut(notice, back) {
	return h(
		'article',
		{ class: 'page account' },
		h('h1', null, 'Sign in'),
		notice,
		h('p', { class: 'account-lead' }, 'Signing in lets you like entries, comment, and suggest corrections or new meanings. Reading and searching never need an account.'),
		h(
			'div',
			{ class: 'account-providers' },
			(/** @type {Array<'google' | 'github'>} */ (['google', 'github'])).map((p) => h('a', { class: 'account-provider', href: signInHref(p, back) }, `Continue with ${LABEL[p]}`)),
		),
		h(
			'p',
			{ class: 'account-quiet' },
			'Signing in with either provider using the same verified email leads to the same account. The ',
			h('a', { href: '/privacy' }, 'Privacy'),
			' page explains what is stored; the ',
			h('a', { href: '/terms' }, 'Terms of Use'),
			' apply to contributions.',
		),
	);
}

/**
 * @param {import('../core/member.js').Member} me
 * @param {HTMLElement | null} notice
 * @param {import('../core/routes.js').ViewContext} ctx
 */
function signedIn(me, notice, ctx) {
	const missing = (/** @type {Array<'google' | 'github'>} */ (['google', 'github'])).filter((p) => !me.providers.includes(p));
	const out = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'account-signout' }, 'Sign out'));
	out.addEventListener('click', async () => {
		out.disabled = true;
		try {
			await signOut();
			ctx.go('/');
		} catch (err) {
			out.disabled = false;
			out.after(h('p', { class: 'account-error', role: 'alert' }, err instanceof Error ? err.message : String(err)));
		}
	});
	return h(
		'article',
		{ class: 'page account' },
		h(
			'header',
			{ class: 'account-head' },
			me.avatar_url ? h('img', { class: 'account-avatar', src: me.avatar_url, alt: '', width: 64, height: 64, referrerpolicy: 'no-referrer' }) : null,
			h('div', null, h('h1', null, me.name), me.email ? h('p', { class: 'account-email' }, me.email) : null),
		),
		notice,
		h(
			'dl',
			{ class: 'account-facts' },
			h('dt', null, 'Signs in with'),
			h('dd', null, me.providers.map((p) => LABEL[p]).join(' and ')),
			h('dt', null, 'Role'),
			h('dd', null, me.role === 'admin' ? 'Administrator' : me.role === 'editor' ? 'Editor' : 'Member'),
		),
		h('p', null, h('a', { href: '/studio' }, me.role === 'member' ? 'Your suggestions in the studio →' : 'Open the studio →')),
		missing.length
			? h('p', { class: 'account-quiet' }, 'Also sign in with ', missing.flatMap((p, i) => [i ? ' or ' : '', h('a', { href: signInHref(p) }, LABEL[p])]), ': it is linked to this account.')
			: null,
		out,
	);
}
