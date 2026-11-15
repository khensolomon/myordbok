import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { MY } from '../app/i18n/my.js';
import { interfaceKeys } from './helpers/i18n-keys.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const keys = interfaceKeys(root);
const holes = (/** @type {string} */ s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test('every interface text has its Myanmar', () => {
	const missing = [...keys].filter(([k]) => !(k in MY)).map(([k, file]) => `${file}: ${k}`);
	assert.deepEqual(missing, []);
});

test('app/i18n/my.js holds no text the app no longer uses', () => {
	assert.deepEqual(Object.keys(MY).filter((k) => !keys.has(k)), []);
});

test('each Myanmar text has the same placeholders as its English', () => {
	const wrong = Object.entries(MY).filter(([en, my]) => holes(en).join() !== holes(my).join());
	assert.deepEqual(wrong, []);
});

test('no text is given its Myanmar twice: the later one would silently win', async () => {
	const { readFile } = await import('node:fs/promises');
	const source = await readFile(new URL('../app/i18n/my.js', import.meta.url), 'utf8');
	const seen = new Map();
	for (const m of source.matchAll(/^\t(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|(\w+)):/gm)) {
		const key = m[1] ?? m[2] ?? m[3];
		seen.set(key, (seen.get(key) ?? 0) + 1);
	}
	assert.ok(seen.size > 500, 'the keys are found');
	assert.deepEqual([...seen].filter(([, n]) => n > 1).map(([k]) => k), []);
});

test('every icon named as text exists: a section, a card or a guide names its icon by key', async () => {
	const { ICONS } = await import('../app/core/icons.js');
	const { readFile } = await import('node:fs/promises');
	const guide = await readFile(new URL('../app/reader/guide.js', import.meta.url), 'utf8');
	const ways = /const WAYS = [\s\S]*?\n\]\);?\n/.exec(guide)?.[0] ?? '';
	const named = [...ways.matchAll(/\[\s*'(\w+)',\s*mark\(/g)].map((m) => m[1]);
	assert.ok(named.length >= 4, 'the guide names its icons');
	assert.deepEqual(named.filter((n) => !(n in ICONS)), []);
});

test('the Myanmar interface is open or paused in both places at once', async () => {
	const { readFileSync } = await import('node:fs');
	const { MYANMAR_OPEN } = await import('../app/i18n/index.js');
	const head = /var open=(true|false),/.exec(readFileSync(`${root}app/index.html`, 'utf8'));
	assert.ok(head, 'app/index.html: the line in <head> holds var open=true or var open=false');
	assert.equal(head[1], String(MYANMAR_OPEN), 'app/index.html says open=… and app/i18n/index.js MYANMAR_OPEN the other; change both');
});

test('paused: English for every device; ?ui=my turns Myanmar on for a reviewer, ?ui=en off', async () => {
	const { MYANMAR_OPEN, chosenLang } = await import('../app/i18n/index.js');
	if (MYANMAR_OPEN) return;
	const store = new Map([['mo:lang', 'my']]);
	const g = /** @type {any} */ (globalThis);
	const before = { location: g.location, localStorage: g.localStorage, history: g.history, navigator: Object.getOwnPropertyDescriptor(g, 'navigator') };
	Object.defineProperty(g, 'navigator', { configurable: true, value: { languages: ['my-MM'], language: 'my-MM' } });
	g.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
	g.history = { state: null, replaceState: (_s, _t, url) => (g.location = { href: String(url) }) };
	try {
		g.location = { href: 'https://myordbok.com/definition?q=love' };
		assert.equal(chosenLang(), 'en', 'a Myanmar device with an earlier choice of Myanmar still gets English');
		g.location = { href: 'https://myordbok.com/definition?q=love&ui=my' };
		assert.equal(chosenLang(), 'my');
		assert.equal(g.location.href, 'https://myordbok.com/definition?q=love', 'the word leaves the address');
		assert.equal(chosenLang(), 'my', 'and stays on this device');
		g.location = { href: 'https://myordbok.com/?ui=en' };
		assert.equal(chosenLang(), 'en');
		g.location = { href: 'https://myordbok.com/workspace/searches?lang=my' };
		assert.equal(chosenLang(), 'en', 'the workspace filter ?lang= is not the switch');
	} finally {
		g.location = before.location;
		g.localStorage = before.localStorage;
		g.history = before.history;
		if (before.navigator) Object.defineProperty(g, 'navigator', before.navigator);
	}
});
