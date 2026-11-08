// @ts-check
/**
 * Numbers as exact decimal strings, never JavaScript floats, so any length
 * stays exact. Shared by the Myanmar and English number words.
 */

export const MYANMAR_DIGITS = Object.freeze(['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉']);

/** Longest whole part accepted (digits); beyond it a reading means nothing. */
export const MAX_DIGITS = 40;

/**
 * Myanmar (and Shan) digits to 0–9; other characters unchanged.
 * @param {string} text
 */
export function toAsciiDigits(text) {
	return text.replace(/[၀-၉]/g, (d) => String(d.charCodeAt(0) - 0x1040)).replace(/[႐-႙]/g, (d) => String(d.charCodeAt(0) - 0x1090));
}

/**
 * 0–9 to Myanmar digits.
 * @param {string} text
 */
export function toMyanmarDigits(text) {
	return text.replace(/[0-9]/g, (d) => MYANMAR_DIGITS[Number(d)]);
}

/**
 * @typedef {object} Decimal
 * @property {boolean} negative
 * @property {string} whole     Digits without leading zeros ("0" for zero).
 * @property {string} fraction  Digits after the point, trailing zeros kept as typed ("" if none).
 */

/**
 * A written number: digits in either script, optional sign, thousands
 * separators in groups of three, optional decimal part.
 * "10,010" "၁၀၀" "-2.5" "1,200,000.00". Anything else is not a number.
 * @param {string} text
 * @returns {Decimal | null}
 */
export function parseDecimal(text) {
	const s = toAsciiDigits(text.trim()).replace(/[−–]/g, '-');
	const m = /^([+-]?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?$/.exec(s);
	if (!m) return null;
	const whole = m[2].replace(/,/g, '').replace(/^0+(?=\d)/, '');
	if (whole.length > MAX_DIGITS) return null;
	const fraction = m[3] ?? '';
	const zero = /^0*$/.test(whole) && /^0*$/.test(fraction);
	return { negative: m[1] === '-' && !zero, whole, fraction };
}

/**
 * Digits grouped in threes: 10010 → "10,010".
 * @param {Decimal} d
 */
export function formatGrouped(d) {
	const whole = d.whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	return `${d.negative ? '−' : ''}${whole}${d.fraction ? `.${d.fraction}` : ''}`;
}
