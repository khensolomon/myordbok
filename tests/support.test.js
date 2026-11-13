import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import worker from '../worker/index.js';
import { centsOf } from '../worker/routes/support.js';
import { MIGRATION, SAMPLE, d1, sqlite } from './helpers/d1.js';

const SITE = 'https://myordbok.test';
const hash = (t) => createHash('sha256').update(t).digest('hex');

function env() {
	const app = sqlite(MIGRATION);
	app.exec(`INSERT INTO users (id, name, email, role, avatar_url) VALUES (1, 'Owner', 'o@example.com', 'owner', NULL), (2, 'Ad', 'a@example.com', 'admin', NULL), (3, 'Mya', 'm@example.com', 'member', 'https://g/m.png');
		INSERT INTO sessions (id_hash, user_id, expires_at) VALUES ('${hash('owner')}', 1, unixepoch() + 3600), ('${hash('admin')}', 2, unixepoch() + 3600), ('${hash('member')}', 3, unixepoch() + 3600);`);
	return { raw: app, APP: d1(app), DATASET: d1(sqlite()), DICTIONARY: d1(sqlite(SAMPLE)), ASSETS: { fetch: async () => new Response('') }, DICT_DB: 'dictionary' };
}

async function call(e, path, { who, body } = {}) {
	const headers = { origin: SITE, 'content-type': 'application/json' };
	if (who) headers.cookie = `__Host-mo_session=${who}`;
	const res = await worker.fetch(new Request(`${SITE}${path}`, body === undefined ? { headers } : { method: 'POST', headers, body: JSON.stringify(body) }), e);
	return { status: res.status, cache: res.headers.get('cache-control'), body: await res.json() };
}

test('amounts: dollars as typed, in cents, nothing else', () => {
	assert.equal(centsOf('25'), 2500);
	assert.equal(centsOf('6.85'), 685);
	assert.equal(centsOf('6.8'), 680);
	assert.equal(centsOf(979.4), 97940);
	for (const bad of ['', '0', '-5', '1.234', '1,000', 'ten', '100000.01']) assert.throws(() => centsOf(bad), /amount/, bad);
});

test('sponsors: only the owner keeps them', async () => {
	const e = env();
	assert.equal((await call(e, '/api/workspace/sponsors')).status, 401);
	assert.equal((await call(e, '/api/workspace/sponsors', { who: 'admin' })).status, 403);
	assert.equal((await call(e, '/api/workspace/sponsors', { who: 'member' })).status, 403);
	assert.deepEqual((await call(e, '/api/workspace/sponsors', { who: 'owner' })).body, { donors: [], totals: { count: 0, cents: 0, since: null } });
});

