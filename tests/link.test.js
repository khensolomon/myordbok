import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import worker from '../worker/index.js';
import { newUserCode, userCode } from '../worker/routes/link.js';
import { MIGRATION, d1, sqlite } from './helpers/d1.js';

const SITE = 'https://myordbok.test';
const APP = 'ios/26.11.22+170';

function env() {
	const raw = sqlite(MIGRATION);
	const hash = (/** @type {string} */ t) => createHash('sha256').update(t).digest('hex');
	raw.exec(`INSERT INTO users (id, name, email, role) VALUES (1, 'Mya', 'm@example.com', 'member'), (2, 'Other', 'o@example.com', 'member');
		INSERT INTO sessions (id_hash, user_id, expires_at) VALUES ('${hash('mya-token')}', 1, unixepoch() + 3600), ('${hash('other-token')}', 2, unixepoch() + 3600);`);
	return { raw, APP: d1(raw), ASSETS: { fetch: async () => new Response('') } };
}

/**
 * @param {object} e
 * @param {string} path
 * @param {{ app?: boolean, who?: string, bearer?: string, body?: unknown, origin?: string | null }} [o]
 */
async function call(e, path, o = {}) {
	/** @type {Record<string, string>} */
	const headers = { 'content-type': 'application/json' };
	if (o.origin !== null) headers.origin = o.origin ?? (o.app ? 'tauri://localhost' : SITE);
	if (o.app) headers['x-myordbok-app'] = APP;
	if (o.who) headers.cookie = `__Host-mo_session=${o.who}-token`;
	if (o.bearer) headers.authorization = `Bearer ${o.bearer}`;
	const init = o.body === undefined ? { headers } : { method: 'POST', headers, body: JSON.stringify(o.body) };
	const res = await worker.fetch(new Request(`${SITE}${path}`, init), e);
	return { status: res.status, body: await res.json() };
}

test('link: codes are eight letters without look-alikes, typed any way', () => {
	for (let i = 0; i < 50; i++) assert.match(newUserCode(), /^[ACDEFGHJKMNPQRTUVWXY34679]{8}$/);
	assert.equal(userCode('acde-fghj'), 'ACDEFGHJ');
	assert.equal(userCode('ACDE FGHJ'), 'ACDEFGHJ');
	assert.throws(() => userCode('ABCD-EFGH'), /eight letters/, 'B is not used');
	assert.throws(() => userCode('ACD'), /eight letters/);
});

test('link: the app starts, the member approves on the website, the app gets a session once', async () => {
	const e = env();
	assert.equal((await call(e, '/api/link/start', { body: {} })).status, 403, 'only the app starts one');
	const started = (await call(e, '/api/link/start', { app: true, body: {} })).body;
	assert.match(started.user_code, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
	assert.equal(started.url, `${SITE}/link?code=${started.user_code}`);
	assert.deepEqual([started.expires_in, started.interval], [600, 4]);
	const poll = () => call(e, '/api/link/poll', { app: true, body: { device_code: started.device_code } });
	assert.deepEqual((await poll()).body, { status: 'pending' });

	const page = `/api/link/code/${started.user_code}`;
	assert.equal((await call(e, page)).status, 401, 'signed out');
	assert.equal((await call(e, page, { who: 'mya' })).body.device, 'ios');
	assert.equal((await call(e, page, { who: 'mya', body: { approve: true }, origin: 'https://evil.test' })).status, 403, 'another site cannot approve');
	assert.equal((await call(e, page, { app: true, bearer: 'x'.repeat(30), body: { approve: true } })).status, 403, 'nor the app itself');
	assert.equal((await call(e, page, { who: 'mya', body: { approve: 'yes' } })).status, 400);
	assert.deepEqual((await call(e, page, { who: 'mya', body: { approve: true } })).body, { ok: true, approved: true });
	assert.equal((await call(e, page, { who: 'other', body: { approve: true } })).status, 404, 'answered once');

	const done = (await poll()).body;
	assert.equal(done.status, 'approved');
	assert.deepEqual((await poll()).body, { status: 'expired' }, 'the token is handed over once');

	const me = await call(e, '/api/me', { app: true, bearer: done.token });
	assert.equal(me.body.member.name, 'Mya');
	const list = (await call(e, '/api/devices', { who: 'mya' })).body.devices;
	assert.deepEqual(list.map((/** @type {any} */ d) => d.device), ['ios']);
	assert.ok(list[0].expires_at - list[0].created_at >= 364 * 86400, 'kept a year');
	assert.deepEqual((await call(e, '/api/devices', { who: 'other' })).body.devices, [], 'only one’s own');
	assert.equal((await call(e, `/api/devices/${list[0].id}/remove`, { who: 'other', body: {} })).status, 404);
	assert.deepEqual((await call(e, `/api/devices/${list[0].id}/remove`, { who: 'mya', body: {} })).body, { ok: true });
	assert.equal((await call(e, '/api/me', { app: true, bearer: done.token })).body.member, null, 'removed: signed out');
});

test('link: a denied or expired code gives nothing; the app signs itself out', async () => {
	const e = env();
	const a = (await call(e, '/api/link/start', { app: true, body: {} })).body;
	await call(e, `/api/link/code/${a.user_code}`, { who: 'mya', body: { approve: false } });
	assert.deepEqual((await call(e, '/api/link/poll', { app: true, body: { device_code: a.device_code } })).body, { status: 'denied' });

	const b = (await call(e, '/api/link/start', { app: true, body: {} })).body;
	e.raw.exec('UPDATE device_links SET expires_at = unixepoch() - 1');
	assert.deepEqual((await call(e, '/api/link/poll', { app: true, body: { device_code: b.device_code } })).body, { status: 'expired' });
	assert.equal((await call(e, `/api/link/code/${b.user_code}`, { who: 'mya' })).status, 404);
	await call(e, '/api/link/start', { app: true, body: {} });
	assert.equal(e.raw.prepare('SELECT count(*) AS n FROM device_links').get()?.n, 1, 'expired codes are cleared');

	const c = (await call(e, '/api/link/start', { app: true, body: {} })).body;
	await call(e, `/api/link/code/${c.user_code}`, { who: 'mya', body: { approve: true } });
	const { token } = (await call(e, '/api/link/poll', { app: true, body: { device_code: c.device_code } })).body;
	assert.equal((await call(e, '/api/auth/signout', { app: true, bearer: token, body: {} })).status, 200);
	assert.equal((await call(e, '/api/me', { app: true, bearer: token })).body.member, null);
	assert.equal((await call(e, '/api/link/poll', { app: true, body: {} })).status, 400);
});
