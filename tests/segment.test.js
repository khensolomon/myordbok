import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chunks, groupWords, spans, syllables } from '../shared/query/segment.js';
import { spacedWords } from '../shared/query/words.js';

test('syllables: finals, stacked consonants, kinzi and creaky tone stay in their syllable', () => {
	assert.deepEqual(syllables('ချစ်ခြင်းမေတ္တာ'), ['ချစ်', 'ခြင်း', 'မေတ္တာ']);
	assert.deepEqual(syllables('ကျွန်တော်'), ['ကျွန်', 'တော်']);
	assert.deepEqual(syllables('မင်္ဂလာ'), ['မင်္ဂ', 'လာ']);
	assert.deepEqual(syllables('ဆယ့်နှစ်'), ['ဆယ့်', 'နှစ်']);
	assert.deepEqual(syllables('အချစ်'), ['အ', 'ချစ်']);
	assert.deepEqual(syllables('၁၂'), ['၁', '၂']);
});

test('spans: every run up to the longest headword', () => {
	assert.deepEqual([...spans(['က', 'ခ', 'ဂ'])], ['က', 'ကခ', 'ကခဂ', 'ခ', 'ခဂ', 'ဂ']);
});

test('words: fewest unknown syllables, then the longest headwords; unknown runs kept together', () => {
	const known = new Set(['ချစ်', 'ချစ်သူ', 'သူ', 'ရေ', 'သောက်']);
	const is = (/** @type {string} */ w) => known.has(w);
	const read = (/** @type {string} */ t) => groupWords(syllables(t), is).map((w) => (w.known ? w.text : `?${w.text}`));
	assert.deepEqual(read('ချစ်သူရေ'), ['ချစ်သူ', 'ရေ']);
	assert.deepEqual(read('ရေသောက်'), ['ရေ', 'သောက်']);
	assert.deepEqual(read('ရေကကသောက်'), ['ရေ', '?ကက', 'သောက်']);
	assert.deepEqual(read(''), []);
});

test('chunks: split at spaces and Myanmar punctuation', () => {
	assert.deepEqual(chunks('ရေသောက်ချင်တယ်။ ထမင်း​စား'), ['ရေသောက်ချင်တယ်', 'ထမင်းစား']);
});

test('spaced words: each once, in order', () => {
	assert.deepEqual(spacedWords('love is good, love is an open door'), ['love', 'is', 'good', 'an', 'open', 'door']);
	assert.deepEqual(spacedWords("don't stop"), ["don't", 'stop']);
});
