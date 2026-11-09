import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import worker from '../worker/index.js';
import { MIGRATION, SAMPLE, d1, sqlite } from './helpers/d1.js';

const SITE = 'https://myordbok.test';
const hash = (t) => createHash('sha256').update(t).digest('hex');

function env() {
	const app = sqlite(MIGRATION);
	app.exec(`INSERT INTO users (id, name, email, role) VALUES (1, 'Mya', 'm@example.com', 'member'), (2, 'Ed', 'e@example.com', 'editor'), (3, 'Other', 'o@example.com', 'member');
		INSERT INTO sessions (id_hash, user_id, expires_at) VALUES ('${hash('member')}', 1, unixepoch() + 3600), ('${hash('editor')}', 2, unixepoch() + 3600), ('${hash('other')}', 3, unixepoch() + 3600);`);
	const dict = sqlite(SAMPLE);
	return { raw: app, rawDict: dict, APP: d1(app), DATASET: d1(sqlite()), DICTIONARY: d1(dict), ASSETS: { fetch: () => new Response('') }, DICT_DB: 'dictionary' };
}

async function call(e, path, { who, body, method } = {}) {
	const headers = { origin: SITE, 'content-type': 'application/json' };
	if (who) headers.cookie = `__Host-mo_session=${who}`;
	const init = body === undefined && method !== 'POST' ? { headers } : { method: 'POST', headers, body: JSON.stringify(body ?? {}) };
	const res = await worker.fetch(new Request(`${SITE}${path}`, init), e);
	return { status: res.status, body: await res.json() };
}

async function suggest(e, who, body) {
	return (await call(e, '/api/edits', { who, body: { lang: 'en', word: 'love', ...body } })).body.edit;
}

test('workspace: a member sees only their own; an editor sees the queue with the sense as it is now', async () => {
	const e = env();
	const [first] = (await call(e, '/api/senses?lang=en&word=love', { who: 'member' })).body.senses;
	const mine = await suggest(e, 'member', { action: 'edit', sense_id: first.id, field: 'sense', value: 'ချစ်ခြင်း', note: 'shorter' });
	await suggest(e, 'other', { action: 'delete', sense_id: first.id });

	assert.equal((await call(e, '/api/workspace/edits')).status, 401);
	const own = (await call(e, '/api/workspace/edits?status=all', { who: 'member' })).body;
	assert.deepEqual(own.edits.map((x) => x.id), [mine.id], 'only their own, even without mine=1');
	assert.equal(own.edits[0].own, true);

	const queue = (await call(e, '/api/workspace/edits', { who: 'editor' })).body;
	assert.equal(queue.edits.length, 2);
	const item = queue.edits.find((x) => x.id === mine.id);
	assert.equal(item.author, 'Mya');
	assert.equal(item.current.sense, first.sense);
	assert.equal(item.current.type, first.type);

	assert.deepEqual((await call(e, '/api/workspace/summary', { who: 'editor' })).body, { role: 'editor', mine: {}, waiting: 2 });
	assert.deepEqual((await call(e, '/api/workspace/summary', { who: 'member' })).body, { role: 'member', mine: { pending: 1 }, waiting: null });
});

test('workspace: review once, by an editor; withdraw by the author while waiting', async () => {
	const e = env();
	const [first] = (await call(e, '/api/senses?lang=en&word=love', { who: 'member' })).body.senses;
	const a = await suggest(e, 'member', { action: 'delete', sense_id: first.id });
	const b = await suggest(e, 'member', { action: 'add', wrte: 0, sense: 'ချစ်ခင်' });
	const c = await suggest(e, 'member', { action: 'add', wrte: 0, sense: 'နှစ်သက်' });

	assert.equal((await call(e, `/api/workspace/edits/${a.id}/review`, { who: 'member', body: { decision: 'approve' } })).status, 403);
	assert.equal((await call(e, `/api/workspace/edits/${a.id}/review`, { who: 'editor', body: { decision: 'maybe' } })).status, 400);
	const ok = await call(e, `/api/workspace/edits/${a.id}/review`, { who: 'editor', body: { decision: 'reject', note: 'still\\nused' } });
	assert.deepEqual(ok.body.edit, { id: a.id, status: 'rejected' });
	const row = e.raw.prepare('SELECT reviewed_by, review_note FROM dict_edits WHERE id = ?').get(a.id);
	assert.deepEqual({ ...row }, { reviewed_by: 2, review_note: 'still\\nused' });
	const again = await call(e, `/api/workspace/edits/${a.id}/review`, { who: 'editor', body: { decision: 'approve' } });
	assert.equal(again.status, 409);
	assert.match(again.body.error.message, /already rejected/);
	assert.equal((await call(e, '/api/workspace/edits/9999/review', { who: 'editor', body: { decision: 'approve' } })).status, 404);

	assert.equal((await call(e, `/api/workspace/edits/${b.id}/withdraw`, { who: 'other', method: 'POST' })).status, 403);
	assert.equal((await call(e, `/api/workspace/edits/${b.id}/withdraw`, { who: 'member', method: 'POST' })).status, 200);
	assert.equal(e.raw.prepare('SELECT count(*) AS n FROM dict_edits WHERE id = ?').get(b.id).n, 0);
	await call(e, `/api/workspace/edits/${c.id}/review`, { who: 'editor', body: { decision: 'approve' } });
	assert.equal((await call(e, `/api/workspace/edits/${c.id}/withdraw`, { who: 'member', method: 'POST' })).status, 409, 'approved already');

	const approved = (await call(e, '/api/workspace/edits?status=approved', { who: 'editor' })).body.edits;
	assert.deepEqual(approved.map((x) => [x.id, x.reviewer, x.data.sense]), [[c.id, 'Ed', 'နှစ်သက်']]);
	assert.equal((await call(e, '/api/workspace/edits?status=nonsense', { who: 'editor' })).status, 400);
});

test('workspace: pages of 30, newest first', async () => {
	const e = env();
	e.raw.exec("INSERT INTO dict_edits (user_id, dict, action, word, data) SELECT 1, 'emd', 'add', 'love', '{\"wrte\":0,\"sense\":\"x\"}' FROM (WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 35) SELECT i FROM n)");
	const one = (await call(e, '/api/workspace/edits', { who: 'editor' })).body;
	assert.equal(one.edits.length, 30);
	assert.equal(one.more, true);
	const two = (await call(e, `/api/workspace/edits?before=${one.edits.at(-1).id}`, { who: 'editor' })).body;
	assert.equal(two.edits.length, 5);
	assert.equal(two.more, false);
	assert.ok(one.edits[0].id > one.edits[1].id);
});
