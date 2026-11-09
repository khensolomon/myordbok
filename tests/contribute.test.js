import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import worker from '../worker/index.js';
import { MIGRATION, SAMPLE, d1, sqlite } from './helpers/d1.js';

const SITE = 'https://myordbok.test';

function env() {
	const app = sqlite(MIGRATION);
	const hash = (t) => createHash('sha256').update(t).digest('hex');
	app.exec(`INSERT INTO users (id, name, email, role) VALUES (1, 'Member', 'm@example.com', 'member'), (2, 'Editor', 'e@example.com', 'editor');
		INSERT INTO sessions (id_hash, user_id, expires_at) VALUES ('${hash('member-token')}', 1, unixepoch() + 3600), ('${hash('editor-token')}', 2, unixepoch() + 3600);`);
	return { raw: app, APP: d1(app), DATASET: d1(sqlite()), DICTIONARY: d1(sqlite(SAMPLE)), ASSETS: { fetch: () => new Response('') }, DICT_DB: 'dictionary' };
}

/**
 * @param {object} e
 * @param {string} path
 * @param {{ who?: 'member' | 'editor', body?: unknown, origin?: string }} [o]
 */
async function call(e, path, o = {}) {
	const headers = { origin: o.origin ?? SITE, 'content-type': 'application/json' };
	if (o.who) headers.cookie = `__Host-mo_session=${o.who}-token`;
	const init = o.body === undefined ? { headers } : { method: 'POST', headers, body: JSON.stringify(o.body) };
	const res = await worker.fetch(new Request(`${SITE}${path}`, init), e);
	return { status: res.status, body: await res.json() };
}

test('reactions: counts for anyone; like, change, take back when signed in', async () => {
	const e = env();
	const get = () => call(e, '/api/reactions?lang=en&word=love', { who: 'member' });
	assert.deepEqual((await call(e, '/api/reactions?lang=en&word=love')).body, { lang: 'en', word: 'love', likes: 0, dislikes: 0, mine: 0, signedIn: false });
	assert.equal((await call(e, '/api/reactions', { body: { lang: 'en', word: 'love', value: 1 } })).status, 401, 'signed out');
	assert.equal((await call(e, '/api/reactions', { who: 'member', body: { lang: 'en', word: 'love', value: 1 } })).body.likes, 1);
	await call(e, '/api/reactions', { who: 'editor', body: { lang: 'en', word: 'love', value: 1 } });
	await call(e, '/api/reactions', { who: 'member', body: { lang: 'en', word: 'love', value: -1 } });
	assert.deepEqual((await get()).body, { lang: 'en', word: 'love', likes: 1, dislikes: 1, mine: -1, signedIn: true });
	await call(e, '/api/reactions', { who: 'member', body: { lang: 'en', word: 'love', value: 0 } });
	assert.equal((await get()).body.mine, 0);
	assert.equal((await call(e, '/api/reactions', { who: 'member', body: { lang: 'xx', word: 'love', value: 1 } })).status, 400);
	assert.equal((await call(e, '/api/reactions', { who: 'member', origin: 'https://evil.test', body: { lang: 'en', word: 'love', value: 1 } })).status, 403);
});

test('senses: ids and parts of speech for a signed-in member only', async () => {
	const e = env();
	assert.equal((await call(e, '/api/senses?lang=en&word=love')).status, 401);
	const { body } = await call(e, '/api/senses?lang=en&word=LOVE', { who: 'member' });
	assert.ok(body.senses.length >= 2);
	assert.ok(body.senses.every((s) => Number.isInteger(s.id) && s.word === 'love' && s.type));
	assert.ok(body.types.some((t) => t.name === 'Noun'));
	assert.equal((await call(e, '/api/senses?lang=my&word=ချစ်', { who: 'member' })).body.senses.length, 1);
});

test('suggestions: a member’s waits, an editor’s is approved; the old value comes from the dictionary', async () => {
	const e = env();
	const [first] = (await call(e, '/api/senses?lang=en&word=love', { who: 'member' })).body.senses;
	const edit = await call(e, '/api/edits', { who: 'member', body: { lang: 'en', word: 'love', action: 'edit', sense_id: first.id, field: 'sense', value: 'ချစ်ခြင်း', note: 'shorter', old_value: 'forged' } });
	assert.equal(edit.status, 201);
	assert.equal(edit.body.edit.status, 'pending');
	const row = e.raw.prepare('SELECT * FROM dict_edits WHERE id = ?').get(edit.body.edit.id);
	assert.equal(row.old_value, first.sense, 'not what the request said');
	assert.equal(row.new_value, 'ချစ်ခြင်း');
	assert.equal(row.source, 'sample');

	const approved = await call(e, '/api/edits', { who: 'editor', body: { lang: 'en', word: 'love', action: 'delete', sense_id: first.id } });
	assert.equal(approved.body.edit.status, 'approved');
	assert.equal(e.raw.prepare('SELECT reviewed_by FROM dict_edits WHERE id = ?').get(approved.body.edit.id).reviewed_by, 2);

	const noun = (await call(e, '/api/senses?lang=en&word=love', { who: 'member' })).body.types.find((t) => t.name === 'Noun').id;
	const add = await call(e, '/api/edits', { who: 'member', body: { lang: 'en', word: 'love', action: 'add', wrte: noun, sense: 'ချစ်\tခင်', exam: '' } });
	assert.deepEqual(JSON.parse(e.raw.prepare('SELECT data FROM dict_edits WHERE id = ?').get(add.body.edit.id).data), { wrte: noun, sense: 'ချစ် ခင်', exam: null }, 'one line, no empty example');

	const mine = (await call(e, '/api/senses?lang=en&word=love', { who: 'member' })).body.mine;
	assert.equal(mine.length, 2, 'the member’s own, not the editor’s');
});

test('suggestions: checked before they are kept', async () => {
	const e = env();
	const [first] = (await call(e, '/api/senses?lang=en&word=love', { who: 'member' })).body.senses;
	const bad = async (body) => (await call(e, '/api/edits', { who: 'member', body: { lang: 'en', word: 'love', ...body } })).status;
	assert.equal(await bad({ action: 'edit', sense_id: first.id, field: 'sense', value: first.sense }), 400, 'unchanged');
	assert.equal(await bad({ action: 'edit', sense_id: first.id, field: 'wrkd', value: '1' }), 400, 'not an editable field');
	assert.equal(await bad({ action: 'edit', sense_id: first.id, field: 'sense', value: 'x'.repeat(601) }), 400, 'too long');
	assert.equal(await bad({ action: 'edit', sense_id: 99999, field: 'sense', value: 'x' }), 404);
	assert.equal(await bad({ word: 'water', action: 'delete', sense_id: first.id }), 404, 'a sense of another word');
	assert.equal(await bad({ action: 'add', wrte: 999, sense: 'x' }), 400, 'unknown part of speech');
	assert.equal(await bad({ action: 'rename' }), 400);
	assert.equal((await call(e, '/api/edits', { body: { lang: 'en', word: 'love', action: 'delete', sense_id: first.id } })).status, 401);

	e.raw.exec("INSERT INTO dict_edits (user_id, dict, action, word, data, status) SELECT 1, 'emd', 'add', 'love', '{}', 'pending' FROM (WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 50) SELECT i FROM n)");
	assert.equal(await bad({ action: 'delete', sense_id: first.id }), 429, 'too many waiting');
});
