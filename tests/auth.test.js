import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import worker from '../worker/index.js';
import { safeReturn } from '../worker/routes/auth.js';
import { MIGRATION, d1, sqlite } from './helpers/d1.js';

const SITE = 'https://beta.myordbok.test';
const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
});

function env(extra = {}) {
	const app = sqlite(MIGRATION);
	return {
		raw: app,
		APP: d1(app),
		ASSETS: { fetch: () => new Response('') },
		GITHUB_CLIENT_ID: 'gh-id',
		GITHUB_CLIENT_SECRET: 'gh-secret',
		GOOGLE_CLIENT_ID: 'g-id',
		GOOGLE_CLIENT_SECRET: 'g-secret',
		...extra,
	};
}

/** Google and GitHub as they answer, for one account each. */
function providers({ google = {}, github = {}, emails } = {}) {
	const calls = [];
	globalThis.fetch = async (url, init) => {
		const u = String(url);
		calls.push({ url: u, body: init?.body ? String(init.body) : null });
		const ok = (body) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
		if (u.startsWith('https://oauth2.googleapis.com/token') || u.startsWith('https://github.com/login/oauth/access_token')) return ok({ access_token: 'token' });
		if (u.startsWith('https://openidconnect.googleapis.com/v1/userinfo')) return ok({ sub: 'g-1', name: 'Khen', email: 'Khen@Example.com', email_verified: true, picture: 'https://g/p.png', ...google });
		if (u === 'https://api.github.com/user') return ok({ id: 42, login: 'khen', name: null, avatar_url: 'https://gh/a.png', ...github });
		if (u === 'https://api.github.com/user/emails') return ok(emails ?? [{ email: 'khen@example.com', primary: true, verified: true }]);
		throw new Error(`unexpected fetch ${u}`);
	};
	return calls;
}

/** A browser: keeps cookies, follows nothing. */
function browser(e) {
	const jar = new Map();
	return {
		jar,
		async get(path, headers = {}) {
			const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
			const res = await worker.fetch(new Request(`${SITE}${path}`, { headers: { cookie, ...headers } }), e);
			for (const c of res.headers.getSetCookie()) {
				const [pair, ...attrs] = c.split('; ');
				const [k, v] = pair.split('=');
				if (attrs.includes('Max-Age=0')) jar.delete(k);
				else jar.set(k, v);
			}
			return res;
		},
		async post(path, headers = {}) {
			const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
			const res = await worker.fetch(new Request(`${SITE}${path}`, { method: 'POST', headers: { cookie, ...headers } }), e);
			for (const c of res.headers.getSetCookie()) if (c.includes('Max-Age=0')) jar.delete(c.split('=')[0]);
			return res;
		},
		/** The whole round trip: start, the provider's answer, the callback. */
		async signIn(provider, back = '/definition?q=love') {
			const start = await this.get(`/api/auth/${provider}/start?return=${encodeURIComponent(back)}`);
			assert.equal(start.status, 302);
			const to = new URL(start.headers.get('location'));
			return this.get(`/api/auth/${provider}/callback?code=abc&state=${to.searchParams.get('state')}`);
		},
		async me() {
			return (await (await this.get('/api/me')).json()).member;
		},
	};
}

