import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import worker from '../worker/index.js';
import { applyEdits } from '../shared/layer.js';
import { LAYER_MAX, resetLayerCache } from '../worker/lib/layer.js';
import { MIGRATION, SAMPLE, d1, sqlite } from './helpers/d1.js';

const SITE = 'https://myordbok.test';
const hash = (t) => createHash('sha256').update(t).digest('hex');

function env() {
	const app = sqlite(MIGRATION);
	app.exec(`INSERT INTO users (id, name, email, role) VALUES (1, 'Mya', 'm@example.com', 'member'), (2, 'Ed', 'e@example.com', 'editor'), (3, 'Ad', 'a@example.com', 'admin'), (4, 'Own', 'o@example.com', 'owner');
		INSERT INTO sessions (id_hash, user_id, expires_at) VALUES ('${hash('member')}', 1, unixepoch() + 3600), ('${hash('editor')}', 2, unixepoch() + 3600), ('${hash('admin')}', 3, unixepoch() + 3600), ('${hash('owner')}', 4, unixepoch() + 3600);`);
	const dict = sqlite(SAMPLE);
	return { raw: app, rawDict: dict, APP: d1(app), BETA: d1(sqlite()), LIVE: d1(dict), ASSETS: { fetch: () => new Response('') }, DICT_DB: 'live' };
}

async function call(e, path, { who, body } = {}) {
	const headers = { origin: SITE, 'content-type': 'application/json' };
	if (who) headers.cookie = `__Host-mo_session=${who}`;
	const res = await worker.fetch(new Request(`${SITE}${path}`, body === undefined ? { headers } : { method: 'POST', headers, body: JSON.stringify(body) }), e);
	return { status: res.status, body: await res.json() };
}

const suggest = async (e, who, body) => (await call(e, '/api/edits', { who, body: { lang: 'en', word: 'love', ...body } })).body.edit;
/** The senses readers get for a word, as [id, sense, example]. */
const read = async (e, q = 'love') => {
	// Another isolate, or this one 30 s later: the layer is read again.
	resetLayerCache();
	const { body } = await call(e, `/api/read?q=${encodeURIComponent(q)}`);
	return body.kind === 'entry' ? body.result.entries.map((s) => [s.id ?? null, s.sense, s.example]) : body.kind;
};
const BUILT = [
	[1, 'ချစ်ခြင်း; ချစ်ခင်မှု', "a mother's love for her <family>"],
	[2, 'ချစ်သူ', 'You were my first love.'],
	[3, 'ချစ်သည်', '<love/loved/loved>; She loves her <family>.'],
	[4, '[type:informal] အလွန်နှစ်သက်သည်', 'I (-love-) this song!'],
];

test('applyEdits: only where the build still holds what the edit was made against', () => {
	const rows = [
		{ id: 1, type: 'Noun', sense: 'a', example: 'x' },
		{ id: 2, type: 'Verb', sense: 'b', example: null },
	];
	const how = { exampleKey: 'example', typeName: (id) => ['Noun', 'Verb'][id], make: (a) => ({ type: a.type, sense: a.sense, example: a.exam }) };
	const edit = (id, more) => ({ id, dict: 'emd', word: 'w', action: 'edit', sense_id: 1, field: 'sense', old_value: null, new_value: null, data: null, ...more });
	const out = applyEdits(
		rows,
		[
			// Given out of order: applied oldest first, so the second follows the first.
			edit(2, { old_value: 'A', new_value: 'AA' }),
			edit(1, { old_value: 'a', new_value: 'A' }),
			edit(3, { old_value: 'zzz', new_value: 'no: the build moved on' }),
			edit(4, { field: 'exam', old_value: 'x', new_value: null }),
			edit(5, { sense_id: 2, field: 'exam', old_value: null, new_value: 'y' }),
			edit(6, { sense_id: 9, old_value: 'gone', new_value: 'no such sense' }),
			edit(7, { action: 'add', sense_id: null, field: null, data: JSON.stringify({ wrte: 1, sense: 'c', exam: 'z' }) }),
			edit(8, { action: 'add', sense_id: null, field: null, data: JSON.stringify({ wrte: 1, sense: 'b' }) }), // the build has it
			edit(9, { action: 'add', sense_id: null, field: null, data: JSON.stringify({ wrte: 7, sense: 'd' }) }), // no such part of speech
			edit(10, { action: 'add', sense_id: null, field: null, data: 'not json' }),
		],
		how,
	);
	assert.deepEqual(out, [
		{ id: 1, type: 'Noun', sense: 'AA', example: null },
		{ id: 2, type: 'Verb', sense: 'b', example: 'y' },
		{ type: 'Verb', sense: 'c', example: 'z' },
	]);
	assert.equal(rows[0].sense, 'a', 'the rows given are not changed');
	assert.deepEqual(applyEdits(rows, [edit(1, { action: 'delete', sense_id: 2, field: 'delete' })], how), [rows[0]]);
});

