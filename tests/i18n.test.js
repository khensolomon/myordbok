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
