// @ts-check
/**
 * Sign-in with Google or GitHub (OAuth 2.0, authorization code with PKCE),
 * and with Apple when it is configured and switched on (worker/lib/apple.js:
 * no PKCE, and its callback arrives as a form POST, turned into the GET).
 *
 *   GET  /api/auth/{provider}/start?return=/path   → the provider's sign-in page
 *   GET  /api/auth/{provider}/callback             ← back from the provider
 *   POST /api/auth/apple/callback                  ← Apple's form, answered with a 303 to the GET
 *   POST /api/auth/signout
 *   GET  /api/me                                   the member signed in, or null
 *
 * Start keeps a random state and PKCE verifier in a short-lived cookie; the
 * callback must bring the same state back, so a sign-in cannot be started by
 * another site. Start and callback are page navigations: their failures go
 * back to /workspace?s=account&error=… for the app to explain, never to a
 * JSON page.
 *
 * Who the member is:
 *   1. the provider account was seen before: its member;
 *   2. signed in already: the provider account is linked to that member;
 *   3. the provider says the email is verified and a member has it: linked to
 *      that member, so one person keeps one account across providers;
 *   4. otherwise a new member.
 * Only verified emails are stored or matched; an unverified address could
 * belong to someone else.
 */
import { AppError } from '../../shared/errors.js';
import { APPLE, appleClientSecret, appleMissing, appleProfile } from '../lib/apple.js';
import { json } from '../lib/http.js';
import { getSetting } from '../lib/settings.js';
import { base64url, currentMember, endSession, randomToken, readCookie, setCookie, sha256, startSession } from '../lib/session.js';
import { isSupporter } from './support.js';

/**
 * @typedef {object} AuthEnv
 * @property {D1Database} APP
 * @property {string} [GITHUB_CLIENT_ID]
 * @property {string} [GITHUB_CLIENT_SECRET]
 * @property {string} [GOOGLE_CLIENT_ID]
 * @property {string} [GOOGLE_CLIENT_SECRET]
 * @property {string} [APPLE_SIGNIN_SERVICE_ID]
 * @property {string} [APPLE_SIGNIN_KEY_ID]
 * @property {string} [APPLE_TEAM_ID]
 * @property {string} [APPLE_SIGNIN_KEY]
 */

/**
 * @typedef {object} Profile  A provider account as it signs in.
 * @property {string} id      The provider's own user id.
 * @property {string} name
 * @property {string | null} email  Lower case, and only when the provider has verified it.
 * @property {string | null} avatar
 */

const STATE_COOKIE = '__Host-mo_oauth';
const STATE_SECONDS = 600;
const USER_AGENT = 'MyOrdbok';

const PROVIDERS = /** @type {const} */ ({
	github: {
		label: 'GitHub',
		authorize: 'https://github.com/login/oauth/authorize',
		token: 'https://github.com/login/oauth/access_token',
		scope: 'read:user user:email',
		id: 'GITHUB_CLIENT_ID',
		secret: 'GITHUB_CLIENT_SECRET',
		extra: {},
	},
	google: {
		label: 'Google',
		authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
		token: 'https://oauth2.googleapis.com/token',
		scope: 'openid email profile',
		id: 'GOOGLE_CLIENT_ID',
		secret: 'GOOGLE_CLIENT_SECRET',
		extra: { prompt: 'select_account' },
	},
});

/** @typedef {keyof typeof PROVIDERS | 'apple'} Provider */

/**
 * The providers this site offers now, for the sign-in buttons (GET /api/site):
 * Google and GitHub when configured; Apple when configured and its setting
 * (signin.apple) is not off.
 * @param {AuthEnv} env
 * @returns {Promise<Provider[]>}
 */
