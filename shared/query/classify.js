// @ts-check
/**
 * What a query asks for, decided in the browser before anything is fetched.
 *
 *   number    "101", "၁၀၁", "10,010", "တစ်ရာ့တစ်", "one hundred and one"
 *   math      "1+1", "x = 5x1", "10% of 70", "15 is what percent of 60"
 *   shares    "20, 30, 50 percentage": each number's share of the total
 *   ask       "10 % 19": more than one reading; the reader picks
 *   problem   looks like maths but has no answer (÷ 0, a missing number)
 *   time/date "what time is it", "what is the date"
 *   lookup    a word, also out of a question: "what is love" → love,
 *             "similar word of love" → love, focus synonyms
 *
 * Numbers, maths and time never reach the dictionary. Recognisers run in a
 * fixed order and the first that is sure wins; tests/query.test.js is the
 * list of what each reads.
 */
import { parseDecimal, toAsciiDigits } from './digits.js';
import { MathError, calculate, percentPhrase, shares } from './math.js';
import { fromEnglishWords } from './numeral-en.js';
import { NUMERALS, fromMyanmarWords } from './numeral-my.js';

/** @typedef {'synonyms' | 'opposite' | 'forms'} Focus */

/**
 * @typedef {{ kind: 'empty' }
 *   | { kind: 'number', value: string, source: 'digits' | 'my-words' | 'en-words' }
 *   | { kind: 'math', expression: string, value: number, note?: string, percent?: boolean }
 *   | { kind: 'shares', numbers: number[], total: number, shares: number[] }
 *   | { kind: 'ask', question: string, options: Array<{ label: string, query: string }> }
 *   | { kind: 'problem', message: string }
 *   | { kind: 'time' } | { kind: 'date' }
 *   | { kind: 'lookup', word: string, focus: Focus | null, understood: boolean }} Intent
 */

/**
 * Text as compared: canonical Unicode, no invisible characters, single spaces.
 * @param {string} text
 */
export function tidy(text) {
	return text.normalize('NFC').replace(/[​-‍﻿]/g, '').replace(/\s+/g, ' ').trim();
}

