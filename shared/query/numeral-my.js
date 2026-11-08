// @ts-check
/**
 * Numbers in Myanmar words, both ways.
 *
 * The reading rules are those of myanmar-notation by Khen Solomon Lethil
 * (MIT): creaky tone (ဆယ့်, ရာ့, ထောင့်) when a smaller place follows, and
 * for large amounts one reading per scale (သိန်း, သန်း, ကုဋေ), the scale name
 * leading the number once the multiplier has more than one digit
 * (100000000 → သိန်းတစ်ထောင်, သန်းတစ်ရာ, ကုဋေတစ်ဆယ်) and ပေါင်း for amounts
 * beyond the next scale. Rewritten here on exact digit strings, with
 * decimals (ဒသမ), negative numbers (အနုတ်), checked input, text in Unicode
 * canonical order (့ before ်), no dangling separator after a group of
 * zeros, and the reverse direction for the forms people type.
 */
import { parseDecimal } from './digits.js';

/** @typedef {import('./digits.js').Decimal} Decimal */

export const NUMERALS = Object.freeze(['သုည', 'တစ်', 'နှစ်', 'သုံး', 'လေး', 'ငါး', 'ခြောက်', 'ခုနစ်', 'ရှစ်', 'ကိုး']);

/** Place names; `creaky` when a smaller place follows. */
const SCALES = Object.freeze([
	{ name: '', rule: 0 },
	{ name: 'ဆယ်', rule: 1, creaky: 'ဆယ့်' },
	{ name: 'ရာ', rule: 2, creaky: 'ရာ့' },
	{ name: 'ထောင်', rule: 3, creaky: 'ထောင့်' },
	{ name: 'သောင်း', rule: 4 },
	{ name: 'သိန်း', rule: 5, large: true },
	{ name: 'သန်း', rule: 6, large: true },
	{ name: 'ကုဋေ', rule: 7, large: true },
]);

const NEGATIVE = 'အနုတ်';
const POINT = 'ဒသမ';
const SPACE = ' ';
const COMMA = '၊ ';
const AND = 'နှင့် ';
const PLUS = 'ပေါင်း ';

/**
 * Up to seven digits (below ကုဋေ) as words, with creaky tones.
 * @param {string} digits  No leading zeros except "0".
 */
function simple(digits) {
	if (/^0*$/.test(digits)) return NUMERALS[0];
	/** @type {Array<{ name: string, tone: string, index: number }>} */
	const raw = [];
	const k = digits.length;
	for (let i = 0; i < k; i++) {
		const n = Number(digits[i]);
		if (n === 0) continue;
		const index = k - i - 1;
		const last = raw.at(-1);
		if (last && index < 3) {
			const creaky = SCALES[last.index].creaky;
			if (creaky) last.tone = creaky;
		}
		raw.push({ name: NUMERALS[n], tone: SCALES[index].name, index });
	}
	return raw.map((e) => e.name + e.tone).join('');
}

/**
 * Splits digits into groups of `size` from the right, the first group taking
 * the remainder.
 * @param {string} digits
 * @param {number} size
 */
function chunk(digits, size) {
	const first = digits.length % size || size;
	const out = [digits.slice(0, first)];
	for (let i = first; i < digits.length; i += size) out.push(digits.slice(i, i + size));
	return out;
}

/**
 * One reading of a whole number on one large scale (myanmar-notation's
 * engine, unchanged in its rules).
 * @param {string} digits
 * @param {{ name: string, rule: number }} scale
 */
function onScale(digits, scale) {
	const { name, rule } = scale;
	const list = chunk(digits, rule);
	const last = list.length - 1;
	const LEFT = '\u0001';
	const RIGHT = '\u0002';
	let text = '';
	/** @type {string[]} */
	const mid = [];
	for (let i = 0; i < list.length; i++) {
		const part = list[i];
		const words = /^0+$/.test(part) ? '' : simple(part.replace(/^0+/, ''));
		const head = i % 2 === 0;
		if (i > 1 || head) mid.push(name);
		if (!words) continue;
		if (head) {
			if (i === 0) text += LEFT;
			else if (i !== last) text += name;
			text += words;
			if (part.length <= 1) text += RIGHT;
		} else {
			text += i === last ? SPACE : AND;
			text += words;
			if (i !== last) text += COMMA;
		}
	}
	if (text.includes(RIGHT)) {
		text = text.replace(RIGHT, mid.shift() ?? '');
		if (!mid.length) mid.push('');
	}
	// A last group of zeros would leave a dangling separator; it is dropped.
	return text.replace(LEFT, mid.join(COMMA).replace(COMMA, PLUS)).replace(/[၊\s]+$/, '');
}

/**
 * @typedef {object} MyanmarReading
 * @property {string} scale  "" for a plain reading, else the large scale it is read on.
 * @property {string} text
 */

/**
 * Every reading of a whole number: one plain reading below 100000, else one
 * per large scale the number reaches.
 * @param {string} whole  Digits, no leading zeros.
 * @returns {MyanmarReading[]}
 */
function wholeReadings(whole) {
	const places = whole.length - 1;
	if (places < 5) return [{ scale: '', text: simple(whole) }];
	return SCALES.filter((s) => s.large && s.rule <= places).map((s) => ({ scale: s.name, text: onScale(whole, s) }));
}

