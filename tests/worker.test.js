import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { resetChoiceCache } from '../worker/lib/dict.js';
import worker from '../worker/index.js';
import { MIGRATION, SAMPLE, d1, sqlite } from './helpers/d1.js';

const assets = { fetch: async () => new Response('asset') };

/** Local setup: the sample in myordbok-dictionary, pinned by DICT_DB. */
function localEnv(vars = {}) {
	return { APP: d1(sqlite(MIGRATION)), DATASET: d1(sqlite()), DICTIONARY: d1(sqlite(SAMPLE)), ASSETS: assets, DICT_DB: 'dictionary', ...vars };
}

/**
 * A site that reads what dict_release says.
 * @param {'beta' | 'production'} env
 * @param {string} [reads]  dict_release.reads for that site; none when omitted.
 */
function siteEnv(env, reads) {
	const app = sqlite(MIGRATION);
	if (reads) app.prepare("INSERT INTO dict_release (env, reads, build, switched_by) VALUES (?, ?, 'sample', 'test')").run(env, reads);
	return { APP: d1(app), DATASET: d1(sqlite(SAMPLE)), DICTIONARY: d1(sqlite(SAMPLE)), ASSETS: assets, ENV_NAME: env, DICT_DB: '' };
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

beforeEach(() => resetChoiceCache());

test('beta API responses carry noindex, production ones do not', async () => {
	assert.equal((await call('/api/health', localEnv({ NOINDEX: '1' }))).robots, 'noindex');
	assert.equal((await call('/api/nope', localEnv({ NOINDEX: '1' }))).robots, 'noindex');
	assert.equal((await call('/api/health', localEnv())).robots, null);
});

test('non-API paths are static assets', async () => {
	assert.equal((await call('/definition?q=love', localEnv())).body, 'asset');
});

test('health reports the version and the dictionary database in use', async () => {
	const res = await call('/api/health', localEnv());
	assert.equal(res.status, 200);
	assert.match(res.body.version, /^\d+\.\d+\.\d+\+\d+$/);
	const { rows, ...dictionary } = res.body.dictionary;
	assert.deepEqual(dictionary, { database: 'myordbok-dictionary', built: 'sample', source: 'sample' });
	assert.equal(rows.emd_sense, 22);
	assert.equal(rows.mya_word, 3);
});

test('each site reads the database dict_release names', async () => {
	assert.equal((await call('/api/health', siteEnv('beta', 'dataset'))).body.dictionary.database, 'myordbok-dataset');
	resetChoiceCache();
	assert.equal((await call('/api/health', siteEnv('production', 'dictionary'))).body.dictionary.database, 'myordbok-dictionary');
	resetChoiceCache();
	// During a promotion production reads the dataset, which holds the same build.
	const promoting = siteEnv('production', 'dataset');
	assert.equal((await call('/api/health', promoting)).body.dictionary.database, 'myordbok-dataset');
	assert.equal((await call('/api/lookup?q=love', promoting)).body.entries.length, 4);
});

test('with no release, the API says so instead of guessing', async () => {
	const health = await call('/api/health', siteEnv('production'));
	assert.equal(health.status, 503);
	assert.match(health.body.error, /No dictionary has been released to production; run make data-promote/);
	const lookup = await call('/api/lookup?q=love', siteEnv('beta'));
	assert.equal(lookup.status, 503);
	assert.match(lookup.body.error.message, /run make data-publish/);
});

test('an empty dictionary database says how to fill it', async () => {
	const env = localEnv({ DICTIONARY: d1(sqlite()) });
	for (const path of ['/api/suggest?q=lo', '/api/lookup?q=love']) {
		const res = await call(path, env);
		assert.equal(res.status, 503);
		assert.match(res.body.error.message, /myordbok-dictionary is empty \(no such table: \w+\); locally: make data-sample/);
	}
	const health = await call('/api/health', env);
	assert.equal(health.status, 503);
	assert.match(health.body.error, /myordbok-dictionary is empty/);
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

	const badChoice = await call('/api/lookup?q=love', localEnv({ DICT_DB: 'other' }));
	assert.equal(badChoice.status, 500);
});

test('spelling: headwords one edit away, with senses', async () => {
	const { edits1 } = await import('../worker/routes/spelling.js');
	assert.ok(edits1('lvoe').includes('love'));
	assert.ok(!edits1('love').includes('love'));
	assert.deepEqual((await call('/api/spelling?q=lvoe', localEnv())).body.words, ['love']);
	assert.deepEqual((await call('/api/spelling?q=Wtaer', localEnv())).body.words, ['water']);
	assert.deepEqual((await call('/api/spelling?q=gon', localEnv())).body.words, ['go'], 'gone has no senses of its own');
	assert.deepEqual((await call(`/api/spelling?q=${encodeURIComponent('ချစ')}`, localEnv())).body.words, []);
});

test('phrase: parts found as typed, by form or by spelling, put together in Myanmar', async () => {
	const body = (await call(`/api/phrase?q=${encodeURIComponent('king of danmark')}`, localEnv())).body;
	assert.equal(body.pattern, 'of');
	assert.deepEqual(body.parts.map((p) => [p.term, p.word, p.note]), [['king', 'king', null], ['danmark', 'Denmark', 'spelling']]);
	assert.equal(body.myanmar, 'ဒိန်းမတ် ဘုရင်', 'the sense whose example has a name after "of"');
	const jazz = (await call('/api/phrase?q=king%20of%20water', localEnv())).body;
	assert.equal(jazz.parts[0].sense.sense, 'အကောင်းဆုံးသူ; ထိပ်ဆုံးသူ', 'a common noun after "of": the other example');
	const kings = (await call(`/api/phrase?q=${encodeURIComponent('kings of Norway')}`, localEnv())).body;
	assert.deepEqual(kings.parts.map((p) => [p.word, p.note]), [['king', 'form'], ['Norway', null]]);
	assert.equal((await call('/api/phrase?q=big%20house', localEnv())).body.myanmar, 'ကြီးသော အိမ်');
	const none = (await call('/api/phrase?q=king%20of%20zzzzqq', localEnv())).body;
	assert.equal(none.myanmar, null);
	assert.equal(none.parts[1].sense, null);
	assert.equal((await call('/api/phrase?q=love', localEnv())).body.pattern, null);
});