export async function providersOffered(env) {
	/** @type {Provider[]} */
	const list = [];
	for (const p of /** @type {Array<keyof typeof PROVIDERS>} */ (Object.keys(PROVIDERS))) if (env[PROVIDERS[p].id] && env[PROVIDERS[p].secret]) list.push(p);
	if (!appleMissing(env) && (await getSetting(env, 'signin.apple')) !== 'off') list.push('apple');
	return list;
}

/** A failure the account page explains; `code` goes into the address. */
class SignInError extends Error {
	/**
	 * @param {string} code
	 * @param {string} detail  For the log only.
	 * @param {string} [missing]  The setting's name (never its value), shown on the page.
	 */
	constructor(code, detail, missing) {
		super(detail);
		this.code = code;
		this.missing = missing;
	}
}

/**
 * @param {Request} request
 * @param {AuthEnv} env
 * @param {string[]} parts  Path parts after /api/.
 */
export async function auth(request, env, parts) {
	const [, which, action] = parts;
	if (which === 'signout' && parts.length === 2) return signOut(request, env);
	if ((!Object.hasOwn(PROVIDERS, which) && which !== 'apple') || (action !== 'start' && action !== 'callback') || parts.length !== 3) {
		throw new AppError('not_found', `No API route for ${new URL(request.url).pathname}`);
	}
	if (which === 'apple' && action === 'callback' && request.method === 'POST') return appleForm(request);
	if (request.method !== 'GET') throw new AppError('bad_request', `${action} is a GET`);
	const provider = /** @type {Provider} */ (which);
	try {
		if (provider === 'apple') await appleOpen(env);
		return action === 'start' ? await start(request, env, provider) : await callback(request, env, provider);
	} catch (err) {
		if (!(err instanceof SignInError)) throw err;
		console.warn(JSON.stringify({ event: 'signin_failed', provider, code: err.code, detail: err.message }));
		const missing = err.missing ? `&missing=${err.missing}` : '';
		return redirect(`/workspace?s=account&error=${err.code}${missing}`, [setCookie(STATE_COOKIE, '', 0)]);
	}
}

/**
 * GET /api/me
 * @param {Request} request
 * @param {AuthEnv} env
 */
export async function me(request, env) {
	const member = await currentMember(request, env);
	if (!member) return json({ member: null }, { headers: { 'cache-control': 'no-store' } });
	const { results } = await env.APP.prepare('SELECT provider FROM identities WHERE user_id = ?1 ORDER BY created_at').bind(member.id).all();
	return json({ member: { ...member, providers: results.map((r) => String(r.provider)), supporter: await isSupporter(env, member.id) } }, { headers: { 'cache-control': 'no-store' } });
}

/**
 * @param {Request} request
 * @param {AuthEnv} env
 * @param {Provider} provider
 */
async function start(request, env, provider) {
	const url = new URL(request.url);
	const state = randomToken();
	const verifier = randomToken(48);
	const back = safeReturn(url.searchParams.get('return'));
	const saved = base64url(new TextEncoder().encode(JSON.stringify({ state, verifier, provider, back })));
	if (provider === 'apple') {
		const target = new URL(APPLE.authorize);
		for (const [key, value] of Object.entries({
			client_id: /** @type {string} */ (env.APPLE_SIGNIN_SERVICE_ID),
			redirect_uri: callbackUrl(url, provider),
			response_type: 'code',
			response_mode: 'form_post',
			scope: 'name email',
			state,
		})) {
			target.searchParams.set(key, value);
		}
		return redirect(target.href, [setCookie(STATE_COOKIE, saved, STATE_SECONDS)]);
	}
	const { clientId } = credentials(env, provider);
	const p = PROVIDERS[provider];
	const target = new URL(p.authorize);
	for (const [key, value] of Object.entries({
		client_id: clientId,
		redirect_uri: callbackUrl(url, provider),
		response_type: 'code',
		scope: p.scope,
		state,
		code_challenge: base64url(await sha256(verifier)),
		code_challenge_method: 'S256',
		...p.extra,
	})) {
		target.searchParams.set(key, value);
	}
	return redirect(target.href, [setCookie(STATE_COOKIE, saved, STATE_SECONDS)]);
}

