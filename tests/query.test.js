import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classify } from '../shared/query/classify.js';
import { dateWords, timeWords } from '../shared/query/clock.js';
import { calculate, formatNumber, MathError, percentPhrase, shares } from '../shared/query/math.js';

/** [typed, expected subset] */
const CASES = [
	['', { kind: 'empty' }],
	['   ', { kind: 'empty' }],

	// numbers
	['1', { kind: 'number', value: '1' }],
	['101', { kind: 'number', value: '101' }],
	['1000', { kind: 'number', value: '1000' }],
	['10000', { kind: 'number', value: '10000' }],
	['10010', { kind: 'number', value: '10010' }],
	['10,010', { kind: 'number', value: '10010' }],
	['၁၀၁', { kind: 'number', value: '101' }],
	['-2.5', { kind: 'number', value: '-2.5' }],
	['တစ်ရာ့တစ်', { kind: 'number', value: '101', source: 'my-words' }],
	['one hundred and one', { kind: 'number', value: '101', source: 'en-words' }],
	['twenty-five', { kind: 'number', value: '25' }],

	// single number words are dictionary entries
	['one', { kind: 'lookup', word: 'one', understood: false }],
	['တစ်', { kind: 'lookup', word: 'တစ်', understood: false }],

	// maths
	['1+1', { kind: 'math', value: 2 }],
	['x= 5x1', { kind: 'math', value: 5 }],
	['what is 2 * (3 + 4)', { kind: 'math', value: 14 }],
	['10 percentage of 70', { kind: 'math', value: 7 }],
	['10% of 70', { kind: 'math', value: 7 }],
	['70 + 10%', { kind: 'math', value: 77 }],
	['10 mod 3', { kind: 'math', value: 1 }],
	['၅ x ၂', { kind: 'math', value: 10 }],
	['15 is what percent of 60', { kind: 'math', value: 25 }],
	['10 % 19', { kind: 'ask' }],
	['20, 30, 50 percentage', { kind: 'shares', total: 100, shares: [20, 30, 50] }],
	['percentage of 1 and 3', { kind: 'shares', shares: [25, 75] }],
	['5 / 0', { kind: 'problem' }],
	['(1 + 2', { kind: 'problem' }],

	// time and date
	['what time it is', { kind: 'time' }],
	['what time is it?', { kind: 'time' }],
	['time now', { kind: 'time' }],
	['what is the date', { kind: 'date' }],
	['what day is it', { kind: 'date' }],

	// questions around a word
	['tell me what is love', { kind: 'lookup', word: 'love', focus: null, understood: true }],
	['explain love', { kind: 'lookup', word: 'love', focus: null, understood: true }],
	['what is love', { kind: 'lookup', word: 'love', focus: null, understood: true }],
	['What is Love?', { kind: 'lookup', word: 'Love', understood: true }],
	['meaning of serendipity', { kind: 'lookup', word: 'serendipity', understood: true }],
	['define a cat', { kind: 'lookup', word: 'cat', understood: true }],
	['what is the similar word of love', { kind: 'lookup', word: 'love', focus: 'synonyms' }],
	['synonyms for happy', { kind: 'lookup', word: 'happy', focus: 'synonyms' }],
	['opposite of hot', { kind: 'lookup', word: 'hot', focus: 'opposite' }],
	['past tense of go', { kind: 'lookup', word: 'go', focus: 'forms' }],
	['plural of mouse', { kind: 'lookup', word: 'mouse', focus: 'forms' }],
	['အချစ် ဆိုတာ ဘာလဲ', { kind: 'lookup', word: 'အချစ်', understood: true }],
	['အချစ်ရဲ့ အဓိပ္ပာယ်', { kind: 'lookup', word: 'အချစ်', understood: true }],
	['what is 10 % 19', { kind: 'ask' }],

	// plain words and phrases
	['love', { kind: 'lookup', word: 'love', focus: null, understood: false }],
	['look after', { kind: 'lookup', word: 'look after', understood: false }],
	['x', { kind: 'lookup', word: 'x' }],
	['love​', { kind: 'lookup', word: 'love' }],
];

test('classify reads each query', () => {
	for (const [typed, want] of CASES) {
		const got = classify(typed);
		for (const [key, value] of Object.entries(want)) {
			assert.deepEqual(got[key], value, `${JSON.stringify(typed)} → ${key}: ${JSON.stringify(got)}`);
		}
	}
});

test('the ambiguous percent offers both readings, each of which is answered', () => {
	const ask = classify('10 % 19');
	assert.equal(ask.options.length, 2);
	assert.deepEqual(classify(ask.options[0].query), { kind: 'math', expression: '10% of 19', value: 1.9 });
	assert.equal(classify(ask.options[1].query).value, 10);
});

test('maths', () => {
	assert.equal(calculate('0.1 + 0.2').value.toFixed(10), '0.3000000000');
	assert.equal(formatNumber(0.1 + 0.2), '0.3');
	assert.equal(formatNumber(-1234567.5), '−1,234,567.5');
	assert.equal(calculate('2 ^ 3 ^ 2').value, 512);
	assert.equal(calculate('-2 ^ 2').value, 4);
	assert.equal(calculate('100 - 10%').value, 90);
	assert.equal(calculate('12 divided by 4').value, 3);
	assert.equal(calculate('3 multiplied by 4 =').value, 12);
	assert.equal(calculate('42'), null);
	assert.equal(calculate('10%'), null);
	assert.equal(calculate('love'), null);
	assert.equal(calculate('2 + 2').expression, '2 + 2');
	assert.throws(() => calculate('1 / 0'), MathError);
	assert.throws(() => calculate('1 2 +'), MathError);
	assert.equal(percentPhrase('percent change from 50 to 75').value, 50);
	assert.equal(percentPhrase('what percent of 200 is 50').value, 25);
	assert.equal(shares('20 30 50'), null, 'a list needs the word');
	assert.throws(() => shares('0, 0 percent'), MathError);
});

test('time and date', () => {
	const d = new Date(2026, 10, 8, 15, 10);
	assert.equal(timeWords(d).my, 'နေ့လယ် ၃ နာရီ ၁၀ မိနစ်');
	assert.equal(timeWords(new Date(2026, 10, 8, 9, 0)).my, 'မနက် ၉ နာရီ');
	assert.equal(timeWords(new Date(2026, 10, 8, 21, 5)).my, 'ည ၉ နာရီ ၅ မိနစ်');
	assert.match(dateWords(d).en, /Sunday.*8 November 2026/);
	assert.equal(dateWords(d).my, '၂၀၂၆ ခုနှစ်၊ နိုဝင်ဘာလ ၈ ရက်၊ တနင်္ဂနွေနေ့');
});

test('questions around a phrase keep the phrase', () => {
	const cases = [
		['what is the king of danmark', 'king of danmark'],
		['who is the king of Norway?', 'king of Norway'],
		['where is Denmark', 'Denmark'],
		['what does love mean', 'love'],
		['how do you say love in Myanmar', 'love'],
		['love in burmese', 'love'],
		['translate big house to myanmar', 'big house'],
		['tell me about AI', 'AI'],
		['tell me what is ai', 'ai'],
	];
	for (const [typed, word] of cases) assert.equal(classify(typed).word, word, typed);
});
