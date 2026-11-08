import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { formatGrouped, parseDecimal, toAsciiDigits, toMyanmarDigits } from '../shared/query/digits.js';
import { fromEnglishWords, toEnglishWords } from '../shared/query/numeral-en.js';
import { fromMyanmarWords, toMyanmarWords } from '../shared/query/numeral-my.js';

/**
 * Readings made by myanmar-notation 1.5 for 465 whole numbers up to 15
 * digits, stored in Unicode canonical order. The rewrite must give the same
 * readings; the only intended difference is that a last group of zeros no
 * longer leaves a dangling "၊ ".
 */
const REFERENCE = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', 'numeral-my.json'), 'utf8'));
const tidy = (/** @type {string} */ s) => s.replace(/[၊\s]+$/, '');

test('Myanmar words match myanmar-notation for every reference number', () => {
	for (const [n, want] of REFERENCE) {
		assert.deepEqual(toMyanmarWords(n).map((r) => r.text), want.map(tidy), n);
	}
});

test('Myanmar words: the examples, decimals, negatives, any length', () => {
	const words = (/** @type {string} */ n) => toMyanmarWords(n)[0].text;
	assert.equal(words('1'), 'တစ်');
	assert.equal(words('101'), 'တစ်ရာ့တစ်');
	assert.equal(words('1000'), 'တစ်ထောင်');
	assert.equal(words('10000'), 'တစ်သောင်း');
	assert.equal(words('10010'), 'တစ်သောင်းတစ်ဆယ်');
	assert.equal(words('၁၀၁'), 'တစ်ရာ့တစ်');
	assert.equal(words('10,010'), 'တစ်သောင်းတစ်ဆယ်');
	assert.equal(words('2.5'), 'နှစ် ဒသမ ငါး');
	assert.equal(words('-5'), 'အနုတ် ငါး');
	assert.equal(words('0'), 'သုည');
	assert.equal(toMyanmarWords('12345678901234567890').length, 3); // exact, no float rounding
	assert.ok(toMyanmarWords('100000000').map((r) => r.text).includes('ကုဋေတစ်ဆယ်'));
	for (const r of toMyanmarWords('1000000000')) assert.ok(!/[​]/.test(r.text) && r.text === r.text.normalize('NFC'));
	assert.throws(() => toMyanmarWords('abc'), /Not a number/);
});

test('Myanmar words back to digits: every plain reading round-trips', () => {
	for (const [n] of REFERENCE) {
		for (const r of toMyanmarWords(n)) {
			const back = fromMyanmarWords(r.text);
			// The ပေါင်း / နှင့် readings of very large amounts are not parsed, and never misread.
			if (/နှင့်|ပေါင်း/.test(r.text)) assert.ok(back === null || back === n, `${n}: ${r.text}`);
			else assert.equal(back, n, r.text);
		}
	}
	assert.equal(fromMyanmarWords('နှစ်ဆယ့်ငါးသိန်း'), '2500000');
	assert.equal(fromMyanmarWords('ခုနှစ်ဆယ်'), '70');
	assert.equal(fromMyanmarWords('အနုတ် ငါး ဒသမ ငါး'), '-5.5');
	for (const notNumber of ['တစ်နှစ်', 'ရာ', 'ချစ်', 'တစ်ရာ့ချစ်', '']) assert.equal(fromMyanmarWords(notNumber), null, notNumber);
});

test('English words, both ways', () => {
	assert.equal(toEnglishWords('101'), 'one hundred and one');
	assert.equal(toEnglishWords('10010'), 'ten thousand and ten');
	assert.equal(toEnglishWords('1000000'), 'one million');
	assert.equal(toEnglishWords('1234567'), 'one million two hundred and thirty-four thousand five hundred and sixty-seven');
	assert.equal(toEnglishWords('-2.5'), 'minus two point five');
	assert.equal(toEnglishWords('0'), 'zero');
	for (const n of ['0', '7', '19', '20', '101', '110', '999', '1005', '10010', '123456789', '1000000000000']) {
		assert.equal(fromEnglishWords(toEnglishWords(n)), n, n);
	}
	assert.equal(fromEnglishWords('a hundred'), '100');
	assert.equal(fromEnglishWords('twenty-five thousand'), '25000');
	assert.equal(fromEnglishWords('love'), null);
	assert.equal(fromEnglishWords('hundred'), null);
});

test('digits: parsing, grouping, scripts', () => {
	assert.deepEqual(parseDecimal('1,200,000.00'), { negative: false, whole: '1200000', fraction: '00' });
	assert.deepEqual(parseDecimal('-0'), { negative: false, whole: '0', fraction: '' });
	assert.equal(parseDecimal('1,20'), null);
	assert.equal(parseDecimal('1.2.3'), null);
	assert.equal(formatGrouped(/** @type {any} */ (parseDecimal('10010'))), '10,010');
	assert.equal(toAsciiDigits('၁၀၁'), '101');
	assert.equal(toMyanmarDigits('2026'), '၂၀၂၆');
});