test('sponsors: donors and donations; the public page shows totals and consenting names only', async () => {
	const e = env();
	const owner = (path, body) => call(e, path, { who: 'owner', body });

	const shown = (await owner('/api/workspace/sponsors', { name: 'NaS', shown: true, member: '', note: 'asked to be listed' })).body.donor;
	const hidden = (await owner('/api/workspace/sponsors', { name: 'S. S.', shown: false, member: 'm@example.com', note: '' })).body.donor;
	assert.equal(hidden.user_id, 3, 'linked by sign-in email; only the id is kept');
	assert.equal(hidden.member, 'Mya');
	assert.equal(e.raw.prepare('SELECT count(*) AS n FROM donors WHERE note LIKE ?').get('%@%').n, 0);

	await owner(`/api/workspace/sponsors/${shown.id}/donations`, { day: '2025-09-28', amount: '979.40', method: 'paypal', recurring: false });
	await owner(`/api/workspace/sponsors/${hidden.id}/donations`, { day: '2024-12-26', amount: '6.85', method: 'paypal', recurring: true });
	const detail = (await owner(`/api/workspace/sponsors/${hidden.id}/donations`, { day: '2025-03-08', amount: '6.85', method: 'paypal', recurring: true })).body;
	assert.deepEqual(detail.donations.map((d) => [d.day, d.cents]), [['2025-03-08', 685], ['2024-12-26', 685]]);
	assert.equal(detail.donor.cents, 1370);

	// Checks: a day in the future, a bad method, a member linked twice, an unknown member.
	assert.equal((await owner(`/api/workspace/sponsors/${shown.id}/donations`, { day: '2999-01-01', amount: '5', method: 'paypal', recurring: false })).status, 400);
	assert.equal((await owner(`/api/workspace/sponsors/${shown.id}/donations`, { day: '2025-02-30', amount: '5', method: 'paypal', recurring: false })).status, 400);
	assert.equal((await owner(`/api/workspace/sponsors/${shown.id}/donations`, { day: '2025-01-01', amount: '5', method: 'gold', recurring: false })).status, 400);
	assert.equal((await owner(`/api/workspace/sponsors/${shown.id}`, { name: 'NaS', shown: true, member: '3', note: '' })).status, 409);
	assert.equal((await owner(`/api/workspace/sponsors/${shown.id}`, { name: 'NaS', shown: true, member: 'nobody@example.com', note: '' })).status, 400);
	// A donor who gave cannot be deleted; their donations first.
	assert.equal((await owner(`/api/workspace/sponsors/${shown.id}/delete`, {})).status, 409);

	const page = await call(e, '/api/support');
	assert.match(page.cache, /public, max-age=600/);
	assert.deepEqual(page.body, {
		count: 3,
		cents: 97940 + 1370,
		since: '2024',
		years: [
			{ year: '2025', names: [{ name: 'NaS', avatar_url: null }], anonymous: 1 },
			{ year: '2024', names: [], anonymous: 1 },
		],
	});
	assert.ok(!JSON.stringify(page.body).includes('S. S.'), 'an anonymous name never leaves the workspace');
	assert.ok(!JSON.stringify(page.body).includes('asked to be listed'), 'notes never leave the workspace');

	// The linked member is a supporter: never asked.
	assert.equal((await call(e, '/api/me', { who: 'member' })).body.member.supporter, true);
	assert.equal((await call(e, '/api/me', { who: 'admin' })).body.member.supporter, false);

	// Removing donations, then the donor.
	const list = (await owner(`/api/workspace/sponsors/${shown.id}`)).body.donations;
	await owner(`/api/workspace/donations/${list[0].id}/delete`, {});
	assert.equal((await owner(`/api/workspace/sponsors/${shown.id}/delete`, {})).status, 200);
	assert.equal((await call(e, '/api/support')).body.count, 2);
});

test('support.ask: the switch pages follow', async () => {
	const e = env();
	assert.equal((await call(e, '/api/site')).body.support_ask, true);
	assert.equal((await call(e, '/api/workspace/settings', { who: 'owner', body: { key: 'support.ask', value: 'off' } })).status, 200);
	assert.equal((await call(e, '/api/site')).body.support_ask, false);
});

test('support.lines: the lines of the home invitation, checked before they are kept', async () => {
	const e = env();
	const set = (value) => call(e, '/api/workspace/settings', { who: 'owner', body: { key: 'support.lines', value } });
	assert.equal((await set([{ en: 'Readers keep it free.', my: 'စာဖတ်သူများ' }, { en: 'Thank you.' }])).status, 200);
	assert.deepEqual((await call(e, '/api/site')).body.support_lines, [{ en: 'Readers keep it free.', my: 'စာဖတ်သူများ' }, { en: 'Thank you.' }]);
	for (const bad of [[], [{ en: '' }], [{ my: 'only Myanmar' }], [{ en: 'x'.repeat(141) }], [{ en: 'ok', extra: 1 }], Array.from({ length: 13 }, () => ({ en: 'a' })), 'one line']) {
		assert.equal((await set(bad)).status, 400, JSON.stringify(bad).slice(0, 40));
	}
	assert.equal((await call(e, '/api/workspace/settings', { who: 'member', body: { key: 'support.lines', value: [{ en: 'x' }] } })).status, 403);
});
