import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { buildPacks, manifestOf } from '../scripts/packs.js';
import { search, sqliteDatabase } from '../shared/search/search.mjs';
import statements from '../shared/search/statements.js';
import { buildKey } from '../shared/packs.js';
import worker from '../worker/index.js';
import { MIGRATION, SAMPLE, d1, sqlite } from './helpers/d1.js';

const SITE = 'https://myordbok.test';
const hash = (t) => createHash('sha256').update(t).digest('hex');

/** The sample's packs, built once. */
const sample = sqlite(SAMPLE);
const built = await buildPacks(sample);
const manifest = manifestOf(built.built, built.files);
const lines = (id) => gunzipSync(/** @type {any} */ (built.files.find((f) => f.pack.id === id)).data).toString('utf8').trimEnd().split('\n');

/** An R2 bucket in memory, holding the sample's packs. */
function bucket() {
	const store = new Map(built.files.map(({ pack, data }) => [`${buildKey(built.built)}/${pack.file}`, data]));
	store.set(`${buildKey(built.built)}/manifest.json`, Buffer.from(JSON.stringify(manifest)));
	return {
		async get(key) {
			const data = store.get(key);
			return data ? { body: new Blob([data]).stream(), size: data.length, json: async () => JSON.parse(data.toString('utf8')) } : null;
		},
	};
}

function env() {
	const app = sqlite(MIGRATION);
	app.exec(`INSERT INTO users (id, name, email, role) VALUES (1, 'Mya', 'm@example.com', 'member'), (2, 'Ad', 'a@example.com', 'admin');
		INSERT INTO sessions (id_hash, user_id, expires_at) VALUES ('${hash('member')}', 1, unixepoch() + 3600), ('${hash('admin')}', 2, unixepoch() + 3600);`);
	return { raw: app, APP: d1(app), DATASET: d1(sqlite()), DICTIONARY: d1(sqlite(SAMPLE)), PACKS: bucket(), ASSETS: { fetch: () => new Response('') }, DICT_DB: 'dictionary' };
}

async function get(e, path, who) {
	const headers = { origin: SITE };
	if (who) headers.cookie = `__Host-mo_session=${who}`;
	return worker.fetch(new Request(`${SITE}${path}`, { headers }), e);
}

test('packs: each word’s answer is the online lookup’s, split into senses and related words', async () => {
	assert.deepEqual(manifest.packs.map((p) => p.id), ['words-en', 'words-my', 'senses-en', 'senses-my', 'related-en']);
	assert.ok(lines('words-en').includes('love'));
	const senses = new Map(lines('senses-en').map((l) => JSON.parse(l)));
	const related = new Map(lines('related-en').map((l) => JSON.parse(l)));
	const online = /** @type {any} */ (await search(sqliteDatabase(sample), statements, 'love'));
	const { query, language, ...answer } = online;
	assert.deepEqual({ ...senses.get('love'), ...related.get('love') }, answer);
	// A form of a word is a key too, answered with its root (went → go).
	const form = [...senses].find(([, a]) => !a.entries.length && a.forms_of.length);
	assert.ok(form, 'the sample has a form of another word');
	const my = new Map(lines('senses-my').map((l) => JSON.parse(l)));
	assert.ok(my.size > 0 && [...my.values()].every((a) => a.entries.length));
	for (const p of manifest.packs) assert.equal(p.rows, lines(p.id).length);
});

test('GET /api/packs: word lists for everyone; definitions for members until an admin opens them', async () => {
	const e = env();
	const open = await (await get(e, '/api/packs')).json();
	assert.equal(open.build, built.built);
	assert.equal(open.access, 'members');
	assert.deepEqual(open.packs.map((p) => [p.id, p.allowed]), [['words-en', true], ['words-my', true], ['senses-en', false], ['senses-my', false], ['related-en', false]]);

	const words = await get(e, '/api/packs/words-en');
	assert.equal(words.status, 200);
	assert.equal(words.headers.get('content-type'), 'application/gzip');
	assert.deepEqual(gunzipSync(Buffer.from(await words.arrayBuffer())).toString('utf8').trimEnd().split('\n'), lines('words-en'));
	assert.equal((await get(e, '/api/packs/senses-en')).status, 401);
	assert.equal((await get(e, '/api/packs/senses-en', 'member')).status, 200);
	assert.equal((await get(e, '/api/packs/nothing')).status, 404);

	// The admin opens the definitions to everyone.
	assert.equal((await worker.fetch(new Request(`${SITE}/api/workspace/settings`, { method: 'POST', headers: { origin: SITE, cookie: `__Host-mo_session=member`, 'content-type': 'application/json' }, body: JSON.stringify({ key: 'offline.access', value: 'everyone' }) }), e)).status, 403);
	const set = await worker.fetch(new Request(`${SITE}/api/workspace/settings`, { method: 'POST', headers: { origin: SITE, cookie: `__Host-mo_session=admin`, 'content-type': 'application/json' }, body: JSON.stringify({ key: 'offline.access', value: 'everyone' }) }), e);
	assert.equal(set.status, 200);
	assert.equal((await set.json()).settings.find((s) => s.key === 'offline.access').value, 'everyone');
	assert.equal((await get(e, '/api/packs/senses-en')).status, 200);
	const bad = await worker.fetch(new Request(`${SITE}/api/workspace/settings`, { method: 'POST', headers: { origin: SITE, cookie: `__Host-mo_session=admin`, 'content-type': 'application/json' }, body: JSON.stringify({ key: 'offline.access', value: 'nobody' }) }), e);
	assert.equal(bad.status, 400);
});

test('GET /api/packs without packs for the build says so', async () => {
	const e = { ...env(), PACKS: { get: async () => null } };
	const res = await get(e, '/api/packs');
	assert.equal(res.status, 404);
	assert.match((await res.json()).error.message, /No offline packs for build/);
});
