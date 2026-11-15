import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import worker from '../worker/index.js';
import { SUMMARY_GLOSSES, SUMMARY_SENSES, entrySummary, summaryText } from '../shared/summary.js';
import { MARKS, movedTo, writePage } from '../worker/routes/page.js';
import { MIGRATION, SAMPLE, d1, sqlite } from './helpers/d1.js';

const SITE = 'https://myordbok.test';
const SHELL = await readFile(new URL('../app/index.html', import.meta.url), 'utf8');
const hash = (t) => createHash('sha256').update(t).digest('hex');

function env(more = {}) {
	const app = sqlite(MIGRATION);
	app.exec(`INSERT INTO users (id, name, email, role) VALUES (3, 'Ad', 'a@example.com', 'admin'); INSERT INTO sessions (id_hash, user_id, expires_at) VALUES ('${hash('admin')}', 3, unixepoch() + 3600);`);
	const asked = [];
	return {
		asked,
		APP: d1(app),
		BETA: d1(sqlite()),
		LIVE: d1(sqlite(SAMPLE)),
		DICT_DB: 'live',
		ASSETS: { fetch: async (r) => (asked.push(new URL(r.url).pathname), new Response(SHELL, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' } })) },
		...more,
	};
}
const page = async (e, path) => {
	const res = await worker.fetch(new Request(`${SITE}${path}`, { redirect: 'manual' }), e);
	const html = await res.text();
	return { status: res.status, html, headers: res.headers, title: /<title>(.*?)<\/title>/.exec(html)?.[1], main: /<main id="view" tabindex="-1">(.*?)<\/main>/s.exec(html)?.[1], noindex: html.includes('<meta name="robots" content="noindex">'), canonical: /<link rel="canonical" href="([^"]*)">/.exec(html)?.[1] ?? null };
};

test('summary: the parts of speech once, then the first meanings as one run of plain words', () => {
	const sense = (type, text) => ({ id: 1, word: 'run', type, kind: 'Active', sense: text, example: 'an example never shown' });
	const s = entrySummary({
		query: 'run',
		language: 'en',
		entries: [
			sense('Verb', '[type:informal] ပြေးသည်; <လည်ပတ်သည်> (~ sth)'),
			sense('Noun', 'အပြေး'),
			...Array.from({ length: 8 }, (_, i) => sense('Verb', `ကြိယာ${i}`)),
			sense('Noun', 'ပြေးသည်'), // said already
		],
	});
	assert.deepEqual(s.parts, ['verb', 'noun']);
	// Verb: its first five meanings (the first gives two words), then the noun's; labels, patterns and brackets are gone.
	assert.deepEqual(s.glosses, ['ပြေးသည်', 'လည်ပတ်သည်', 'ကြိယာ0', 'ကြိယာ1', 'ကြိယာ2', 'ကြိယာ3', 'အပြေး']);
	assert.equal(SUMMARY_SENSES, 5);
	assert.deepEqual(summaryText(s), { title: 'run: ပြေးသည်, လည်ပတ်သည်, ကြိယာ0', sentence: '“run” in Myanmar (verb, noun): ပြေးသည်, လည်ပတ်သည်, ကြိယာ0, ကြိယာ1, ကြိယာ2, ကြိယာ3, အပြေး' });

	const many = entrySummary({ query: 'w', language: 'en', entries: Array.from({ length: 5 }, (_, i) => sense('Noun', Array.from({ length: 6 }, (_, j) => `g${i}-${j}`).join('; '))) });
	assert.equal(many.glosses.length, SUMMARY_GLOSSES);
	assert.equal(entrySummary({ query: 'w', language: 'en', entries: [sense('Noun', '[see:x]')] }), null, 'nothing plain to say');
});

test('page: an entry is written into the page as one sentence, and nothing more of it', async () => {
	const e = env();
	const love = await page(e, '/definition?q=love');
	assert.equal(love.status, 200);
	assert.deepEqual(e.asked, ['/'], 'the app’s own page is what is written into');
	assert.equal(love.title, 'love: ချစ်ခြင်း, ချစ်ခင်မှု, ချစ်သူ · MyOrdbok');
	assert.equal(love.main, '<article class="page entry-summary"><h1 lang="en">love</h1><p>“love” in Myanmar (noun, verb): ချစ်ခြင်း, ချစ်ခင်မှု, ချစ်သူ, ချစ်သည်, အလွန်နှစ်သက်သည်</p></article>');
	assert.equal(love.canonical, `${SITE}/definition?q=love`);
	assert.equal(love.noindex, false);
	assert.match(love.html, /<meta name="description" content="“love” in Myanmar \(noun, verb\): ချစ်ခြင်း, [^"]*">/);
	assert.match(love.html, /<meta property="og:title" content="love: ချစ်ခြင်း, ချစ်ခင်မှု, ချစ်သူ">/);
	for (const kept of ['first love', 'mother', 'informal', 'awaiting', 'Draft', 'loves', 'family']) assert.ok(!love.main.includes(kept) && !love.html.includes(`${kept}"`), `${kept} stays in the app`);
	assert.equal(love.html.length - SHELL.length < 1500, true, 'a few lines, not the entry');

	// Whatever the capitals or the extras in the address, one address is indexed.
	assert.equal((await page(e, '/definition?q=LOVE&asked=what%20is%20love')).canonical, `${SITE}/definition?q=LOVE`.replace('LOVE', 'love'));
	// A Myanmar entry reads into English.
	const my = await page(e, `/definition?q=${encodeURIComponent('ချစ်')}`);
	assert.match(my.main, /<h1 lang="my">ချစ်<\/h1><p>“ချစ်” in English \(verb\): /);
	// A form of another word says so.
	const went = await page(e, '/definition?q=went');
	assert.equal(went.status, 200);
	assert.match(went.main, /<p>“went”: .+ of “go”<\/p>/);
	assert.equal(went.noindex, false);
});

test('page: what is no entry is sent as it is, and not indexed', async () => {
	const e = env();
	const none = await page(e, '/definition?q=zzzz');
	assert.equal(none.status, 404);
	assert.deepEqual([none.noindex, none.main, none.canonical, none.title], [true, '', null, 'zzzz · MyOrdbok']);
	for (const q of ['10% of 70', '12345', 'the love of water', 'synonyms of love']) {
		const p = await page(e, `/definition?q=${encodeURIComponent(q)}`);
		assert.deepEqual([p.status, p.noindex, p.main], [200, true, ''], q);
	}
	// How to search, with no word: the page untouched.
	const guide = await page(e, '/definition');
	assert.equal(guide.html, SHELL);
	// Text from the address is written as text.
	const sly = await page(e, `/definition?q=${encodeURIComponent('"><script>alert(1)</script>')}`);
	assert.ok(!sly.html.includes('<script>alert(1)'));
	assert.match(sly.title, /&#34;&#62;&#60;script&#62;/);
});

test('page: the same limit as the API, beta never indexed, a failure never in the way of reading', async () => {
	const limited = env({ API_GUARD: '1', RATE_HEAVY: { limit: async () => ({ success: false }) }, RATE_LOOKUP: { limit: async () => ({ success: true }) } });
	assert.equal((await page(limited, '/definition?q=love')).html, SHELL, 'over the limit: the page as it is');
	const within = env({ API_GUARD: '1', RATE_HEAVY: { limit: async () => ({ success: true }) }, RATE_LOOKUP: { limit: async () => ({ success: true }) } });
	assert.match((await page(within, '/definition?q=love')).main, /entry-summary/);

	assert.equal((await page(env({ ENV_NAME: 'beta', DICT_DB: 'live' }), '/definition?q=love')).headers.get('x-robots-tag'), 'noindex');
	assert.equal((await page(env(), '/definition?q=love')).headers.get('x-robots-tag'), null);

	// The dictionary cannot be read: the page still goes out, as it is.
	const broken = env({ LIVE: d1(sqlite()) });
	const out = await page(broken, '/definition?q=love');
	assert.deepEqual([out.status, out.html], [200, SHELL]);
	// A page file that lost a mark stops the writing, not the page.
	assert.throws(() => writePage(SHELL.replace(MARKS.title, '<title>Other</title>'), { title: 't', description: null, canonical: null, index: false, body: null }), /holds <title>MyOrdbok<\/title> 0 times/);
});

test('page: a live edit is in the sentence as it is in the entry', async () => {
	const e = env();
	const res = await worker.fetch(new Request(`${SITE}/api/edits`, { method: 'POST', headers: { origin: SITE, 'content-type': 'application/json', cookie: '__Host-mo_session=admin' }, body: JSON.stringify({ lang: 'en', word: 'love', action: 'edit', sense_id: 1, field: 'sense', value: 'မေတ္တာ' }) }), e);
	assert.equal(res.status, 201);
	assert.match((await page(e, '/definition?q=love')).main, /\(noun, verb\): မေတ္တာ, ချစ်သူ/);
});

test('addresses of the earlier site lead to where they live now', async () => {
	assert.deepEqual(['/dictionary', '/dictionary/', '/dictionary/norwegian', '/cookie-policy', '/health', '/definition', '/about', '/dictionaryx'].map(movedTo), ['/', '/', '/', '/privacy', '/api/health', null, null, null]);
	const e = env();
	const res = await worker.fetch(new Request(`${SITE}/cookie-policy`, { redirect: 'manual' }), e);
	assert.deepEqual([res.status, res.headers.get('location')], [301, `${SITE}/privacy`]);
	assert.deepEqual(e.asked, []);
});
