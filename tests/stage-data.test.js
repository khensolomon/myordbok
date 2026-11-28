// @ts-check
/** What the Liked and Practice stages show, from data alone. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byStage, comingUp, findChips, likedChips, practiceChips } from '../app/reader/stage-data.js';

const pos = (/** @type {string} */ t) => t.toLowerCase();
const WORDS = { entry: 'Whole entry', gone: 'No longer in the dictionary' };

test('liked chips: newest first, a meaning by its id, an entry by its word, Updated marked', () => {
	const chips = likedChips(
		[
			{ lang: 'en', word: 'love', value: 1, at: 10 },
			{ dict: 'emd', sense_id: 7, value: 1, at: 30, word: 'het up', type: 'Adjective', sense: 'x', state: 'changed' },
			{ dict: 'emd', sense_id: 9, value: -1, at: 20, word: null, type: null, sense: null, state: 'gone' },
		],
		pos,
		WORDS,
	);
	assert.deepEqual(chips.map((c) => c.id), ['emd:7', 'emd:9', 'e:en:love']);
	assert.equal(chips[0].marked, true);
	assert.equal(chips[0].note, 'adjective');
	assert.equal(chips[1].note, WORDS.gone);
	assert.equal(chips[1].value, 'down');
	assert.equal(chips[2].note, WORDS.entry);
});

const note = (/** @type {any} */ stage, /** @type {number} */ days) => `${stage}:${days}`;
const progress = { words: { creation: { box: 1, due: 100, seen: 1 }, 'het up': { box: 1, due: 103, seen: 2 }, trojan: { box: 3, due: 121, seen: 4 }, zeal: { box: 0, due: 99, seen: 1 } }, streak: 2, last: 99 };

test('practice chips: the new first, then the due by day, then the rest; stages by box and day', () => {
	const chips = practiceChips(progress, 100, ['stocking'], note);
	assert.deepEqual(chips.map((c) => c.word), ['stocking', 'zeal', 'creation', 'het up', 'trojan']);
	assert.deepEqual(chips.map((c) => c.stage), ['new', 'due', 'due', 'learning', 'learned']);
	assert.equal(chips[1].note, 'due:-1');
	assert.equal(chips[3].note, 'learning:3');
	assert.deepEqual(chips.map((c) => Boolean(c.dim)), [false, false, false, true, true]);
});

test('filters: Due holds the due and the new; find matches any part of the word', () => {
	const chips = practiceChips(progress, 100, ['stocking'], note);
	assert.deepEqual(byStage(chips, 'due').map((c) => c.word), ['stocking', 'zeal', 'creation']);
	assert.deepEqual(byStage(chips, 'learned').map((c) => c.word), ['trojan']);
	assert.deepEqual(findChips(chips, 'ION').map((c) => c.word), ['creation']);
	assert.equal(findChips(chips, '  ').length, chips.length);
});

test('coming up: words counted into the next review days', () => {
	assert.deepEqual(comingUp(progress, 100), [
		{ inDays: 1, count: 0 },
		{ inDays: 3, count: 1 },
		{ inDays: 7, count: 0 },
		{ inDays: 21, count: 1 },
	]);
});
