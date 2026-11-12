import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, test } from 'node:test';
import { ZAWGYI_SURE, refuseZawgyi, unicodeIfZawgyi, zawgyiProbability, zawgyiReading, zawgyiToUnicode } from '../shared/zawgyi/index.js';
import { resetChoiceCache } from '../worker/lib/dict.js';
import worker from '../worker/index.js';
import { MIGRATION, ROOT, SAMPLE, d1, sqlite } from './helpers/d1.js';

const SITE = 'https://myordbok.test';

beforeEach(() => resetChoiceCache());

test('detector: the same probabilities as Google’s own compatibility table', () => {
	const lines = readFileSync(join(ROOT, 'tests/fixtures/zawgyi-compatibility.tsv'), 'utf8').split('\n').filter(Boolean);
	assert.ok(lines.length >= 50);
	for (const line of lines) {
		const tab = line.indexOf('\t');
		const want = line.slice(0, tab) === '-Infinity' ? Number.NEGATIVE_INFINITY : Number(line.slice(0, tab));
		const got = zawgyiProbability(line.slice(tab + 1));
		assert.ok(got === want || Math.abs((got - want) / want) <= 1e-6, `${line.slice(tab + 1)}: ${got}, not ${want}`);
	}
});

test('detector and converter on words', () => {
	const pairs = [
		['ေကာင္း', 'ကောင်း'],
		['ခ်စ္', 'ချစ်'],
		['ျမန္မာ', 'မြန်မာ'],
		['အိမ္', 'အိမ်'],
		['ေရ', 'ရေ'],
		['အျပည္ျပည္ဆိုင္ရာ လူ႔အခြင့္အေရး ေၾကညာစာတမ္း', 'အပြည်ပြည်ဆိုင်ရာ လူ့အခွင့်အရေး ကြေညာစာတမ်း'],
	];
	for (const [zawgyi, unicode] of pairs) {
		assert.ok(zawgyiProbability(zawgyi) >= ZAWGYI_SURE, `${zawgyi} is Zawgyi`);
		assert.ok(zawgyiProbability(unicode) < 0.1, `${unicode} is Unicode`);
		assert.equal(zawgyiToUnicode(zawgyi), unicode);
		assert.equal(unicodeIfZawgyi(zawgyi), unicode);
		assert.equal(unicodeIfZawgyi(unicode), null);
	}
	assert.equal(zawgyiProbability('love'), Number.NEGATIVE_INFINITY);
	assert.equal(unicodeIfZawgyi('love'), null);
	assert.doesNotThrow(() => refuseZawgyi('ချစ်ခြင်း and love', 'The comment'));
	assert.throws(() => refuseZawgyi('ခ်စ္ျခင္း', 'The comment'), /The comment looks like Zawgyi/);
});

test('zawgyiReading: converted only when as typed finds no entry, kept by what it finds', async () => {
	const entries = new Set(['ချစ်']);
	const read = async (q) => ({ q, kind: entries.has(q) ? 'entry' : 'none' });
	assert.deepEqual(await zawgyiReading('ခ်စ္', read), { q: 'ချစ်', kind: 'entry', zawgyi: { typed: 'ခ်စ္', as: 'ချစ်' } });
	assert.deepEqual(await zawgyiReading('ချစ်', read), { q: 'ချစ်', kind: 'entry' }, 'Unicode stays');
	// Surely Zawgyi: its Unicode reading even when that finds nothing either.
	assert.deepEqual(await zawgyiReading('ေကာင္း', read), { q: 'ကောင်း', kind: 'none', zawgyi: { typed: 'ေကာင္း', as: 'ကောင်း' } });
	// An entry as typed is never second-guessed.
	entries.add('ေရ');
	assert.deepEqual(await zawgyiReading('ေရ', read), { q: 'ေရ', kind: 'entry' });
	assert.deepEqual(await zawgyiReading('love', read), { q: 'love', kind: 'none' });
});

function env() {
	const hash = (t) => createHash('sha256').update(t).digest('hex');
	const app = sqlite(MIGRATION);
	app.exec(`INSERT INTO users (id, name, role) VALUES (1, 'Mya', 'member');
		INSERT INTO sessions (id_hash, user_id, expires_at) VALUES ('${hash('member')}', 1, unixepoch() + 3600);`);
	return { APP: d1(app), DATASET: d1(sqlite()), DICTIONARY: d1(sqlite(SAMPLE)), ASSETS: { fetch: async () => new Response('') }, DICT_DB: 'dictionary' };
}

/** @param {any} e @param {string} path @param {any} [body] */
async function call(e, path, body) {
	const headers = { origin: SITE, 'content-type': 'application/json', cookie: '__Host-mo_session=member' };
	const res = await worker.fetch(new Request(`${SITE}${path}`, body === undefined ? { headers } : { method: 'POST', headers, body: JSON.stringify(body) }), e);
	return { status: res.status, body: await res.json() };
}

test('search: a Zawgyi word finds its entry, and the reading says how it was read', async () => {
	const e = env();
	const read = (await call(e, `/api/read?q=${encodeURIComponent('ခ်စ္')}`)).body;
	assert.equal(read.kind, 'entry');
	assert.equal(read.q, 'ချစ်');
	assert.equal(read.result.query, 'ချစ်');
	assert.deepEqual(read.zawgyi, { typed: 'ခ်စ္', as: 'ချစ်' });
	const unicode = (await call(e, `/api/read?q=${encodeURIComponent('ချစ်')}`)).body;
	assert.equal(unicode.zawgyi, undefined);

	// As it is typed, a few letters at a time.
	assert.deepEqual((await call(e, `/api/suggest?q=${encodeURIComponent('ေသာ')}`)).body.words, ['သောက်']);
	assert.deepEqual((await call(e, `/api/suggest?q=${encodeURIComponent('သော')}`)).body.words, ['သောက်']);
});

test('writing: Zawgyi comments, suggestions and messages are refused', async () => {
	const e = env();
	const comment = await call(e, '/api/comments', { lang: 'my', word: 'ချစ်', body: 'ခ်စ္ျခင္းဆိုတာ' });
	assert.equal(comment.status, 400);
	assert.match(comment.body.error.message, /Zawgyi/);
	assert.equal((await call(e, '/api/comments', { lang: 'my', word: 'ချစ်', body: 'ချစ်ခြင်းဆိုတာ' })).status, 200);

	const message = await call(e, '/api/messages', { kind: 'feedback', body: 'ေက်းဇူးတင္ပါတယ္' });
	assert.equal(message.status, 400);
	assert.match(message.body.error.message, /The message looks like Zawgyi/);

	const edit = await call(e, '/api/edits', { lang: 'en', word: 'love', action: 'add', wrte: 1, sense: 'ခ်စ္ျခင္း' });
	assert.equal(edit.status, 400);
	assert.match(edit.body.error.message, /The meaning looks like Zawgyi/);
});