/**
 * @param {Request} request
 * @param {AuthEnv} env
 * @param {Provider} provider
 */
async function callback(request, env, provider) {
	const url = new URL(request.url);
	const saved = readState(request);
	if (url.searchParams.get('error')) throw new SignInError('cancelled', `provider said ${url.searchParams.get('error')}`);
	if (!saved || saved.provider !== provider || saved.state !== url.searchParams.get('state')) {
		throw new SignInError('expired', 'state missing or different');
	}
	const code = url.searchParams.get('code');
	if (!code) throw new SignInError('provider', 'no code');

	const profile =
		provider === 'apple'
			? await appleSignIn(env, code, callbackUrl(url, provider), url.searchParams.get('user'))
			: await profileOf(provider, await exchange(env, provider, code, callbackUrl(url, provider), saved.verifier));
	const signedIn = await currentMember(request, env);
	const fresh = provider === 'apple' && (await getSetting(env, 'signin.apple')) === 'existing' ? false : true;
	const userId = await memberFor(env, provider, profile, signedIn?.id ?? null, fresh);
	const session = await startSession(env, userId);
	return redirect(saved.back, [session, setCookie(STATE_COOKIE, '', 0)]);
}

/**
 * POST /api/auth/signout. Only the site's own pages may sign a member out.
 * @param {Request} request
 * @param {AuthEnv} env
 */
async function signOut(request, env) {
	if (request.method !== 'POST') throw new AppError('bad_request', 'Sign out with POST');
	if (request.headers.get('origin') !== new URL(request.url).origin) throw new AppError('forbidden', 'Access denied.');
	const cookie = await endSession(request, env);
	return json({ ok: true }, { headers: { 'set-cookie': cookie, 'cache-control': 'no-store' } });
}

/**
 * The member a provider account belongs to, linking or creating as the top
 * of this file describes.
 * @param {AuthEnv} env
 * @param {Provider} provider
 * @param {Profile} profile
 * @param {number | null} signedIn
 * @param {boolean} [fresh]  Whether a provider account not seen before may be
 *   taken in (linked or a new member); false for Apple on existing accounts only.
 * @returns {Promise<number>}
 */
export async function memberFor(env, provider, profile, signedIn, fresh = true) {
	const db = env.APP;
	const known = /** @type {{ user_id: number, status: string } | null} */ (
		await db.prepare('SELECT i.user_id, u.status FROM identities i JOIN users u ON u.id = i.user_id WHERE i.provider = ?1 AND i.provider_user_id = ?2').bind(provider, profile.id).first()
	);
	if (known) {
		if (signedIn !== null && known.user_id !== signedIn) throw new SignInError('linked_elsewhere', 'provider account belongs to another member');
		if (known.status !== 'active') throw new SignInError('suspended', `member ${known.user_id} is suspended`);
		await fillIn(db, known.user_id, profile);
		return known.user_id;
	}

	if (!fresh) throw new SignInError('apple_closed', `no new ${provider} accounts (signin.apple: existing)`);
	let userId = signedIn;
	if (userId === null && profile.email) {
		const byEmail = /** @type {{ id: number, status: string } | null} */ (await db.prepare('SELECT id, status FROM users WHERE email = ?1').bind(profile.email).first());
		if (byEmail) {
			if (byEmail.status !== 'active') throw new SignInError('suspended', `member ${byEmail.id} is suspended`);
			userId = byEmail.id;
		}
	}
	if (userId === null) {
		if ((await getSetting(env, 'signup.open')) !== 'on') throw new SignInError('signups_closed', 'new accounts are paused (signup.open)');
		const row = /** @type {{ id: number }} */ (
			await db.prepare('INSERT INTO users (name, email, avatar_url) VALUES (?1, ?2, ?3) RETURNING id').bind(profile.name, profile.email, profile.avatar).first()
		);
		userId = row.id;
	} else {
		await fillIn(db, userId, profile);
	}
	await db.prepare('INSERT INTO identities (provider, provider_user_id, user_id) VALUES (?1, ?2, ?3)').bind(provider, profile.id, userId).run();
	return userId;
}