test('live: an admin or owner makes an approved edit live; an editor’s approval waits for the release', async () => {
	const e = env();
	assert.deepEqual(await read(e), BUILT);

	// A member suggests, an editor approves: approved, not live.
	const a = await suggest(e, 'member', { action: 'edit', sense_id: 2, field: 'sense', value: 'ချစ်သူ; ရည်းစား' });
	assert.deepEqual(a, { id: a.id, status: 'pending', live: false });
	assert.deepEqual((await call(e, `/api/workspace/edits/${a.id}/review`, { who: 'editor', body: { decision: 'approve' } })).body.edit, { id: a.id, status: 'approved', live: false });
	assert.deepEqual(await read(e), BUILT);

	// Only admins and owners make it live, and only an approved one.
	assert.equal((await call(e, `/api/workspace/edits/${a.id}/live`, { who: 'editor', body: { live: true } })).status, 403);
	assert.equal((await call(e, `/api/workspace/edits/${a.id}/live`, { who: 'member', body: { live: true } })).status, 403);
	assert.equal((await call(e, `/api/workspace/edits/${a.id}/live`, { who: 'admin', body: { live: 'yes' } })).status, 400);
	assert.equal((await call(e, '/api/workspace/edits/999/live', { who: 'admin', body: { live: true } })).status, 404);
	assert.deepEqual((await call(e, `/api/workspace/edits/${a.id}/live`, { who: 'admin', body: { live: true } })).body.edit, { id: a.id, status: 'approved', live: true });
	assert.deepEqual((await read(e))[1], [2, 'ချစ်သူ; ရည်းစား', 'You were my first love.']);
	const listed = (await call(e, '/api/workspace/edits?status=approved', { who: 'editor' })).body.edits[0];
	assert.equal(listed.live, true);
	assert.equal(listed.live_by, 'Ad');
	assert.equal(listed.current.sense, 'ချစ်သူ', 'a live edit is compared with the build, not with itself');

	// Taken off: readers get the build again; it stays approved for the release.
	assert.deepEqual((await call(e, `/api/workspace/edits/${a.id}/live`, { who: 'owner', body: { live: false } })).body.edit, { id: a.id, status: 'approved', live: false });
	assert.deepEqual(await read(e), BUILT);
	assert.deepEqual({ ...e.raw.prepare('SELECT status, live_at, live_by FROM dict_edits WHERE id = ?').get(a.id) }, { status: 'approved', live_at: null, live_by: null });

	// An admin's approval is live at once; a pending or declined one cannot be made live.
	const b = await suggest(e, 'member', { action: 'edit', sense_id: 1, field: 'exam', value: 'love of country' });
	assert.equal((await call(e, `/api/workspace/edits/${b.id}/live`, { who: 'admin', body: { live: true } })).status, 409);
	assert.deepEqual((await call(e, `/api/workspace/edits/${b.id}/review`, { who: 'admin', body: { decision: 'approve' } })).body.edit, { id: b.id, status: 'approved', live: true });
	assert.deepEqual((await read(e))[0], [1, 'ချစ်ခြင်း; ချစ်ခင်မှု', 'love of country']);
	const c = await suggest(e, 'member', { action: 'delete', sense_id: 4 });
	assert.deepEqual((await call(e, `/api/workspace/edits/${c.id}/review`, { who: 'admin', body: { decision: 'reject' } })).body.edit, { id: c.id, status: 'rejected', live: false });
	assert.equal((await read(e)).length, 4);
});

