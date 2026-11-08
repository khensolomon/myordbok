import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bestSense, composeMyanmar, planPhrase, plainGloss } from '../shared/query/phrase.js';

test('plan: X of Y and pairs, articles left out', () => {
	assert.deepEqual(planPhrase('king of Denmark'), { pattern: 'of', terms: ['king', 'Denmark'], head: 0 });
	assert.deepEqual(planPhrase('the capital of the Netherlands'), { pattern: 'of', terms: ['capital', 'Netherlands'], head: 0 });
	assert.deepEqual(planPhrase('big house'), { pattern: 'pair', terms: ['big', 'house'], head: 1 });
	assert.equal(planPhrase('love'), null);
	assert.equal(planPhrase('love is good, love is an open door'), null);
	assert.equal(planPhrase('a big old house'), null, 'three parts without "of"');
	assert.equal(planPhrase('of Denmark'), null);
	assert.equal(planPhrase('1 of 2'), null);
});

test('plain gloss: no labels, notes or alternatives', () => {
	assert.equal(plainGloss('[type:computing] AI (artificial intelligence); ကွန်ပျူတာ'), 'AI');
	assert.equal(plainGloss('ဘုရင်; မင်း'), 'ဘုရင်');
	assert.equal(plainGloss('<ချစ်>သည်'), 'ချစ်သည်');
});

const king = [
	{ type: 'Noun', kind: 'Active', sense: 'အကောင်းဆုံးသူ', example: 'the king of jazz' },
	{ type: 'Noun', kind: 'Active', sense: 'ဘုရင်', example: 'the King of Spain' },
];

test('best sense: the example with the same pattern, else the expected part of speech', () => {
	assert.equal(bestSense(king, { word: 'king', pattern: 'of', role: 'head' }), king[0], 'a thing after "of": the king of jazz');
	assert.equal(bestSense(king, { word: 'king', pattern: 'of', role: 'head', proper: true }), king[1], 'a name after "of": the King of Spain');
	assert.equal(bestSense([king[1]], { word: 'king', pattern: 'of', role: 'head' }), king[1]);
	const big = [{ type: 'Verb', kind: 'Active', sense: 'x', example: null }, { type: 'Adjective', kind: 'Active', sense: 'ကြီးသော', example: null }];
	assert.equal(bestSense(big, { word: 'big', pattern: 'pair', role: 'modifier' }), big[1]);
	assert.equal(bestSense([], { word: 'x', pattern: 'pair', role: 'head' }), null);
});

test('Myanmar order, a country without နိုင်ငံ when it describes', () => {
	const country = { type: 'Noun', kind: 'Country', sense: 'ဒိန်းမတ်နိုင်ငံ', example: null };
	assert.equal(composeMyanmar(planPhrase('king of Denmark'), [king[1], country]), 'ဒိန်းမတ် ဘုရင်');
	const big = { type: 'Adjective', kind: 'Active', sense: 'ကြီးသော', example: null };
	const house = { type: 'Noun', kind: 'Active', sense: 'အိမ်', example: null };
	assert.equal(composeMyanmar(planPhrase('big house'), [big, house]), 'ကြီးသော အိမ်');
	assert.equal(composeMyanmar(planPhrase('big house'), [big, null]), null);
});
