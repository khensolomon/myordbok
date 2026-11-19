import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayOf, dueWords, learnedCount, makeQuestions, otherWords, readProgress, recordRound, noProgress, reviewed, streakOf } from '../shared/quiz.js';

/** A fixed order instead of chance. */
const fixed = () => 0;

/**
 * @param {string} query
 * @param {Array<[string, string, string, (string | null)?]>} senses  [type, kind, sense, example]
 * @param {object} [more]
 */
function result(query, senses, more = {}) {
	return {
		query,
		language: /** @type {'en'} */ ('en'),
		entries: senses.map(([type, kind, sense, example = null]) => ({ word: query, type, kind, sense, example })),
		variant_of: [],
		forms_of: [],
		root_senses: {},
		forms: [],
		synonyms: [],
		similar: [],
		broader: [],
		opposite: [],
		related: [],
		...more,
	};
}

const love = result(
	'love',
	[
		['Noun', 'Active', 'ချစ်ခြင်း | ချစ်ခင်မှု | [en:a strong feeling of liking]', 'a mother’s love'],
		['Verb', 'Active', 'ချစ်သည် | [en:to like very much]', '<love/loved/loved> | She loves her <family>.'],
		['Verb', 'Draft', 'အလွန်နှစ်သက်သည်', null],
	],
	{
		forms: [['loves', 'noun', 'plural'], ['loves', 'verb', 'third person'], ['loved', 'verb', 'past'], ['loved', 'verb', 'past participle'], ['loving', 'verb', '-ing']],
		synonyms: ['adore'],
		opposite: ['hate'],
		related: ['affection', 'lovable', 'love affair'],
	},
);
const others = [
	result('hate', [['Verb', 'Active', 'မုန်းသည်']]),
	result('affection', [['Noun', 'Active', 'ချစ်ခင်မှု']]), // the same as one of love's: never offered
	result('school', [['Noun', 'Active', 'ကျောင်း']]),
	result('water', [['Noun', 'Active', 'ရေ'], ['Verb', 'Active', 'ရေလောင်းသည်']]),
	result('family', [['Noun', 'Active', 'မိသားစု']]),
	result('draft', [['Noun', 'Draft', 'မူကြမ်း']]), // nothing reviewed
];

test('quiz: only reviewed senses, glosses as plain text, the English explanation apart', () => {
	const r = reviewed(result('x', [['Noun', 'Active', '[type:informal] <love> အရောင် | [US:color] | [en:a colour]'], ['Noun', 'Draft', 'ရေ']]));
	assert.deepEqual(r, [{ type: 'Noun', glosses: ['love အရောင်'], explained: 'a colour', example: null }]);
});

test('quiz: other words leave out the word, its forms and words close in meaning', () => {
	assert.deepEqual(otherWords(love, ['Love', 'adore', 'school', 'ချစ်', 'a very long phrase here']), ['hate', 'affection', 'lovable', 'love affair', 'school']);
});

test('quiz: which one means the word: its meaning and others’, never one it has', () => {
	const [q] = makeQuestions(love, others, { random: fixed, kinds: ['en-my'] });
	assert.equal(q.kind, 'en-my');
	assert.equal(q.prompt, 'love');
	assert.equal(q.choices.filter((c) => c.right).length, 1);
	assert.equal(q.choices.find((c) => c.right)?.text, 'ချစ်ခြင်း');
	const texts = q.choices.map((c) => c.text);
	assert.ok(!texts.includes('ချစ်ခင်မှု'), 'affection’s meaning is also love’s');
	assert.ok(!texts.includes('မူကြမ်း'), 'a draft is never a choice');
	// Nouns first, as love's first sense is one: the ending gives nothing away.
	assert.deepEqual(texts.sort(), ['ကျောင်း', 'ချစ်ခြင်း', 'မိသားစု', 'ရေ'].sort());
	assert.deepEqual(q.choices.map((c) => c.word).sort(), ['family', 'love', 'school', 'water']);
});

test('quiz: a Myanmar meaning back to English, from another sense than the first question', () => {
	const [q] = makeQuestions(love, others, { random: fixed, kinds: ['my-en'] });
	assert.equal(q.kind, 'my-en');
	assert.equal(q.prompt, 'ချစ်သည်');
	assert.equal(q.choices.find((c) => c.right)?.text, 'love');
	assert.ok(q.choices.some((c) => c.text === 'hate' && c.note === 'မုန်းသည်'), 'a verb first');
	assert.equal(q.choices.length, 4);
});

