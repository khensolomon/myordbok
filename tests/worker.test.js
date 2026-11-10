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
	assert.equal(rows.emd_sense, 24);
	assert.equal(rows.mya_word, 5);
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

	const foreign = await call('/api/lookup?q=love', localEnv(), { method: 'POST' });
	assert.equal(foreign.status, 403, 'a write from anywhere but this site');
	const write = await call('/api/lookup?q=love', localEnv(), { method: 'POST', headers: { origin: 'https://myordbok.test' } });
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
	const gon = (await call('/api/spelling?q=gon', localEnv())).body.words;
	assert.ok(gon.includes('go') && !gon.includes('gone'), 'gone has no senses of its own');
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

test('lookup keeps each spelling found: God and god', async () => {
	const body = (await call('/api/lookup?q=god', localEnv())).body;
	assert.deepEqual([...new Set(body.entries.map((e) => e.word))].sort(), ['God', 'god']);
	const king = (await call(`/api/phrase?q=${encodeURIComponent('king of Norway')}`, localEnv())).body.parts[0];
	assert.equal(king.entries.length, 2);
	assert.equal(king.entries[king.fit].sense, 'ဘုရင်; မင်း');
});

test('read: one request decides entry, phrase, sentence or nothing', async () => {
	const read = async (/** @type {string} */ q) => (await call(`/api/read?q=${encodeURIComponent(q)}`, localEnv())).body;
	assert.equal((await read('love')).kind, 'entry');
	assert.equal((await read('went')).kind, 'entry', 'a form');
	assert.equal((await read('ချစ်သူ')).kind, 'entry');
	assert.equal((await read('love!')).result.query, 'love', 'punctuation only');
	assert.equal((await read('ချစ်။')).result.query, 'ချစ်');
	assert.equal((await read('king of Norway')).phrase.myanmar, 'နော်ဝေ ဘုရင်');

	const en = await read('love is good, love is an open door');
	assert.equal(en.kind, 'sentence');
	assert.deepEqual(en.words.map((w) => w.text), ['love', 'is', 'good', 'an', 'open', 'door']);
	assert.equal(en.first.query, 'love');

	const my = await read('ချစ်သူရေသောက်');
	assert.equal(my.kind, 'sentence');
	assert.deepEqual(my.words, [{ text: 'ချစ်သူ', known: true }, { text: 'ရေ', known: true }, { text: 'သောက်', known: true }]);
	assert.equal(my.first.query, 'ချစ်သူ');
	assert.deepEqual((await read('ရေကကသောက်')).words.map((w) => w.known), [true, false, true]);

	const none = await read('lvoe');
	assert.equal(none.kind, 'none');
	assert.deepEqual(none.close, ['love']);
	assert.deepEqual((await read('lo')).starts, ['lovable', 'love', 'love affair']);
});

test('guard: own pages only, a limit per visitor, open health; off without API_GUARD', async () => {
	/** A limiter allowing `n` requests per key. */
	const limiter = (n) => {
		const seen = new Map();
		return { limit: async ({ key }) => ({ success: (seen.set(key, (seen.get(key) ?? 0) + 1).get(key)) <= n }) };
	};
	const guarded = () => localEnv({ API_GUARD: '1', RATE_LOOKUP: limiter(2), RATE_HEAVY: limiter(1) });
	const own = { headers: { 'sec-fetch-site': 'same-origin', 'cf-connecting-ip': '192.0.2.1' } };
	const warn = console.warn;
	console.warn = () => {};
	try {
		let env = guarded();
		assert.equal((await call('/api/lookup?q=love', env)).body.error?.code, 'forbidden', 'no header: a script');
		assert.equal((await call('/api/lookup?q=love', env, { headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
		assert.equal((await call('/api/lookup?q=love', env, own)).status, 200);
		const older = { headers: { referer: 'https://myordbok.test/definition?q=love', 'cf-connecting-ip': '192.0.2.5' } };
		assert.equal((await call('/api/lookup?q=love', env, older)).status, 200, 'a browser without Sec-Fetch-Site, on this site');
		assert.equal((await call('/api/lookup?q=love', env, { headers: { referer: 'https://evil.test/' } })).status, 403, 'a Referer from another site');
		assert.equal((await call('/api/lookup?q=love', env, { headers: { 'sec-fetch-site': 'cross-site', referer: 'https://myordbok.test/' } })).status, 403, 'Sec-Fetch-Site decides when sent');
		assert.equal((await call('/api/health', env, { headers: { 'cf-connecting-ip': '192.0.2.9' } })).status, 200, 'health is open');

		env = guarded();
		assert.equal((await call('/api/read?q=love', env, own)).status, 200);
		const over = await call('/api/read?q=love', env, own);
		assert.equal(over.status, 429);
		assert.equal(over.body.error.code, 'rate_limited');
		assert.equal((await call('/api/read?q=love', env, { headers: { ...own.headers, 'cf-connecting-ip': '192.0.2.2' } })).status, 200, 'another visitor');
		assert.equal((await call('/api/lookup?q=love', env, own)).status, 200, 'lookups count apart');

		const missing = localEnv({ API_GUARD: '1' });
		assert.match((await call('/api/lookup?q=love', missing, own)).body.error.message, /RATE_LOOKUP is missing/);

		assert.equal((await call('/api/lookup?q=love', localEnv())).status, 200, 'local development: off');
	} finally {
		console.warn = warn;
	}
});

test('wrangler.toml: beta and production turn the guard on with their own limits', async () => {
	const { readFile } = await import('node:fs/promises');
	const toml = await readFile(new URL('../wrangler.toml', import.meta.url), 'utf8');
	for (const env of ['beta', 'production']) {
		assert.match(toml, new RegExp(`\\[env\\.${env}\\][^]*?API_GUARD = "1"`), `${env} guard`);
		for (const name of ['RATE_LOOKUP', 'RATE_HEAVY']) assert.match(toml, new RegExp(`\\[\\[env\\.${env}\\.ratelimits\\]\\]\\nname = "${name}"`), `${env} ${name}`);
	}
	const ids = [...toml.matchAll(/namespace_id = "(\d+)"/g)].map((m) => m[1]);
	assert.equal(new Set(ids).size, ids.length, 'each environment counts on its own');
});

test('wrangler.toml: production is the Worker named myordbok; the local top level is not', async () => {
	const { readFile } = await import('node:fs/promises');
	const toml = await readFile(new URL('../wrangler.toml', import.meta.url), 'utf8');
	assert.match(toml, /^name = "myordbok-local"$/m);
	assert.match(toml, /\[env\.beta\]\nname = "myordbok-beta"/);
	assert.match(toml, /\[env\.production\]\nname = "myordbok"\n/);
});
