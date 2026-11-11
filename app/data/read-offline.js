// @ts-check
/**
 * Reading a query with only the copy on this device (offline.js), the way
 * the server does (worker/routes/read.js): an entry, a phrase read from its
 * words' entries ("king of Norway"), a sentence split into words (Myanmar
 * into headwords), or nothing, with words one edit away and words starting
 * the same way. The same shared code decides each step; only the lookups
 * come from IndexedDB instead of D1.
 *
 * Differences from the server, all from what a device keeps: "did you mean"
 * words come in the word list's order, not by how many senses they have, and
 * a language without its senses pack on the device reads nothing.
 */
import { bestSense, composeMyanmar, isProper, planPhrase } from '#shared/query/phrase.js';
import { chunks, groupWords, syllables } from '#shared/query/segment.js';
import { edits1, spellable } from '#shared/query/spelling.js';
import { SENTENCE_WORDS, spacedWords } from '#shared/query/words.js';
import { detectLang } from '#shared/validate.js';
import { lookupOffline, sensesBuild, startingWith, tally, wordListOf } from './offline.js';

/** @typedef {import('#shared/types.js').LookupResult} LookupResult */
/** @typedef {import('#shared/types.js').Reading} Reading */

const NONE_LIMIT = 8;
const SPELLING_LIMIT = 6;

/** @param {any} result */
const found = (result) => Boolean(result) && (result.entries.length > 0 || (result.language === 'en' && result.forms_of.length > 0));

/**
 * Headwords one edit away from an English word, from the word list.
 * @param {string} q
 * @param {number} limit
 * @returns {Promise<string[]>}
 */
export async function closeOffline(q, limit = SPELLING_LIMIT) {
	const word = q.toLowerCase();
	if (detectLang(q) !== 'en' || !spellable(word)) return [];
	const index = await lowerIndex();
	if (!index) return [];
	/** @type {string[]} */
	const out = [];
	for (const c of edits1(word)) {
		const hit = index.get(c);
		if (hit && !out.includes(hit)) out.push(hit);
		if (out.length >= limit) break;
	}
	return out;
}

/** The English word list by lower case, built once. @type {Promise<Map<string, string> | null> | null} */
let lower = null;
function lowerIndex() {
	if (!lower) {
		lower = wordListOf('en').then((words) => (words ? new Map(words.map((w) => [w.toLowerCase(), w])) : null));
		lower.catch(() => (lower = null));
	}
	return lower;
}

/**
 * Myanmar text as headwords, known by the word list on the device.
 * @param {string} text
 */
async function myanmarWords(text) {
	const list = await wordListOf('my');
	const known = new Set(list ?? []);
	return chunks(text)
		.map(syllables)
		.flatMap((piece) => groupWords(piece, (w) => known.has(w)));
}

/**
 * A phrase from its words' entries, as worker/routes/phrase.js reads it.
 * @param {string} q
 * @returns {Promise<import('#shared/types.js').Phrase>}
 */
async function readPhrase(q) {
	const plan = planPhrase(q);
	if (!plan) return { q, pattern: null, myanmar: null, parts: [] };
	const look = async (/** @type {string} */ w) => /** @type {any} */ ((await lookupOffline(w, { count: false })) ?? { entries: [], forms_of: [], root_senses: {} });

	/** @param {string} term */
	const resolve = async (term) => {
		let one = await look(term);
		/** @type {'form' | 'spelling' | null} */
		let note = null;
		if (!one.entries.length && one.forms_of?.length) {
			const root = one.forms_of.map((/** @type {string[]} */ r) => r[0]).find((/** @type {string} */ r) => (one.root_senses?.[r] ?? 0) > 0);
			if (root) {
				one = await look(root);
				note = 'form';
			}
		}
		if (!one.entries.length && !term.includes(' ')) {
			const [near] = await closeOffline(term, 1);
			if (near) {
				one = await look(near);
				note = 'spelling';
			}
		}
		return { term, word: one.entries[0]?.word ?? term, note, senses: one.entries };
	};

	const parts0 = await Promise.all(plan.terms.map(resolve));
	const modifiers = parts0.map((f, i) => (i === plan.head ? null : bestSense(f.senses, { word: f.word, pattern: plan.pattern, role: 'modifier' })));
	const named = parts0.some((f, i) => i !== plan.head && isProper(f.word, modifiers[i]));
	/** @type {import('#shared/types.js').PhrasePart[]} */
	const parts = parts0.map((f, i) => {
		const sense = i === plan.head ? bestSense(f.senses, { word: f.word, pattern: plan.pattern, role: 'head', proper: named }) : modifiers[i];
		return /** @type {any} */ ({ term: f.term, word: f.word, note: f.note, entries: f.senses, fit: sense ? f.senses.indexOf(sense) : -1, sense });
	});
	return { q, pattern: plan.pattern, head: plan.head, myanmar: composeMyanmar(plan, parts.map((p) => p.sense)), parts };
}

/**
 * What a query is, from this device; null when the device has no senses for
 * its language (the caller then says there is no connection).
 * @param {string} q  Normalised.
 * @returns {Promise<(Reading & { offline: true, build: string }) | null>}
 */
export async function readOffline(q) {
	const lang = detectLang(q);
	const build = await sensesBuild(lang);
	if (!build) return null;
	const look = (/** @type {string} */ text) => lookupOffline(text);
	const marked = { offline: /** @type {const} */ (true), build };

	const result = await look(q);
	if (result && found(result)) return { q, kind: 'entry', result, ...marked };

	if (lang === 'en') {
		const phrase = await readPhrase(q);
		if (phrase.parts.some((p) => p.sense)) {
			tally(1);
			return { q, kind: 'phrase', phrase, ...marked };
		}
	}

	/** @type {Array<{ text: string, known?: boolean }>} */
	let words = lang === 'my' ? await myanmarWords(q) : spacedWords(q).map((text) => ({ text }));
	const seen = new Set();
	words = words.filter((w) => !seen.has(w.text.toLowerCase()) && seen.add(w.text.toLowerCase())).slice(0, SENTENCE_WORDS);

	if (words.length === 1 && words[0].text !== q && words[0].known !== false) {
		const one = await look(words[0].text);
		if (one && found(one)) return { q, kind: 'entry', result: one, ...marked };
	}
	if (words.length > 1) {
		const first = await look(words[0].text);
		return { q, kind: 'sentence', words, first: first && found(first) ? first : null, ...marked };
	}

	const list = await wordListOf(lang);
	const [close, starts] = await Promise.all([closeOffline(q, NONE_LIMIT), Promise.resolve(list ? startingWith(list, q, lang, NONE_LIMIT) : [])]);
	const same = (/** @type {string} */ w) => w.toLowerCase() === q.toLowerCase();
	return { q, kind: 'none', close: close.filter((w) => !same(w)), starts: starts.filter((w) => !same(w) && !close.includes(w)), ...marked };
}
