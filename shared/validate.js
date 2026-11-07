// @ts-check
/**
 * Input checks shared by the app and the worker.
 */
import { AppError } from './errors.js';

export const MAX_QUERY_LENGTH = 100;

/** Myanmar, Myanmar Extended-A and Extended-B blocks. */
const MYANMAR = /[က-႟ꩠ-ꩿꧠ-꧿]/;

/** @typedef {'en' | 'my'} Lang */

/**
 * Normalises a search query: Unicode NFC, trimmed, inner whitespace collapsed.
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeQuery(raw) {
	if (typeof raw !== 'string') throw new AppError('bad_request', 'Query is missing');
	const q = raw.normalize('NFC').trim().replace(/\s+/g, ' ');
	if (!q) throw new AppError('bad_request', 'Query is empty');
	if (q.length > MAX_QUERY_LENGTH) {
		throw new AppError('bad_request', `Query is longer than ${MAX_QUERY_LENGTH} characters`);
	}
	return q;
}

/**
 * Lookup key stored beside each headword: normalised and lower-cased.
 * @param {string} word
 */
export function wordKey(word) {
	return normalizeQuery(word).toLowerCase();
}

/**
 * Picks the dictionary from the script typed: any Myanmar character means MY→EN.
 * @param {string} text
 * @returns {Lang}
 */
export function detectLang(text) {
	return MYANMAR.test(text) ? 'my' : 'en';
}

/**
 * @param {unknown} lang
 * @returns {Lang}
 */
export function parseLang(lang) {
	if (lang === 'en' || lang === 'my') return lang;
	throw new AppError('bad_request', `Unknown dictionary "${String(lang)}", expected "en" or "my"`);
}

/**
 * A reaction is a like (1) or a dislike (-1).
 * @param {unknown} value
 * @returns {1 | -1}
 */
export function parseReaction(value) {
	if (value === 1 || value === -1) return value;
	throw new AppError('bad_request', 'Reaction must be 1 (like) or -1 (dislike)');
}
