import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appleClientSecret, appleMissing, appleProfile } from '../worker/lib/apple.js';
import { memberFor, providersOffered } from '../worker/routes/auth.js';
import worker from '../worker/index.js';
import { MIGRATION, d1, sqlite } from './helpers/d1.js';

const b64url = (/** @type {object} */ o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = (/** @type {object} */ claims) => `${b64url({ alg: 'RS256' })}.${b64url(claims)}.sig`;
const NOW = 2_000_000_000;
const claims = { iss: 'https://appleid.apple.com', aud: 'com.myordbok.web', exp: NOW + 600, sub: '000123.abc' };

/** A Sign in with Apple configuration with a key made for the test. */
async function configured() {
	const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
	const der = Buffer.from(await crypto.subtle.exportKey('pkcs8', pair.privateKey)).toString('base64');
	const pem = `-----BEGIN PRIVATE KEY-----\n${der.match(/.{1,64}/g)?.join('\n')}\n-----END PRIVATE KEY-----\n`;
	return { env: { APPLE_SIGNIN_SERVICE_ID: 'com.myordbok.web', APPLE_SIGNIN_KEY_ID: 'KEY1234567', APPLE_TEAM_ID: 'TEAM123456', APPLE_SIGNIN_KEY: pem }, publicKey: pair.publicKey };
}

test('apple: the client secret is an ES256 token Apple can check with the key', async () => {
	const { env, publicKey } = await configured();
	const jwt = await appleClientSecret(env, NOW);
	const [head, body, signature] = jwt.split('.');
	assert.deepEqual(JSON.parse(Buffer.from(head, 'base64url').toString()), { alg: 'ES256', kid: 'KEY1234567' });
	assert.deepEqual(JSON.parse(Buffer.from(body, 'base64url').toString()), { iss: 'TEAM123456', iat: NOW, exp: NOW + 300, aud: 'https://appleid.apple.com', sub: 'com.myordbok.web' });
	assert.ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, Buffer.from(signature, 'base64url'), new TextEncoder().encode(`${head}.${body}`)));
	assert.equal(appleMissing(env), null);
	assert.equal(appleMissing({ ...env, APPLE_SIGNIN_KEY: '' }), 'APPLE_SIGNIN_KEY');
});

test('apple: the identity token’s claims, the name once, and no relayed email', () => {
	const user = JSON.stringify({ name: { firstName: 'Mya', lastName: 'Win' } });
	assert.deepEqual(appleProfile(token({ ...claims, email: 'Mya@Example.com', email_verified: 'true' }), 'com.myordbok.web', user, NOW), { id: '000123.abc', name: 'Mya Win', email: 'mya@example.com', avatar: null });
	const hidden = appleProfile(token({ ...claims, email: 'x1@privaterelay.appleid.com', email_verified: true, is_private_email: 'true' }), 'com.myordbok.web', null, NOW);
	assert.deepEqual([hidden.email, hidden.name], [null, 'Member'], 'Hide My Email: neither stored nor matched');
	assert.equal(appleProfile(token({ ...claims, email: 'a@b.c', email_verified: 'false' }), 'com.myordbok.web', null, NOW).email, null, 'unverified');
	assert.throws(() => appleProfile(token({ ...claims, aud: 'other' }), 'com.myordbok.web', null, NOW), /audience/);
	assert.throws(() => appleProfile(token({ ...claims, iss: 'https://evil' }), 'com.myordbok.web', null, NOW), /issuer/);
	assert.throws(() => appleProfile(token({ ...claims, exp: NOW - 1 }), 'com.myordbok.web', null, NOW), /expired/);
	assert.equal(appleProfile(token(claims), 'com.myordbok.web', '{bad json', NOW).name, 'Member', 'a malformed name does not stop the sign-in');
});

test('apple: offered only when configured and not off; existing accounts only takes no new ones', async () => {
	const { env: apple } = await configured();
	const raw = sqlite(MIGRATION);
	const e = { APP: d1(raw), GOOGLE_CLIENT_ID: 'g', GOOGLE_CLIENT_SECRET: 's', ...apple };
	const put = (/** @type {string} */ value) => raw.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('signin.apple', ?1)").run(JSON.stringify(value));
	assert.deepEqual(await providersOffered(e), ['google', 'apple']);
	assert.deepEqual(await providersOffered({ ...e, APPLE_SIGNIN_KEY: undefined }), ['google'], 'not configured');
	put('off');
	assert.deepEqual(await providersOffered(e), ['google']);
	put('existing');
	assert.deepEqual(await providersOffered(e), ['google', 'apple'], 'still offered, for members who use it');

	const first = await memberFor(e, 'apple', { id: 'a-1', name: 'Mya', email: null, avatar: null }, null);
	assert.equal(await memberFor(e, 'apple', { id: 'a-1', name: 'Mya', email: null, avatar: null }, null, false), first, 'a known Apple account still signs in');
	await assert.rejects(memberFor(e, 'apple', { id: 'a-2', name: 'New', email: null, avatar: null }, null, false), /no new apple accounts/);
	await assert.rejects(memberFor(e, 'apple', { id: 'a-3', name: 'Link', email: null, avatar: null }, first, false), /no new apple accounts/, 'nor a new link');
});

test('apple: its form POST becomes the GET callback, which does the rest', async () => {
	const app = { APP: d1(sqlite(MIGRATION)), ASSETS: { fetch: async () => new Response('asset') } };
	const form = new URLSearchParams({ code: 'c1', state: 's1', user: '{"name":{"firstName":"Mya"}}' });
	const res = await worker.fetch(new Request('https://myordbok.test/api/auth/apple/callback', { method: 'POST', headers: { origin: 'https://appleid.apple.com', 'content-type': 'application/x-www-form-urlencoded' }, body: form }), app);
	assert.equal(res.status, 303);
	const to = new URL(res.headers.get('location') ?? '');
	assert.deepEqual([to.pathname, to.searchParams.get('code'), to.searchParams.get('state'), to.searchParams.get('user')], ['/api/auth/apple/callback', 'c1', 's1', '{"name":{"firstName":"Mya"}}']);
	const other = await worker.fetch(new Request('https://myordbok.test/api/auth/google/callback', { method: 'POST', headers: { origin: 'https://appleid.apple.com' } }), app);
	assert.equal(other.status, 400, 'only Apple’s callback takes a post');
	const start = await worker.fetch(new Request('https://myordbok.test/api/auth/apple/start'), app);
	assert.match(start.headers.get('location') ?? '', /error=not_configured&missing=APPLE_SIGNIN_SERVICE_ID/, 'not configured: explained on the account page');
});

test('apple: start asks Apple for name and email by form post', async () => {
	const { env: apple } = await configured();
	const app = { APP: d1(sqlite(MIGRATION)), ASSETS: { fetch: async () => new Response('asset') }, ...apple };
	const res = await worker.fetch(new Request('https://myordbok.test/api/auth/apple/start?return=/practice'), app);
	const to = new URL(res.headers.get('location') ?? '');
	assert.equal(to.origin + to.pathname, 'https://appleid.apple.com/auth/authorize');
	assert.deepEqual(
		['client_id', 'redirect_uri', 'response_type', 'response_mode', 'scope'].map((k) => to.searchParams.get(k)),
		['com.myordbok.web', 'https://myordbok.test/api/auth/apple/callback', 'code', 'form_post', 'name email'],
	);
	assert.match(res.headers.get('set-cookie') ?? '', /__Host-mo_oauth=.+SameSite=Lax/);
});