/**
 * Fills what a member is missing (email, avatar) from a provider account;
 * never overwrites. An email another member has is left out.
 * @param {D1Database} db
 * @param {number} userId
 * @param {Profile} profile
 */
async function fillIn(db, userId, profile) {
	await db
		.prepare(
			`UPDATE users SET
				avatar_url = coalesce(avatar_url, ?2),
				email = coalesce(email, CASE WHEN ?3 IS NULL OR EXISTS (SELECT 1 FROM users WHERE email = ?3) THEN NULL ELSE ?3 END)
			 WHERE id = ?1`,
		)
		.bind(userId, profile.avatar, profile.email)
		.run();
}

/**
 * Apple's form POST (response_mode=form_post): the same fields as a GET to
 * the callback, which the browser makes as a top-level navigation carrying
 * this site's cookies (worker/lib/apple.js). Nothing else is done with it.
 * @param {Request} request
 */
async function appleForm(request) {
	const form = await request.formData().catch(() => null);
	if (!form) throw new AppError('bad_request', 'Apple’s callback is a form');
	const back = new URL('/api/auth/apple/callback', request.url);
	for (const key of ['code', 'state', 'user', 'error']) {
		const value = form.get(key);
		if (typeof value === 'string' && value) back.searchParams.set(key, value);
	}
	return new Response(null, { status: 303, headers: { location: back.href, 'cache-control': 'no-store' } });
}

/**
 * Apple is offered: configured, and its setting is not off.
 * @param {AuthEnv} env
 */
async function appleOpen(env) {
	const missing = appleMissing(env);
	if (missing) throw new SignInError('not_configured', `${missing} is not set on this site`, missing);
	if ((await getSetting(env, 'signin.apple')) === 'off') throw new SignInError('not_configured', 'signin.apple is off', 'signin.apple');
}

/**
 * The Apple account a code belongs to.
 * @param {AuthEnv} env
 * @param {string} code
 * @param {string} redirectUri
 * @param {string | null} user  The form's `user` field (first sign-in only).
 * @returns {Promise<Profile>}
 */
async function appleSignIn(env, code, redirectUri, user) {
	const clientId = /** @type {string} */ (env.APPLE_SIGNIN_SERVICE_ID);
	const res = await fetch(APPLE.token, {
		method: 'POST',
		headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded', 'user-agent': USER_AGENT },
		body: new URLSearchParams({ client_id: clientId, client_secret: await appleClientSecret(env), code, grant_type: 'authorization_code', redirect_uri: redirectUri }),
	});
	const body = /** @type {{ id_token?: string, error?: string, error_description?: string }} */ (await res.json().catch(() => ({})));
	if (!res.ok || !body.id_token) throw new SignInError('provider', `apple token exchange: ${res.status} ${body.error ?? ''} ${body.error_description ?? ''}`.trim());
	try {
		return appleProfile(body.id_token, clientId, user);
	} catch (err) {
		throw new SignInError('provider', `apple identity token: ${err instanceof Error ? err.message : String(err)}`);
	}
}

/**
 * @param {keyof typeof PROVIDERS} provider
 * @param {string} token
 */
function profileOf(provider, token) {
	return provider === 'github' ? githubProfile(token) : googleProfile(token);
}

/**
 * @param {AuthEnv} env
 * @param {keyof typeof PROVIDERS} provider
 */
function credentials(env, provider) {
	const p = PROVIDERS[provider];
	const clientId = env[p.id];
	const secret = env[p.secret];
	if (!clientId || !secret) {
		const name = !clientId ? p.id : p.secret;
		throw new SignInError('not_configured', `${name} is not set on this site`, name);
	}
	return { clientId, secret };
}

