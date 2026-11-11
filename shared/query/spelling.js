// @ts-check
/**
 * "Did you mean" candidates: every string one edit away from an English
 * word. The Worker checks them against the dictionary (worker/routes/
 * spelling.js); offline, the app checks them against the word list on the
 * device (app/data/read-offline.js).
 */

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
/** Longest word candidates are made for. */
export const SPELLING_MAX = 24;

/**
 * Whether a lower-case word is short plain English, worth the candidates.
 * @param {string} word
 */
export function spellable(word) {
	return word.length <= SPELLING_MAX && /^[a-z' -]+$/.test(word);
}

/**
 * Every string one edit away from `word` (Norvig's edits1), without `word`.
 * @param {string} word  Lower case.
 */
export function edits1(word) {
	/** @type {Set<string>} */
	const out = new Set();
	for (let i = 0; i <= word.length; i++) {
		const [a, b] = [word.slice(0, i), word.slice(i)];
		if (b) out.add(a + b.slice(1));
		if (b.length > 1) out.add(a + b[1] + b[0] + b.slice(2));
		for (const c of LETTERS) {
			if (b) out.add(a + c + b.slice(1));
			out.add(a + c + b);
		}
	}
	out.delete(word);
	out.delete('');
	return [...out];
}