test('live: an admin’s own change, addition and removal are live at once; an editor’s own wait', async () => {
	const e = env();
	assert.deepEqual(await suggest(e, 'editor', { action: 'delete', sense_id: 4 }), { id: 1, status: 'approved', live: false });
	assert.equal((await read(e)).length, 4);

	assert.deepEqual(await suggest(e, 'admin', { action: 'delete', sense_id: 2 }), { id: 2, status: 'approved', live: true });
	assert.deepEqual(await suggest(e, 'owner', { action: 'add', wrte: 2, sense: 'ချစ်စရာ', exam: 'a love story' }), { id: 3, status: 'approved', live: true });
	const now = await read(e);
	assert.deepEqual(now.map((s) => s[0]), [1, 3, 4, null], 'sense 2 is gone; the new one has no id yet');
	assert.deepEqual(now[3], [null, 'ချစ်စရာ', 'a love story']);
	const { result } = (await call(e, '/api/read?q=love')).body;
	assert.deepEqual(result.entries[3], { word: 'love', type: 'Adjective', kind: 'Draft', sense: 'ချစ်စရာ', example: 'a love story' });
	assert.equal((await call(e, '/api/lookup?q=LOVE')).body.entries.length, 4, 'the plain lookup has the layer too');

	// What an edit is made against is what readers see: the deleted sense is
	// gone, and a second change follows the first.
	const senses = (await call(e, '/api/senses?lang=en&word=love', { who: 'member' })).body.senses;
	assert.deepEqual(senses.map((s) => s.id), [1, 3, 4]);
	assert.equal((await call(e, '/api/edits', { who: 'member', body: { lang: 'en', word: 'love', action: 'edit', sense_id: 2, field: 'sense', value: 'x' } })).status, 404);
	await suggest(e, 'admin', { action: 'edit', sense_id: 3, field: 'sense', value: 'ချစ်သည်; မြတ်နိုးသည်' });
	assert.equal((await call(e, '/api/senses?lang=en&word=love', { who: 'member' })).body.senses[1].sense, 'ချစ်သည်; မြတ်နိုးသည်');
	const next = await suggest(e, 'owner', { action: 'edit', sense_id: 3, field: 'sense', value: 'ချစ်မြတ်နိုးသည်' });
	assert.equal(e.raw.prepare('SELECT old_value FROM dict_edits WHERE id = ?').get(next.id).old_value, 'ချစ်သည်; မြတ်နိုးသည်');
	assert.equal((await read(e))[1][1], 'ချစ်မြတ်နိုးသည်');
	assert.equal((await call(e, '/api/edits', { who: 'owner', body: { lang: 'en', word: 'love', action: 'edit', sense_id: 3, field: 'sense', value: 'ချစ်မြတ်နိုးသည်' } })).status, 400, 'the same as readers see now');

	// A headword the build lacks, and a Myanmar entry.
	assert.equal(await read(e, 'lovebird'), 'none');
	await call(e, '/api/edits', { who: 'admin', body: { lang: 'en', word: 'lovebird', action: 'add', wrte: 0, sense: 'ချစ်သူငှက်' } });
	assert.deepEqual(await read(e, 'lovebird'), [[null, 'ချစ်သူငှက်', null]]);
	await call(e, '/api/edits', { who: 'admin', body: { lang: 'my', word: 'ချစ်', action: 'edit', sense_id: 2, field: 'sense', value: 'to <love>' } });
	assert.deepEqual(await read(e, 'ချစ်'), [[2, 'to <love>', '~သူ']]);
});

