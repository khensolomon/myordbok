// @ts-check
/**
 * Myanmar text into words. Myanmar is written without spaces between words,
 * so text is cut into syllables first and the syllables are then grouped
 * into the dictionary's headwords: the reading with the fewest syllables
 * left unknown and, among those, the fewest words, which favours the longest
 * headwords (ချစ်သူ over ချစ် + သူ).
 *
 * The headwords come from the caller (the Worker asks the dictionary which
 * of the possible spans exist), so this file holds no word list.
 */

/** Longest headword considered, in syllables. */
export const MAX_SYLLABLES = 10;

const CONSONANT = /[က-ဪဿ၌-၏]/;
const ASAT = '်';
const VIRAMA = '္';
const DOT_BELOW = '့';
const MYANMAR = /[က-႟ꩠ-ꩿꧠ-꧿]/;

/**
 * Myanmar text in syllables. A consonant starts a syllable unless it closes
 * the one before (followed by ် or ္, as in ချစ် or the first တ of မေတ္တာ)
 * or is stacked under it (after ္). Digits, signs and other scripts are
 * syllables of their own; spaces and punctuation are dropped by the caller.
 * @param {string} text  NFC, without spaces.
 * @returns {string[]}
 */
export function syllables(text) {
	/** @type {string[]} */
	const out = [];
	const chars = [...text];
	for (let i = 0; i < chars.length; i++) {
		const c = chars[i];
		let next = chars[i + 1];
		if (next === DOT_BELOW) next = chars[i + 2];
		const starts =
			!out.length ||
			!MYANMAR.test(c) ||
			!MYANMAR.test(chars[i - 1]) ||
			(/[၀-၉]/.test(c)) ||
			(CONSONANT.test(c) && chars[i - 1] !== VIRAMA && next !== ASAT && next !== VIRAMA);
		if (starts) out.push(c);
		else out[out.length - 1] += c;
	}
	return out;
}

/**
 * Every run of up to MAX_SYLLABLES syllables, the spans a headword could be.
 * @param {string[]} syl
 */
export function spans(syl) {
	/** @type {Set<string>} */
	const out = new Set();
	for (let i = 0; i < syl.length; i++) {
		let text = '';
		for (let j = i; j < Math.min(syl.length, i + MAX_SYLLABLES); j++) {
			text += syl[j];
			out.add(text);
		}
	}
	return out;
}

/**
 * Syllables grouped into headwords. Runs of syllables that are no headword
 * stay together as one unknown word.
 * @param {string[]} syl
 * @param {(text: string) => boolean} isWord
 * @returns {Array<{ text: string, known: boolean }>}
 */
export function groupWords(syl, isWord) {
	const n = syl.length;
	/** Best reading of the first i syllables: [unknown syllables, words, start of last word, known]. */
	const best = /** @type {Array<[number, number, number, boolean] | null>} */ (new Array(n + 1).fill(null));
	best[0] = [0, 0, 0, true];
	for (let i = 1; i <= n; i++) {
		for (let j = Math.max(0, i - MAX_SYLLABLES); j < i; j++) {
			const before = best[j];
			if (!before) continue;
			const text = syl.slice(j, i).join('');
			const known = isWord(text);
			if (!known && i - j > 1) continue;
			const candidate = /** @type {[number, number, number, boolean]} */ ([before[0] + (known ? 0 : 1), before[1] + 1, j, known]);
			const current = best[i];
			if (!current || candidate[0] < current[0] || (candidate[0] === current[0] && candidate[1] < current[1])) best[i] = candidate;
		}
	}
	/** @type {Array<{ text: string, known: boolean }>} */
	const words = [];
	for (let i = n; i > 0; ) {
		const [, , j, known] = /** @type {[number, number, number, boolean]} */ (best[i]);
		const text = syl.slice(j, i).join('');
		const last = words[0];
		// Unknown syllables next to each other are one unknown word.
		if (!known && last && !last.known) last.text = text + last.text;
		else words.unshift({ text, known });
		i = j;
	}
	return words;
}

/**
 * The pieces of Myanmar text to find words in: split at spaces and
 * punctuation (၊ ။ and others), each piece without spaces.
 * @param {string} text
 */
export function chunks(text) {
	return text
		.normalize('NFC')
		.replace(/[​-‍﻿]/g, '')
		.split(/[\s၊။,.;:!?"'“”‘’()]+/)
		.filter(Boolean);
}