/**
 * A number in Myanmar words.
 * @param {Decimal | string} value  A Decimal, or a written number such as "10,010" or "၂.၅".
 * @returns {MyanmarReading[]}  The first is the usual reading.
 */
export function toMyanmarWords(value) {
	const d = typeof value === 'string' ? parseDecimal(value) : value;
	if (!d) throw new Error(`Not a number: ${JSON.stringify(value)}`);
	const sign = d.negative ? `${NEGATIVE} ` : '';
	const fraction = d.fraction ? ` ${POINT} ${[...d.fraction].map((n) => NUMERALS[Number(n)]).join(' ')}` : '';
	return wholeReadings(d.whole).map((r) => ({ scale: r.scale, text: `${sign}${r.text}${fraction}` }));
}

// ---------------------------------------------------------------- words → number

/** Every word the parser knows, longest first so ထောင့် wins over ထောင်. */
const WORDS = (() => {
	/** @type {Array<[string, { digit?: number, scale?: number }]>} */
	const list = [];
	NUMERALS.forEach((w, digit) => list.push([w, { digit }]));
	list.push(['ခုနှစ်', { digit: 7 }]); // a common spelling of ခုနစ်
	for (const s of SCALES.slice(1)) {
		list.push([s.name, { scale: s.rule }]);
		if (s.creaky) list.push([s.creaky, { scale: s.rule }]);
	}
	return list.sort((a, b) => b[0].length - a[0].length);
})();

/**
 * @param {string} segment  Words without spaces.
 * @returns {Array<{ digit?: number, scale?: number }> | null}
 */
function tokens(segment) {
	/** @type {Array<{ digit?: number, scale?: number }>} */
	const out = [];
	let rest = segment;
	while (rest) {
		const hit = WORDS.find(([w]) => rest.startsWith(w));
		if (!hit) return null;
		out.push(hit[1]);
		rest = rest.slice(hit[0].length);
	}
	return out;
}

/**
 * The value of one spoken group: digits each followed by their place
 * (နှစ်ထောင့်ခုနစ်ရာ), large places multiplying what came before them
 * (နှစ်ဆယ့်ငါးသိန်း = 25 × 100000), or a large place leading
 * (သိန်းတစ်ရာ = 100 × 100000).
 * @param {Array<{ digit?: number, scale?: number }>} list
 * @returns {bigint | null}
 */
function groupValue(list) {
	let lead = 0n;
	if (list[0]?.scale !== undefined && list[0].scale >= 5) {
		lead = 10n ** BigInt(list[0].scale);
		list = list.slice(1);
		if (!list.length) return null;
	}
	let total = 0n; // above the last large place
	let small = 0n; // below it
	/** @type {bigint | null} */
	let digit = null;
	let lastSmall = 5; // places must fall within each group
	for (const t of list) {
		if (t.digit !== undefined) {
			if (digit !== null) return null; // two digits in a row
			digit = BigInt(t.digit);
		} else if (t.scale !== undefined && t.scale < 5) {
			if (digit === null || t.scale >= lastSmall) return null;
			small += digit * 10n ** BigInt(t.scale);
			lastSmall = t.scale;
			digit = null;
		} else if (t.scale !== undefined) {
			const group = small + (digit ?? 0n);
			if (group === 0n) return null;
			total += group * 10n ** BigInt(t.scale);
			small = 0n;
			digit = null;
			lastSmall = 5;
		}
	}
	const value = total + small + (digit ?? 0n);
	return lead ? value * lead : value;
}

/**
 * Myanmar number words to digits: "တစ်ရာ့တစ်" → "101",
 * "တစ်ကုဋေ နှစ်သန်း" → "12000000", "အနုတ် ငါး ဒသမ ငါး" → "-5.5".
 * Groups separated by spaces are added. The ပေါင်း/နှင့် readings of very
 * large amounts are not parsed.
 * @param {string} text
 * @returns {string | null}  Digits, or null when the text is not a number in words.
 */
export function fromMyanmarWords(text) {
	let s = text.normalize('NFC').replace(/[​-‍﻿]/g, '').replace(/[၊,]/g, ' ').trim();
	let negative = false;
	if (s.startsWith(NEGATIVE)) {
		negative = true;
		s = s.slice(NEGATIVE.length).trim();
	}
	let fraction = '';
	const point = s.indexOf(POINT);
	if (point >= 0) {
		const digits = tokens(s.slice(point + POINT.length).replace(/\s+/g, ''));
		if (!digits?.length || digits.some((t) => t.digit === undefined)) return null;
		fraction = digits.map((t) => t.digit).join('');
		s = s.slice(0, point).trim();
	}
	if (!s) return null;
	let total = 0n;
	for (const segment of s.split(/\s+/)) {
		const list = tokens(segment);
		if (!list?.length) return null;
		const v = groupValue(list);
		if (v === null) return null;
		total += v;
	}
	return `${negative && (total > 0n || /[1-9]/.test(fraction)) ? '-' : ''}${total}${fraction ? `.${fraction}` : ''}`;
}
