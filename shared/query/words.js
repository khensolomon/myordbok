// @ts-check
/**
 * The words of English (or any spaced) text, each once, in order:
 * "love is good, love is an open door" → love, is, good, an, open, door.
 * Myanmar text has no spaces between words; shared/query/segment.js finds
 * those with the dictionary's help.
 */

/** Most words a sentence is offered in. */
export const SENTENCE_WORDS = 30;

/**
 * @param {string} text
 * @returns {string[]}
 */
export function spacedWords(text) {
	const seen = new Set();
	/** @type {string[]} */
	const out = [];
	for (const w of text.normalize('NFC').match(/[\p{L}\p{M}\p{N}]+(?:['’-][\p{L}\p{M}]+)*/gu) ?? []) {
		const key = w.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(w);
		if (out.length === SENTENCE_WORDS) break;
	}
	return out;
}
