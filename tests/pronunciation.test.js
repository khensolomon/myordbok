import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pronunciation } from '../worker/routes/pronunciation.js';

const at = (query) => new URL(`https://myordbok.com/api/pronunciation${query}`);
/** A stand-in for the source: answers with a sound and remembers what was asked. */
function source(answer = () => new Response('mp3', { headers: { 'content-type': 'audio/mpeg' } })) {
	/** @type {string[]} */
	const asked = [];
	return { asked, fetch: /** @type {typeof fetch} */ (async (url) => (asked.push(String(url)), answer())) };
}

test('pronunciation: a word is asked of the source once, and comes back as a sound kept for a month', async () => {
	const s = source();
	const res = await pronunciation(at('?q=love&tl=en'), s.fetch);
	assert.equal(res.status, 200);
	assert.equal(res.headers.get('content-type'), 'audio/mpeg');
	assert.match(res.headers.get('cache-control') ?? '', /^public, max-age=2592000/);
	assert.equal(await res.text(), 'mp3');
	assert.deepEqual(s.asked, ['https://translate.google.com/translate_tts?ie=UTF-8&q=love&tl=en&client=tw-ob']);

	await pronunciation(at(`?q=${encodeURIComponent('ချစ်')}&tl=my`), s.fetch);
	await pronunciation(at('?q=ice%20cream&tl=en'), s.fetch);
	assert.equal(s.asked[1], `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent('ချစ်')}&tl=my&client=tw-ob`);
	assert.match(s.asked[2], /q=ice%20cream&/);
});

test('pronunciation: anything but one short word in en or my is refused before the source is asked', async () => {
	const s = source();
	for (const query of ['', '?q=love', '?tl=en', '?q=love&tl=fr', '?q=love&tl=en&x=1', '?q=love&q=hate&tl=en', '?q=&tl=en', '?q=%20love&tl=en', '?q=a%20%20b&tl=en', '?q=a%0Ab&tl=en', `?q=${'a'.repeat(81)}&tl=en`, '?q=love&tl=en&client=x']) {
		await assert.rejects(pronunciation(at(query), s.fetch), (err) => err.code === 'bad_request', query);
	}
	assert.deepEqual(s.asked, []);
	await pronunciation(at(`?q=${'a'.repeat(80)}&tl=en`), s.fetch);
});

test('pronunciation: a source that refuses, answers with a page, or cannot be reached is "unavailable", said plainly', async () => {
	const cases = [
		() => new Response('Too many', { status: 429, headers: { 'content-type': 'audio/mpeg' } }),
		() => new Response('<html>unusual traffic</html>', { headers: { 'content-type': 'text/html' } }),
		() => {
			throw new TypeError('network');
		},
	];
	const errors = console.error;
	console.error = () => {};
	try {
		for (const answer of cases) {
			await assert.rejects(pronunciation(at('?q=love&tl=en'), source(answer).fetch), (err) => err.code === 'unavailable' && /pronunciation service/.test(err.message));
		}
	} finally {
		console.error = errors;
	}
});