test('quiz: too few other words make no meaning question', () => {
	assert.deepEqual(makeQuestions(love, others.slice(0, 2), { kinds: ['en-my', 'my-en'] }), []);
	assert.deepEqual(makeQuestions(result('x', [['Noun', 'Draft', 'ရေ']]), others), []);
});

test('quiz: a gap offers only forms that cannot fit it', () => {
	const [q] = makeQuestions(love, others, { random: fixed, kinds: ['gap'] });
	assert.equal(q.kind, 'gap');
	assert.equal(q.before, 'She ');
	assert.equal(q.after, ' her family.');
	// "She loved her family" fits too, so loved is not offered.
	assert.deepEqual(q.choices.map((c) => c.text).sort(), ['love', 'loves', 'loving']);
	assert.equal(q.choices.find((c) => c.right)?.text, 'loves');
	assert.equal(q.choices.find((c) => c.text === 'loving')?.note, '-ing');
});

test('quiz: a gap needs a word before it that decides the form', () => {
	const go = result('go', [['Verb', 'Active', 'သွားသည်', '<go/went/gone> | Every day we go to school. | Buses go slowly.']], {
		forms: [['went', 'verb', 'past'], ['gone', 'verb', 'past participle'], ['goes', 'verb', 'third person'], ['going', 'verb', '-ing']],
	});
	const [q] = makeQuestions(go, [], { random: fixed, kinds: ['gap'] });
	assert.equal(q.before, 'Every day we ');
	assert.deepEqual(q.choices.map((c) => c.text).sort(), ['go', 'goes', 'going', 'gone']);
	const none = result('go', [['Verb', 'Active', 'သွားသည်', 'Buses go slowly.']], { forms: go.forms });
	assert.deepEqual(makeQuestions(none, [], { kinds: ['gap'] }), []);
});

test('quiz: rounds move a word along the days, and the streak counts days in a row', () => {
	let p = noProgress();
	p = recordRound(p, 'Love', true, 100);
	assert.deepEqual(p.words.love, { box: 1, due: 101, seen: 1 });
	assert.equal(p.streak, 1);
	p = recordRound(p, 'love', true, 101);
	assert.deepEqual(p.words.love, { box: 2, due: 104, seen: 2 });
	assert.equal(p.streak, 2);
	assert.equal(learnedCount(p), 1);
	p = recordRound(p, 'go', false, 101);
	assert.deepEqual(p.words.go, { box: 0, due: 102, seen: 1 });
	assert.equal(p.streak, 2, 'a second round the same day');
	assert.deepEqual(dueWords(p, 102), ['go']);
	assert.deepEqual(dueWords(p, 104), ['go', 'love']);
	assert.equal(streakOf(p, 102), 2);
	assert.equal(streakOf(p, 103), 0);
	p = recordRound(p, 'love', true, 110);
	assert.equal(p.streak, 1, 'a missed day starts it again');
	for (const d of [111, 112, 113]) p = recordRound(p, 'love', true, d);
	assert.equal(p.words.love.box, 4, 'no further than the last box');
	assert.equal(p.words.love.due, 113 + 21);
});

test('quiz: progress read back from storage keeps only what is well formed', () => {
	assert.deepEqual(readProgress(null), noProgress());
	assert.deepEqual(readProgress({ words: { a: { box: 1, due: 5, seen: 1 }, b: { box: 'x' } }, streak: 3, last: 4 }), { words: { a: { box: 1, due: 5, seen: 1 } }, streak: 3, last: 4 });
	assert.equal(dayOf(new Date(Date.UTC(1970, 0, 2, 12) + new Date(Date.UTC(1970, 0, 2, 12)).getTimezoneOffset() * 60000)), 1);
});

test('quiz: two devices’ progress made one', async () => {
	const { mergeProgress } = await import('../shared/quiz.js');
	const phone = { words: { love: { box: 2, due: 110, seen: 3 }, go: { box: 0, due: 101, seen: 1 } }, streak: 4, last: 100 };
	const laptop = { words: { love: { box: 1, due: 102, seen: 1 }, go: { box: 1, due: 104, seen: 1 }, big: { box: 1, due: 103, seen: 1 } }, streak: 1, last: 101 };
	const both = mergeProgress(phone, laptop);
	assert.deepEqual(both.words.love, phone.words.love, 'more rounds');
	assert.deepEqual(both.words.go, laptop.words.go, 'a tie: the later return');
	assert.deepEqual(both.words.big, laptop.words.big);
	assert.deepEqual([both.streak, both.last], [1, 101], 'the streak of the later round');
	assert.deepEqual(mergeProgress(laptop, phone), both, 'either way round');
	assert.deepEqual(mergeProgress(noProgress(), phone), phone);
});