test('start: to the provider with state, PKCE and this site’s callback', async () => {
	const b = browser(env());
	const res = await b.get('/api/auth/google/start');
	const to = new URL(res.headers.get('location'));
	assert.equal(to.origin + to.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
	assert.equal(to.searchParams.get('client_id'), 'g-id');
	assert.equal(to.searchParams.get('redirect_uri'), `${SITE}/api/auth/google/callback`);
	assert.equal(to.searchParams.get('scope'), 'openid email profile');
	assert.equal(to.searchParams.get('code_challenge_method'), 'S256');
	assert.ok(to.searchParams.get('state').length >= 40);
	assert.match(res.headers.getSetCookie()[0], /^__Host-mo_oauth=.+; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=600$/);
});

test('sign in, me, sign out', async () => {
	const e = env();
	const calls = providers();
	const b = browser(e);
	const back = await b.signIn('google');
	assert.equal(back.status, 302);
	assert.equal(back.headers.get('location'), '/definition?q=love');
	assert.ok(b.jar.has('__Host-mo_session'));
	assert.ok(!b.jar.has('__Host-mo_oauth'), 'state cookie cleared');
	assert.match(calls.find((c) => c.url.includes('oauth2.googleapis.com')).body, /code_verifier=/);

	const member = await b.me();
	assert.deepEqual({ ...member, id: undefined }, { id: undefined, name: 'Khen', email: 'khen@example.com', avatar_url: 'https://g/p.png', role: 'member', providers: ['google'] });
	const stored = e.raw.prepare('SELECT id_hash FROM sessions').get().id_hash;
	assert.notEqual(stored, b.jar.get('__Host-mo_session'), 'only the hash is stored');

	assert.equal((await b.post('/api/auth/signout', { origin: 'https://evil.test' })).status, 403);
	assert.equal((await b.post('/api/auth/signout', { origin: SITE })).status, 200);
	assert.equal(await b.me(), null);
	assert.equal(e.raw.prepare('SELECT count(*) AS n FROM sessions').get().n, 0);
});

test('the same verified email through the other provider is the same member', async () => {
	const e = env();
	providers();
	const first = browser(e);
	await first.signIn('google');
	const second = browser(e);
	await second.signIn('github');
	const a = await first.me();
	const b = await second.me();
	assert.equal(a.id, b.id);
	assert.deepEqual(b.providers, ['google', 'github']);
	assert.equal(e.raw.prepare('SELECT count(*) AS n FROM users').get().n, 1);
});

test('an unverified email is neither matched nor stored', async () => {
	const e = env();
	providers({ emails: [{ email: 'khen@example.com', primary: true, verified: false }] });
	const google = browser(e);
	await google.signIn('google');
	const github = browser(e);
	await github.signIn('github');
	const member = await github.me();
	assert.notEqual(member.id, (await google.me()).id);
	assert.equal(member.email, null);
	assert.equal(member.name, 'khen', 'the login when GitHub has no name');
});

test('signed in, a second provider is linked to the same member whatever its email', async () => {
	const e = env();
	providers({ emails: [{ email: 'other@example.com', primary: true, verified: true }] });
	const b = browser(e);
	await b.signIn('google');
	await b.signIn('github');
	const member = await b.me();
	assert.deepEqual(member.providers, ['google', 'github']);
	assert.equal(member.email, 'khen@example.com', 'the first email is kept');
});

test('a provider account of another member cannot be linked; suspended members cannot sign in', async () => {
	const e = env();
	providers({ google: { email: 'a@example.com' }, emails: [{ email: 'b@example.com', primary: true, verified: true }] });
	await browser(e).signIn('github');
	const b = browser(e);
	await b.signIn('google');
	assert.equal((await b.signIn('github')).headers.get('location'), '/account?error=linked_elsewhere');

	e.raw.prepare("UPDATE users SET status = 'suspended'").run();
	assert.equal(await b.me(), null, 'the session stops working');
	assert.equal((await browser(e).signIn('google')).headers.get('location'), '/account?error=suspended');
});

test('failures go back to the account page with a reason', async () => {
	const warn = console.warn;
	console.warn = () => {};
	try {
		providers();
		const e = env();
		const b = browser(e);
		await b.get('/api/auth/google/start');
		assert.equal((await b.get('/api/auth/google/callback?code=abc&state=forged')).headers.get('location'), '/account?error=expired');
		assert.equal((await browser(e).get('/api/auth/google/callback?error=access_denied')).headers.get('location'), '/account?error=cancelled');
		assert.equal((await browser(env({ GITHUB_CLIENT_SECRET: '' })).get('/api/auth/github/start')).headers.get('location'), '/account?error=not_configured&missing=GITHUB_CLIENT_SECRET');
		globalThis.fetch = async () => new Response(JSON.stringify({ error: 'bad_verification_code' }), { status: 400 });
		assert.equal((await browser(e).signIn('github')).headers.get('location'), '/account?error=provider');
		assert.equal((await browser(e).get('/api/auth/twitter/start')).status, 404);
	} finally {
		console.warn = warn;
	}
});

test('return path: this site only', () => {
	assert.equal(safeReturn('/definition?q=love'), '/definition?q=love');
	for (const bad of [null, '', 'https://evil.test', '//evil.test', '/\\evil.test', '/api/me', 'account']) assert.equal(safeReturn(bad), '/account', String(bad));
});
