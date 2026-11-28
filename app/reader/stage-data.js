// @ts-check
/**
 * What the Liked and Practice stages show (reader/stage.js), worked out
 * from data alone, so it is tested without a browser: the chips of the
 * strip, their filters, and what Practice says about the days ahead.
 */
import { LEARNED_BOX, REVIEW_DAYS } from '#shared/quiz.js';

/**
 * @typedef {object} Chip
 * @property {string} id  Stable within the strip (the address's `w`).
 * @property {string} word
 * @property {string} lang  'en' | 'my'
 * @property {string} note  The second line: part of speech, or a stage and a day.
 * @property {boolean} [marked]  A dot: changed since rated (Liked); due today (Practice).
 * @property {boolean} [dim]  Not in the current set (Practice: not due).
 * @property {'up' | 'down'} [value]  Liked: how it was rated.
 * @property {'new' | 'due' | 'learning' | 'learned'} [stage]
 * @property {number} [due]  Practice: the day it comes back.
 * @property {number} [box]
 */

const MYANMAR = /[က-႟]/;

/**
 * Liked: one chip per rated entry or meaning, newest first. A meaning's id
 * is dict:sense_id; an entry's is the word, so the address names it.
 * @param {Array<import('../data/api.js').RatedEntry | import('../data/api.js').RatedSense>} items
 * @param {(type: string) => string} posName
 * @param {{ entry: string, gone: string }} words  Texts: "Whole entry", "No longer in the dictionary".
 * @returns {Chip[]}
 */
export function likedChips(items, posName, words) {
	return [...items]
		.sort((a, b) => b.at - a.at)
		.map((it) => {
			const value = it.value === 1 ? 'up' : 'down';
			if ('lang' in it) return { id: `e:${it.lang}:${it.word}`, word: it.word, lang: it.lang, note: words.entry, value };
			const word = it.word ?? '';
			return {
				id: `${it.dict}:${it.sense_id}`,
				word,
				lang: MYANMAR.test(word) ? 'my' : 'en',
				note: it.state === 'gone' ? words.gone : it.type ? posName(it.type) : '',
				marked: it.state === 'changed',
				value,
			};
		});
}

/**
 * Practice: every word the learner has, by stage, the due ones first,
 * then the rest by their day; recent searches not yet practised come
 * first of all, as new.
 * @param {import('#shared/quiz.js').Progress} progress
 * @param {number} today
 * @param {string[]} fresh  Recent English searches not in the progress.
 * @param {(stage: Chip['stage'], days: number, box: number) => string} note  The second line's text.
 * @returns {Chip[]}
 */
export function practiceChips(progress, today, fresh, note) {
	/** @type {Chip[]} */
	const out = fresh.map((w) => ({ id: w, word: w, lang: 'en', note: note('new', 0, 0), stage: 'new', due: today, box: 0, marked: true }));
	const rest = Object.entries(progress.words).map(([word, w]) => {
		const stage = /** @type {Chip['stage']} */ (w.due <= today ? 'due' : w.box >= LEARNED_BOX ? 'learned' : 'learning');
		return { id: word, word, lang: 'en', note: note(stage, w.due - today, w.box), stage, due: w.due, box: w.box, marked: stage === 'due', dim: stage !== 'due' };
	});
	rest.sort((a, b) => (a.stage === 'due') === (b.stage === 'due') ? a.due - b.due || a.word.localeCompare(b.word) : a.stage === 'due' ? -1 : 1);
	return [...out, ...rest];
}

/**
 * How many words come back on each of the next review days (tomorrow, in
 * 3, 7 and 21 days), for "what is coming".
 * @param {import('#shared/quiz.js').Progress} progress
 * @param {number} today
 * @returns {Array<{ inDays: number, count: number }>}
 */
export function comingUp(progress, today) {
	const marks = [1, ...REVIEW_DAYS.filter((d) => d > 1)];
	return marks.map((inDays, i) => {
		const from = i === 0 ? 1 : marks[i - 1] + 1;
		const count = Object.values(progress.words).filter((w) => w.due - today >= from && w.due - today <= inDays).length;
		return { inDays, count };
	});
}

/**
 * The chips whose word holds the text typed (any part, case aside).
 * @param {Chip[]} chips
 * @param {string} q
 */
export function findChips(chips, q) {
	const needle = q.trim().toLowerCase();
	if (!needle) return chips;
	return chips.filter((c) => c.word.toLowerCase().includes(needle));
}

/**
 * The stage a Practice filter shows: Due holds the due and the new; the
 * others their own.
 * @param {Chip[]} chips
 * @param {'due' | 'learning' | 'learned'} filter
 */
export function byStage(chips, filter) {
	return chips.filter((c) => (filter === 'due' ? c.stage === 'due' || c.stage === 'new' : c.stage === filter));
}