const TIME = [/^(?:what(?:'s| is)? )?(?:the )?(?:current )?time(?: is it)?(?: now)?$/, /^what time (?:is it|it is)(?: now)?$/, /^time now$/, /^ဘယ်နှစ်နာရီ(?:ရှိပြီ)?(?:လဲ)?$/, /^အခု(?: )?(?:အချိန်|ဘယ်နှစ်နာရီ).*$/];
const DATE = [/^(?:what(?:'s| is)? )?(?:the |today'?s )?date(?: today)?$/, /^what day is (?:it|today)$/, /^what is today$/, /^today$/, /^ဒီနေ့(?: )?(?:ဘာနေ့|ဘယ်နေ့|ရက်စွဲ).*$/];

const MATH_PREFIX = /^(?:what(?:'s| is| are)|calculate|compute|how much is|solve|work out)\s+/;

/** A whole query that is only a label, e.g. "x = 5x1" → "5x1". */
const LABEL = /^[a-z]\s*=\s*(.+)$/;

/** "10 % 19": percent of, or remainder? */
const PERCENT_OR_MOD = /^([+-]?\d+(?:\.\d+)?)\s*%\s*([+-]?\d+(?:\.\d+)?)$/;

/** Questions around a word, English then Myanmar. The word is group 1. */
const QUESTIONS = /** @type {Array<[RegExp, Focus | null]>} */ ([
	[/^(?:what (?:is|are) )?(?:the |a |an )?(?:similar words?|synonyms?|another words?|other words?|words? similar)\s+(?:of|for|to|with)\s+(.+)$/, 'synonyms'],
	[/^(.+?)\s+synonyms?$/, 'synonyms'],
	[/^(?:what (?:is|are) )?(?:the |an )?(?:opposites?|antonyms?)\s+(?:of|for|to)\s+(.+)$/, 'opposite'],
	[/^(?:what (?:is|are) )?(?:the )?(?:plural|past tense|past participle|past|forms?)\s+(?:form )?of\s+(.+)$/, 'forms'],
	[/^(?:(?:please|can you|could you|tell me|explain(?: to me)?|describe|define|what(?:'s| is| are| does| do)|(?:the )?meaning of|(?:the )?definition of)\s+)+(?:the meaning of |the definition of |the word )?(.+?)(?:\s+means?)?$/, null],
	[/^(.+?)\s*(?:နဲ့|နှင့်)\s*အဓိပ္ပာယ်\s*တူ.*$/, 'synonyms'],
	[/^(.+?)\s*(?:ရဲ့|၏)?\s*ဆန့်ကျင်ဘက်.*$/, 'opposite'],
	[/^(.+?)\s*(?:ဆိုတာ|ဟူသည်)\s*(?:ဘာ|ဘယ်လို).*$/, null],
	[/^(.+?)\s*(?:ရဲ့|၏)?\s*အဓိပ္ပာယ်(?:\s*(?:က|ကို|ဘာလဲ|ဖော်ပြပါ).*)?$/, null],
]);

/**
 * @param {string} raw  What was typed.
 * @returns {Intent}
 */
export function classify(raw) {
	const text = tidy(raw);
	if (!text) return { kind: 'empty' };
	const lower = text.toLowerCase().replace(/[?？!]+$/, '').trim();

	if (TIME.some((re) => re.test(lower))) return { kind: 'time' };
	if (DATE.some((re) => re.test(lower))) return { kind: 'date' };

	const quick = numberOrMath(lower);
	if (quick) return quick;

	for (const [re, focus] of QUESTIONS) {
		const m = re.exec(lower);
		if (!m) continue;
		// Keep the word as typed (case matters for names), only cut the question around it.
		const start = lower.indexOf(m[1]);
		let word = text.slice(start, start + m[1].length).replace(/^["'“‘]|["'”’]$/g, '').trim();
		word = word.replace(/^(?:a|an|the)\s+/i, '');
		if (!word || word.length > 60 || word.toLowerCase() === lower) continue;
		const inner = numberOrMath(word.toLowerCase());
		if (inner) return inner;
		return { kind: 'lookup', word, focus, understood: true };
	}
	return { kind: 'lookup', word: text, focus: null, understood: false };
}

/**
 * @param {string} lower  Tidy, lower case.
 * @returns {Intent | null}
 */
function numberOrMath(lower) {
	const ascii = toAsciiDigits(lower).replace(/[=]\s*$/, '').trim();

	const whole = parseDecimal(ascii);
	if (whole) return { kind: 'number', value: `${whole.negative ? '-' : ''}${whole.whole}${whole.fraction ? `.${whole.fraction}` : ''}`, source: 'digits' };

	// Number words: more than a single word, which may well be a dictionary entry ("one", "တစ်").
	if (!NUMERALS.includes(lower)) {
		const my = /[က-႟]/.test(lower) ? fromMyanmarWords(lower) : null;
		if (my) return { kind: 'number', value: my, source: 'my-words' };
	}
	if (/\s|-/.test(lower.trim())) {
		const en = fromEnglishWords(lower);
		if (en) return { kind: 'number', value: en, source: 'en-words' };
	}

	let sum = ascii.replace(MATH_PREFIX, '');
	const label = LABEL.exec(sum);
	if (label) sum = label[1];

	const ambiguous = PERCENT_OR_MOD.exec(sum);
	if (ambiguous) {
		const [, a, b] = ambiguous;
		return {
			kind: 'ask',
			question: `What does “${a} % ${b}” mean?`,
			options: [
				{ label: `${a}% of ${b}`, query: `${a}% of ${b}` },
				{ label: `The remainder of ${a} ÷ ${b}`, query: `${a} mod ${b}` },
			],
		};
	}

	try {
		const phrase = percentPhrase(sum);
		if (phrase) return { kind: 'math', ...phrase };
		const share = shares(sum);
		if (share) return { kind: 'shares', ...share };
		const answer = calculate(sum);
		if (answer) return { kind: 'math', ...answer };
	} catch (err) {
		if (err instanceof MathError) return { kind: 'problem', message: err.message };
		throw err;
	}
	return null;
}
