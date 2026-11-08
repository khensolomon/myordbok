// @ts-check
/**
 * Numbers in English words, both ways, on exact digit strings:
 * 101 → "one hundred and one" (British usage, as in the dictionary), and
 * "twenty-five thousand" → "25000".
 */
import { parseDecimal } from './digits.js';

/** @typedef {import('./digits.js').Decimal} Decimal */

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion', 'septillion', 'octillion', 'nonillion', 'decillion', 'undecillion', 'duodecillion'];

/** @param {number} n  0–999 */
function hundreds(n) {
	const h = Math.floor(n / 100);
	const rest = n % 100;
	const parts = [];
	if (h) parts.push(`${ONES[h]} hundred`);
	if (rest) {
		const words = rest < 20 ? ONES[rest] : `${TENS[Math.floor(rest / 10)]}${rest % 10 ? `-${ONES[rest % 10]}` : ''}`;
		parts.push(h ? `and ${words}` : words);
	}
	return parts.join(' ');
}

/**
 * @param {Decimal | string} value
 * @returns {string}
 */
export function toEnglishWords(value) {
	const d = typeof value === 'string' ? parseDecimal(value) : value;
	if (!d) throw new Error(`Not a number: ${JSON.stringify(value)}`);
	const groups = [];
	for (let end = d.whole.length; end > 0; end -= 3) groups.unshift(Number(d.whole.slice(Math.max(0, end - 3), end)));
	if (groups.length > SCALES.length) throw new Error(`${d.whole.length} digits is beyond the named English scales`);
	/** @type {string[]} */
	const parts = [];
	groups.forEach((g, i) => {
		if (!g) return;
		const scale = SCALES[groups.length - 1 - i];
		parts.push(scale ? `${hundreds(g)} ${scale}` : hundreds(g));
	});
	// "one thousand and five": the last group gets "and" when it is below 100.
	const lastGroup = groups.at(-1) ?? 0;
	if (parts.length > 1 && lastGroup > 0 && lastGroup < 100) parts[parts.length - 1] = `and ${parts.at(-1)}`;
	let words = parts.length ? parts.join(' ') : 'zero';
	if (d.fraction) words += ` point ${[...d.fraction].map((n) => ONES[Number(n)]).join(' ')}`;
	return d.negative ? `minus ${words}` : words;
}

const WORD_VALUE = new Map([
	...ONES.map((w, i) => /** @type {[string, number]} */ ([w, i])),
	...TENS.map((w, i) => /** @type {[string, number]} */ ([w, i * 10])).filter(([w]) => w),
]);
const SCALE_VALUE = new Map(SCALES.map((w, i) => /** @type {[string, number]} */ ([w, i * 3])).filter(([w]) => w));

/**
 * English number words to digits: "one hundred and one" → "101",
 * "twenty-five thousand" → "25000", "a hundred" → "100",
 * "minus two point five" → "-2.5".
 * @param {string} text
 * @returns {string | null}
 */
export function fromEnglishWords(text) {
	let words = text.toLowerCase().replace(/[-,]/g, ' ').split(/\s+/).filter((w) => w && w !== 'and');
	if (!words.length) return null;
	let negative = false;
	if (words[0] === 'minus' || words[0] === 'negative') {
		negative = true;
		words = words.slice(1);
	}
	let fraction = '';
	const point = words.indexOf('point');
	if (point >= 0) {
		const digits = words.slice(point + 1).map((w) => ONES.indexOf(w));
		if (!digits.length || digits.some((n) => n < 0 || n > 9)) return null;
		fraction = digits.join('');
		words = words.slice(0, point);
	}
	if (!words.length) return null;
	let total = 0n;
	let group = 0n;
	let seenNumber = false;
	for (const w of words) {
		if (w === 'a' && !seenNumber) {
			group = 1n;
			seenNumber = true;
		} else if (WORD_VALUE.has(w)) {
			group += BigInt(/** @type {number} */ (WORD_VALUE.get(w)));
			seenNumber = true;
		} else if (w === 'hundred') {
			if (!seenNumber) return null;
			group = (group || 1n) * 100n;
		} else if (SCALE_VALUE.has(w)) {
			if (!seenNumber) return null;
			total += (group || 1n) * 10n ** BigInt(/** @type {number} */ (SCALE_VALUE.get(w)));
			group = 0n;
		} else {
			return null;
		}
	}
	const whole = total + group;
	return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}
