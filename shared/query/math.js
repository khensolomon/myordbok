// @ts-check
/**
 * Arithmetic typed into the search box, worked out in the browser. Its own
 * small parser, never eval: numbers (either script), + − × ÷ ^, brackets,
 * the words plus, minus, times, multiplied by, divided by, mod, and
 * percentages, with the usual calculator readings:
 *
 *   10% of 70 → 7          70 + 10% → 77          70 − 10% → 63
 *
 * Phrases about percentages are read before the parser (percentPhrase).
 * Anything it cannot read exactly is not maths: the caller decides what else
 * the text might be. A sum it can read but not work out (÷ 0) is an error
 * with its reason.
 */
import { toAsciiDigits } from './digits.js';

/**
 * @typedef {{ kind: 'num', value: number, percent?: boolean }
 *   | { kind: 'op', op: string }
 *   | { kind: 'open' } | { kind: 'close' }} Token
 */

/** Word operators, longest first. */
const WORD_OPS = [
	['multiplied by', '*'],
	['divided by', '/'],
	['to the power of', '^'],
	['plus', '+'],
	['minus', '-'],
	['times', '*'],
	['modulo', 'mod'],
	['mod', 'mod'],
	['over', '/'],
];

const NUMBER = /^(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?|^\.\d+/;

/**
 * @param {string} text
 * @returns {Token[] | null}  null when something in the text is not maths.
 */
export function tokenize(text) {
	let s = toAsciiDigits(text.toLowerCase()).replace(/[−–]/g, '-').trim();
	/** @type {Token[]} */
	const out = [];
	while (s) {
		const space = /^\s+/.exec(s);
		if (space) {
			s = s.slice(space[0].length);
			continue;
		}
		const num = NUMBER.exec(s);
		if (num) {
			out.push({ kind: 'num', value: Number(num[0].replace(/,/g, '')) });
			s = s.slice(num[0].length);
			continue;
		}
		const pct = /^(%|percentage|percent|per cent)/.exec(s);
		if (pct) {
			const last = out.at(-1);
			if (last?.kind !== 'num' || last.percent) return null;
			last.percent = true;
			s = s.slice(pct[0].length);
			continue;
		}
		if (/^of\b/.test(s)) {
			// "10% of 70": of multiplies, and only after a percentage.
			const last = out.at(-1);
			if (last?.kind !== 'num' || !last.percent) return null;
			out.push({ kind: 'op', op: 'of' });
			s = s.slice(2);
			continue;
		}
		const word = WORD_OPS.find(([w]) => s.startsWith(w) && !/[a-z]/.test(s.charAt(w.length)));
		if (word) {
			out.push({ kind: 'op', op: word[1] });
			s = s.slice(word[0].length);
			continue;
		}
		const ch = s[0];
		if ('+-*/^'.includes(ch)) out.push({ kind: 'op', op: ch });
		else if (ch === '×' || ch === 'x') out.push({ kind: 'op', op: '*' });
		else if (ch === '÷') out.push({ kind: 'op', op: '/' });
		else if (ch === '(') out.push({ kind: 'open' });
		else if (ch === ')') out.push({ kind: 'close' });
		else if (ch === '=' && s.slice(1).trim() === '') {
			// a trailing "=" as on a calculator
		} else return null;
		s = s.slice(1);
	}
	return out;
}

/** @typedef {{ value: number, percent: boolean }} Value */

/**
 * Recursive descent over the tokens:
 *   expr   = term (('+' | '-') term)*
 *   term   = power (('*' | '/' | 'mod' | 'of') power)*
 *   power  = unary ('^' power)?
 *   unary  = '-' unary | atom
 *   atom   = number | '(' expr ')'
 * @param {Token[]} tokens
 * @returns {number}
 */
function evaluate(tokens) {
	let i = 0;
	const peek = () => tokens[i];
	const isOp = (/** @type {string[]} */ ...ops) => {
		const t = peek();
		return t?.kind === 'op' && ops.includes(t.op);
	};

	/** @returns {Value} */
	const atom = () => {
		const t = tokens[i++];
		if (!t) throw new MathError('The sum ends too early.');
		if (t.kind === 'num') return { value: t.value, percent: !!t.percent };
		if (t.kind === 'open') {
			const v = expr();
			if (tokens[i++]?.kind !== 'close') throw new MathError('A bracket is not closed.');
			return v;
		}
		throw new MathError('Something is missing between the numbers.');
	};
	/** @returns {Value} */
	const unary = () => {
		if (isOp('-')) {
			i++;
			const v = unary();
			return { value: -v.value, percent: v.percent };
		}
		if (isOp('+')) i++;
		return atom();
	};
	/** @returns {Value} */
	const power = () => {
		const base = unary();
		if (!isOp('^')) return base;
		i++;
		const exp = power();
		return { value: plain(base) ** plain(exp), percent: false };
	};
	/** @returns {Value} */
	const term = () => {
		let left = power();
		while (isOp('*', '/', 'mod', 'of')) {
			const op = /** @type {{ op: string }} */ (tokens[i++]).op;
			const right = power();
			const a = plain(left);
			const b = plain(right);
			if ((op === '/' || op === 'mod') && b === 0) throw new MathError('Division by zero has no answer.');
			// 10% of 19 as 10 × 19 ÷ 100, which keeps whole numbers exact (not 0.1 × 19).
			const product = left.percent ? (left.value * b) / 100 : a * b;
			left = { value: op === '*' || op === 'of' ? product : op === '/' ? a / b : a % b, percent: false };
		}
		return left;
	};
	/** @returns {Value} */
	const expr = () => {
		let left = term();
		while (isOp('+', '-')) {
			const op = /** @type {{ op: string }} */ (tokens[i++]).op;
			const right = term();
			const a = plain(left);
			// Calculator reading: 70 + 10% is 70 plus ten percent of 70.
			const b = right.percent ? (a * right.value) / 100 : plain(right);
			left = { value: op === '+' ? a + b : a - b, percent: false };
		}
		return left;
	};

	const result = expr();
	if (i < tokens.length) throw new MathError(tokens[i].kind === 'close' ? 'A closing bracket has no opening one.' : 'Two numbers need an operation between them.');
	const value = plain(result);
	if (!Number.isFinite(value)) throw new MathError('The answer is too large to show.');
	return value;
}

/** @param {Value} v  A percentage on its own is its fraction: 10% → 0.1. */
function plain(v) {
	return v.percent ? v.value / 100 : v.value;
}

export class MathError extends Error {}

/**
 * A number for reading: no float noise (0.1 + 0.2 → 0.3), grouped thousands.
 * @param {number} n
 */
export function formatNumber(n) {
	const rounded = Number.parseFloat(n.toPrecision(12));
	if (Math.abs(rounded) >= 1e21 || (rounded !== 0 && Math.abs(rounded) < 1e-9)) return rounded.toExponential(6).replace(/\.?0+e/, 'e');
	const [whole, frac] = String(Math.abs(rounded)).split('.');
	const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	return `${rounded < 0 ? '−' : ''}${grouped}${frac ? `.${frac}` : ''}`;
}

/**
 * @typedef {object} MathAnswer
 * @property {string} expression  The sum as read, for showing.
 * @property {number} value
 * @property {string} [note]       What the reading assumed.
 * @property {boolean} [percent]   The value is a percentage.
 */

/**
 * @param {string} text  The sum alone (no "what is", no "x =").
 * @returns {MathAnswer | null}  null when the text is not a sum.
 * @throws {MathError} when it is a sum that has no answer.
 */
export function calculate(text) {
	const tokens = tokenize(text);
	if (!tokens?.length) return null;
	// A lone number, even "10%", is not a sum.
	if (!tokens.some((t) => t.kind === 'op') || !tokens.some((t) => t.kind === 'num')) return null;
	return { expression: show(tokens), value: evaluate(tokens) };
}

/** @param {Token[]} tokens */
function show(tokens) {
	const sym = /** @type {Record<string, string>} */ ({ '*': '×', '/': '÷', '-': '−', '+': '+', '^': '^', mod: 'mod', of: 'of' });
	return tokens
		.map((t) => (t.kind === 'num' ? `${formatNumber(t.value)}${t.percent ? '%' : ''}` : t.kind === 'op' ? ` ${sym[t.op]} ` : t.kind === 'open' ? '(' : ')'))
		.join('')
		.replace(/\(\s+/g, '(')
		.replace(/\s+\)/g, ')')
		.trim();
}

// ---------------------------------------------------------------- percentage phrases

const N = '([+-]?(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?)';
const PCT = '(?:%|percent|percentage|per cent)';
const num = (/** @type {string} */ s) => Number(s.replace(/,/g, ''));

/**
 * Percentage questions in words.
 * @param {string} text  Lower case, ASCII digits, no "what is" prefix.
 * @returns {MathAnswer | null}
 */
export function percentPhrase(text) {
	let m;
	// 15 is what percent of 60 / what percent of 60 is 15 / what percent is 15 of 60
	if ((m = new RegExp(`^${N} is what ${PCT} of ${N}$`).exec(text)) || (m = new RegExp(`^what ${PCT} is ${N} of ${N}$`).exec(text))) {
		const [a, b] = [num(m[1]), num(m[2])];
		if (b === 0) throw new MathError('A percentage of zero has no answer.');
		return { expression: `${formatNumber(a)} of ${formatNumber(b)}`, value: (a / b) * 100, note: 'as a percentage', percent: true };
	}
	if ((m = new RegExp(`^what ${PCT} of ${N} is ${N}$`).exec(text))) {
		const [b, a] = [num(m[1]), num(m[2])];
		if (b === 0) throw new MathError('A percentage of zero has no answer.');
		return { expression: `${formatNumber(a)} of ${formatNumber(b)}`, value: (a / b) * 100, note: 'as a percentage', percent: true };
	}
	// percent change from 50 to 70 / change from 50 to 70 in percent
	if ((m = new RegExp(`^(?:${PCT} change|change) from ${N} to ${N}(?: in ${PCT})?$`).exec(text))) {
		const [a, b] = [num(m[1]), num(m[2])];
		if (a === 0) throw new MathError('A change from zero has no percentage.');
		return { expression: `${formatNumber(a)} → ${formatNumber(b)}`, value: ((b - a) / a) * 100, note: 'change as a percentage', percent: true };
	}
	return null;
}

/**
 * Each number's share of their total, for "20, 30, 50 percentage" or
 * "percentage of 20 30 and 50".
 * @param {string} text
 * @returns {{ numbers: number[], total: number, shares: number[] } | null}
 */
export function shares(text) {
	const m = new RegExp(`^(?:${PCT}s? of |share of )?((?:${N}(?:\\s*,\\s*|\\s+and\\s+|\\s+))+${N})(?: ${PCT}s?| shares?)?$`).exec(text);
	if (!m) return null;
	const hasWord = new RegExp(`${PCT}|share`).test(text);
	if (!hasWord) return null;
	const numbers = (m[1].match(new RegExp(N, 'g')) ?? []).map(num);
	if (numbers.length < 2) return null;
	const total = numbers.reduce((a, b) => a + b, 0);
	if (total === 0) throw new MathError('Shares of a total of zero have no answer.');
	return { numbers, total, shares: numbers.map((n) => (n / total) * 100) };
}
