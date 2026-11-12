import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newSealKey, seal, unseal } from '../app/data/seal.js';

test('seal: answers are random bytes under a device key that cannot be exported, and come back whole', async () => {
	const key = await newSealKey();
	assert.equal(key.extractable, false);
	await assert.rejects(crypto.subtle.exportKey('raw', key), 'the key cannot be read out');
	const answer = { entries: [{ word: 'love', sense: 'ချစ်ခြင်း' }], forms_of: [] };
	const a = await seal(key, answer);
	const b = await seal(key, answer);
	assert.ok(a instanceof Uint8Array);
	assert.ok(!Buffer.from(a).toString('utf8').includes('love'), 'nothing of it reads as text');
	assert.notDeepEqual(a, b, 'a new IV each time');
	assert.deepEqual(await unseal(key, a), answer);
	assert.deepEqual(await unseal(key, a.buffer), answer, 'as IndexedDB may hand it back');
	assert.deepEqual(await unseal(key, answer), answer, 'a plain value kept before sealing passes through');
	await assert.rejects(unseal(await newSealKey(), a), 'another device’s key does not open it');
});
