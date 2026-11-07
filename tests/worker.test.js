import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../worker/index.js';

/**
 * Minimal D1 stand-in: answers each prepared statement by matching its SQL.
 * @param {Array<{ match: RegExp, first?: unknown, all?: unknown[] }>} answers
 */
function fakeDB(answers) {
	return {
		/** @type {Array<{ sql: string, args: unknown[] }>} */
		calls: [],
		prepare(sql) {
			const answer = answers.find((a) => a.match.test(sql));
			if (!answer) throw new Error(`Unexpected SQL: ${sql}`);
			const calls = this.calls;
			return {
				bind(...args) {
					calls.push({ sql, args });
					return {
						first: async () => answer.first ?? null,
						all: async () => ({ results: answer.all ?? [] }),
					};
				},
			};
		},
	};
}

const assets = { fetch: async () => new Response('asset') };

/** @param {string} path @param {unknown} DB @param {RequestInit} [init] */
async function call(path, DB, init) {
	const res = await worker.fetch(new Request(`https://myordbok.test${path}`, init), /** @type {any} */ ({ DB, ASSETS: assets }));
	return { status: res.status, body: res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text() };
}

test('non-API paths are static assets', async () => {
	const res = await call('/definition?q=love', fakeDB([]));
	assert.equal(res.body, 'asset');
});

test('health reports the version', async () => {
	const res = await call('/api/health', fakeDB([]));
	assert.equal(res.status, 200);
	assert.equal(res.body.ok, true);
	assert.match(res.body.version, /^\d+\.\d+\.\d+\+\d+$/);
});

test('search uses a key range on the right dictionary', async () => {
	const DB = fakeDB([{ match: /FROM mya_word/, all: [{ word: 'ကကွက်' }] }]);
	const res = await call('/api/search?q=%E1%80%80', DB);
	assert.equal(res.status, 200);
	assert.equal(res.body.lang, 'my');
	assert.deepEqual(res.body.words, ['ကကွက်']);
	assert.equal(DB.calls[0].args[0], 'က');
});

test('entry groups senses by part of speech in order', async () => {
	const DB = fakeDB([
		{ match: /FROM eng_word/, first: { id: 1, word: 'love' } },
		{
			match: /FROM emd_sense/,
			all: [
				{ id: 1, sense: 'အချစ်', exam: 'a love <song>', pos: 'noun' },
				{ id: 2, sense: 'ချစ်သူ', exam: null, pos: 'noun' },
				{ id: 3, sense: 'ချစ်', exam: 'do you love me?', pos: 'verb' },
			],
		},
	]);
	const res = await call('/api/entry/en/Love', DB);
	assert.equal(res.status, 200);
	assert.deepEqual(res.body.pos.map((p) => [p.name, p.senses.length]), [['noun', 2], ['verb', 1]]);
	assert.equal(DB.calls[0].args[0], 'love');
});

test('errors are JSON with a stable code', async () => {
	const missing = await call('/api/entry/en/zzz', fakeDB([{ match: /FROM eng_word/, first: null }]));
	assert.equal(missing.status, 404);
	assert.equal(missing.body.error.code, 'not_found');

	const badLang = await call('/api/entry/fr/love', fakeDB([]));
	assert.equal(badLang.body.error.code, 'bad_request');

	const empty = await call('/api/search?q=', fakeDB([]));
	assert.equal(empty.status, 400);

	const write = await call('/api/search', fakeDB([]), { method: 'POST' });
	assert.equal(write.status, 501);

	const unknown = await call('/api/nope', fakeDB([]));
	assert.equal(unknown.body.error.code, 'not_found');
});