/**
 * @param {AuthEnv} env
 * @param {keyof typeof PROVIDERS} provider
 * @param {string} code
 * @param {string} redirectUri
 * @param {string} verifier
 */
async function exchange(env, provider, code, redirectUri, verifier) {
	const { clientId, secret } = credentials(env, provider);
	const res = await fetch(PROVIDERS[provider].token, {
		method: 'POST',
		headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded', 'user-agent': USER_AGENT },
		body: new URLSearchParams({ client_id: clientId, client_secret: secret, code, redirect_uri: redirectUri, code_verifier: verifier, grant_type: 'authorization_code' }),
	});
	const body = /** @type {{ access_token?: string, error?: string, error_description?: string }} */ (await res.json().catch(() => ({})));
	if (!res.ok || !body.access_token) throw new SignInError('provider', `token exchange: ${res.status} ${body.error ?? ''} ${body.error_description ?? ''}`.trim());
	return body.access_token;
}

/**
 * @param {string} url
 * @param {string} token
 */
async function getProvider(url, token) {
	const res = await fetch(url, { headers: { authorization: `Bearer ${token}`, accept: 'application/json', 'user-agent': USER_AGENT } });
	if (!res.ok) throw new SignInError('provider', `${url}: ${res.status}`);
	return res.json();
}

/**
 * @param {string} token
 * @returns {Promise<Profile>}
 */
async function githubProfile(token) {
	const user = /** @type {{ id: number, login: string, name: string | null, avatar_url: string | null }} */ (await getProvider('https://api.github.com/user', token));
	const emails = /** @type {Array<{ email: string, primary: boolean, verified: boolean }>} */ (await getProvider('https://api.github.com/user/emails', token));
	const email = emails.find((e) => e.primary && e.verified)?.email ?? null;
	return { id: String(user.id), name: user.name || user.login, email: email?.toLowerCase() ?? null, avatar: user.avatar_url };
}

/**
 * @param {string} token
 * @returns {Promise<Profile>}
 */
async function googleProfile(token) {
	const user = /** @type {{ sub: string, name?: string, email?: string, email_verified?: boolean, picture?: string }} */ (
		await getProvider('https://openidconnect.googleapis.com/v1/userinfo', token)
	);
	const email = user.email && user.email_verified === true ? user.email.toLowerCase() : null;
	return { id: user.sub, name: user.name || (email ? email.split('@')[0] : 'Member'), email, avatar: user.picture ?? null };
}

/**
 * @param {URL} url  This request.
 * @param {Provider} provider
 */
function callbackUrl(url, provider) {
	return `${url.origin}/api/auth/${provider}/callback`;
}

/**
 * Where to go after signing in: a path on this site only, never another
 * site or the API.
 * @param {string | null} value
 */
export function safeReturn(value) {
	if (!value || !/^\/(?!\/)[^\\\s]*$/.test(value) || value.startsWith('/api/')) return '/workspace';
	return value;
}

/** @param {Request} request */
function readState(request) {
	const raw = readCookie(request, STATE_COOKIE);
	if (!raw) return null;
	try {
		const text = atob(raw.replace(/-/g, '+').replace(/_/g, '/'));
		const bytes = Uint8Array.from(text, (c) => c.charCodeAt(0));
		return /** @type {{ state: string, verifier: string, provider: string, back: string }} */ (JSON.parse(new TextDecoder().decode(bytes)));
	} catch {
		return null;
	}
}

/**
 * @param {string} location
 * @param {string[]} cookies
 */
function redirect(location, cookies) {
	const headers = new Headers({ location, 'cache-control': 'no-store' });
	for (const c of cookies) headers.append('set-cookie', c);
	return new Response(null, { status: 302, headers });
}
