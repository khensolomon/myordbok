import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { resetSlotCache } from '../worker/lib/dict.js';
import worker from '../worker/index.js';
import { MIGRATION, SAMPLE, d1, sqlite } from './helpers/d1.js';

const assets = { fetch: async () => new Response('asset') };

/** Local setup: sample in slot A, pinned by DICT_SLOT. */
function localEnv(vars = {}) {
	return { DB: d1(sqlite(MIGRATION)), DICT_A: d1(sqlite(SAMPLE)), DICT_B: d1(sqlite()), ASSETS: assets, DICT_SLOT: 'a', ...vars };
}

/** @param {string} path @param {any} env @param {RequestInit} [init] */
async function call(path, env, init) {
	const res = await worker.fetch(new Request(`https://myordbok.test${path}`, init), env);
	return {
		status: res.status,
		robots: res.headers.get('x-robots-tag'),
		body: res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text(),
	};
}

beforeEach(() => resetSlotCache());

test('beta API responses carry noindex, production ones do not', async () => {
	assert.equal((await call('/api/health', localEnv({ NOINDEX: '1' }))).robots, 'noindex');
	assert.equal((await call('/api/nope', localEnv({ NOINDEX: '1' }))).robots, 'noindex');
	assert.equal((await call('/api/health', localEnv())).robots, null);
});

test('non-API paths are static assets', async () => {
	assert.equal((await call('/definition?q=love', localEnv())).body, 'asset');
});

test('health reports the version and the dictionary in use', async () => {
	const res = await call('/api/health', localEnv());
	assert.equal(res.status, 200);
	assert.match(res.body.version, /^\d+\.\d+\.\d+\+\d+$/);
	assert.deepEqual(res.body.dictionary, { slot: 'a', built: 'sample', source: 'sample' });
});

test('a site reads the slot its release names', async () => {
	const app = sqlite(MIGRATION);
	app.exec("INSERT INTO dict_release (env, slot, source, switched_by) VALUES ('beta', 'b', 'sample', 'test')");
	const env = { DB: d1(app), DICT_A: d1(sqlite()), DICT_B: d1(sqlite(SAMPLE)), ASSETS: assets, ENV_NAME: 'beta', DICT_SLOT: '' };
	assert.equal((await call('/api/health', env)).body.dictionary.slot, 'b');
	assert.equal((await call('/api/lookup?q=love', env)).body.entries.length, 4);
});

test('with no release, the API says so instead of guessing', async () => {
	const env = { DB: d1(sqlite(MIGRATION)), DICT_A: d1(sqlite(SAMPLE)), ASSETS: assets, ENV_NAME: 'production', DICT_SLOT: '' };
	const health = await call('/api/health', env);
	assert.equal(health.status, 503);
	assert.match(health.body.error, /No dictionary has been published for production/);
	const lookup = await call('/api/lookup?q=love', env);
	assert.equal(lookup.status, 503);
	assert.equal(lookup.body.error.code, 'unavailable');
});

test('an empty slot says how to fill it', async () => {
	const env = localEnv({ DICT_A: d1(sqlite()) });
	for (const path of ['/api/suggest?q=lo', '/api/lookup?q=love']) {
		const res = await call(path, env);
		assert.equal(res.status, 503);
		assert.match(res.body.error.message, /Dictionary slot a is empty \(no such table: \w+\); locally: make data-sample/);
	}
	const health = await call('/api/health', env);
	assert.equal(health.status, 503);
	assert.match(health.body.error, /slot a is empty/);
});

test('lookup: senses, forms, synonyms and opposites', async () => {
	const { body } = await call('/api/lookup?q=love', localEnv());
	assert.equal(body.language, 'en');
	assert.deepEqual(body.entries.map((e) => [e.type, e.kind]), [
		['Noun', 'Active'], ['Noun', 'Checked: awaiting native review'], ['Verb', 'Active'], ['Verb', 'Draft'],
	]);
	assert.deepEqual(body.forms.map((f) => f[0]), ['loves', 'loves', 'loved', 'loved', 'loving']);
	assert.deepEqual(body.synonyms, ['adore', 'affection']);
	assert.deepEqual(body.opposite, ['hate']);
});

test('lookup: a form points to its root, a variant to its headword', async () => {
	const went = (await call('/api/lookup?q=went', localEnv())).body;
	assert.deepEqual(went.entries, []);
	assert.deepEqual(went.forms_of, [['go', 'verb', 'past']]);
	assert.deepEqual(went.root_senses, { go: 1 });

	const color = (await call('/api/lookup?q=Color', localEnv())).body;
	assert.deepEqual(color.variant_of, ['colour']);
	assert.equal(color.entries[0].word, 'colour');
});

test('lookup: Myanmar headword with pronunciation', async () => {
	const { body } = await call(`/api/lookup?q=${encodeURIComponent('ရေ')}`, localEnv());
	assert.equal(body.language, 'my');
	assert.deepEqual(body.pronunciation, ['jè', 're']);
	assert.equal(body.entries[0].sense, '<water>');
});

test('suggest: headwords with senses, by prefix, in either script', async () => {
	assert.deepEqual((await call('/api/suggest?q=LO', localEnv())).body.words, ['lovable', 'love', 'love affair']);
	assert.deepEqual((await call('/api/suggest?q=wen', localEnv())).body.words, []); // a form, not a headword
	const my = (await call(`/api/suggest?q=${encodeURIComponent('ချ')}`, localEnv())).body;
	assert.equal(my.lang, 'my');
	assert.deepEqual(my.words, ['ချစ်', 'ချစ်သူ']);
});

test('errors are JSON with a stable code', async () => {
	const empty = await call('/api/lookup?q=', localEnv());
	assert.equal(empty.status, 400);
	assert.equal(empty.body.error.code, 'bad_request');

	const write = await call('/api/lookup?q=love', localEnv(), { method: 'POST' });
	assert.equal(write.status, 501);

	const unknown = await call('/api/entry/en/love', localEnv());
	assert.equal(unknown.body.error.code, 'not_found');

	const badSlot = await call('/api/lookup?q=love', localEnv({ DICT_SLOT: 'c' }));
	assert.equal(badSlot.status, 500);
});