test('live: the layer follows the release, the build read, and its switch', async () => {
	const e = env();
	const a = await suggest(e, 'admin', { action: 'edit', sense_id: 2, field: 'sense', value: 'ရည်းစား' });
	const set = (sql) => e.raw.exec(`UPDATE dict_edits SET ${sql} WHERE id = ${a.id}`);
	const second = async () => (await read(e))[1][1];
	assert.equal(await second(), 'ရည်းစား');

	// Exported to the dataset, no build holds it yet: still from the layer.
	set("status = 'exported'");
	assert.equal(await second(), 'ရည်းစား');
	// Merged by a newer build than the one read here (live before data-live): still.
	set("status = 'merged', merged_in = 'sample 2'");
	assert.equal(await second(), 'ရည်းစား');
	// Merged by the build read: the build speaks for itself.
	set("merged_in = 'sample'");
	assert.equal(await second(), 'ချစ်သူ');
	// A conflict found by the release leaves the layer.
	set("status = 'conflict', merged_in = NULL");
	assert.equal(await second(), 'ချစ်သူ');

	// A build that holds the edit already is left as it is.
	set("status = 'exported'");
	e.rawDict.exec("UPDATE emd_sense SET sense = 'ရည်းစား' WHERE id = 2");
	assert.equal(await second(), 'ရည်းစား');
	e.rawDict.exec("UPDATE emd_sense SET sense = 'changed in the dataset' WHERE id = 2");
	assert.equal(await second(), 'changed in the dataset', 'the dataset moved on: the edit changes nothing');
	e.rawDict.exec("UPDATE emd_sense SET sense = 'ချစ်သူ' WHERE id = 2");

	// The switch: off shows the build alone; edits stay live for when it is on.
	assert.equal(await second(), 'ရည်းစား');
	assert.equal((await call(e, '/api/workspace/settings', { who: 'admin', body: { key: 'edits.live', value: 'off' } })).status, 200);
	assert.equal(await second(), 'ချစ်သူ');
	await call(e, '/api/workspace/settings', { who: 'admin', body: { key: 'edits.live', value: 'on' } });
	assert.equal(await second(), 'ရည်းစား');

	// Between reads of the layer a lookup costs no query on the app database.
	resetLayerCache();
	await call(e, '/api/read?q=love');
	let queries = 0;
	const app = e.APP;
	e.APP = { ...app, prepare: (sql) => (queries++, app.prepare(sql)) };
	await call(e, '/api/read?q=love');
	await call(e, '/api/read?q=go');
	assert.equal(queries, 0);
	e.APP = app;
});

test('live: a full layer takes no more until a release', async () => {
	const e = env();
	const values = Array.from({ length: LAYER_MAX }, (_, i) => `(4, 'emd', 'add', 'w${i}', '{"wrte":0,"sense":"s"}', 'approved', 4, unixepoch(), 4, unixepoch())`).join(',');
	e.raw.exec(`INSERT INTO dict_edits (user_id, dict, action, word, data, status, reviewed_by, reviewed_at, live_by, live_at) VALUES ${values}`);
	const full = await call(e, '/api/edits', { who: 'admin', body: { lang: 'en', word: 'love', action: 'delete', sense_id: 4 } });
	assert.equal(full.status, 409);
	assert.match(full.body.error.message, /2000 edits are live.*make data-release/);
	assert.equal((await read(e)).length, 4, 'and the full layer still reads');
	// An editor's own does not need room: it is not live.
	assert.equal((await call(e, '/api/edits', { who: 'editor', body: { lang: 'en', word: 'love', action: 'delete', sense_id: 4 } })).status, 201);
});
