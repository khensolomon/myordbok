// @ts-check
/**
 * GET /api/read?q=…
 * One request that decides what a query is and returns it, so a slow
 * connection waits once (docs/query.md):
 *
 *   entry     a headword, or a form of one: the full lookup
 *   phrase    not an entry, but a phrase read from its words' entries
 *   sentence  several words: the words (Myanmar split into headwords), and
 *             the first word's lookup; the others are fetched when opened
 *   none      nothing: headwords one edit away and words starting the same way
 *
 * The browser has already answered numbers, sums and the time, and taken
 * any question off, before it asks this. A Myanmar query that finds no
 * entry and looks like Zawgyi is read again in Unicode (shared/zawgyi).
 */
import { d1Database, search } from '../../shared/search/search.mjs';
import statements from '../../shared/search/statements.js';
import { chunks, groupWords, spans, syllables } from '../../shared/query/segment.js';
import { SENTENCE_WORDS, spacedWords } from '../../shared/query/words.js';
import { detectLang, normalizeQuery } from '../../shared/validate.js';
import { dictionary, explainDictError } from '../lib/dict.js';
import { json } from '../lib/http.js';
import { readPhrase } from './phrase.js';
import { closeWords } from './spelling.js';
import { startingWith } from './suggest.js';
import { zawgyiReading } from '../../shared/zawgyi/index.js';

/** @typedef {import('../../shared/types.js').LookupResult} LookupResult */
/** @typedef {import('../../shared/types.js').Reading} Reading */

const NONE_LIMIT = 8;

/** Which spans are Myanmar headwords with senses. */
const MYANMAR_KNOWN = `SELECT DISTINCT w.word FROM json_each(?1) j
	JOIN mya_word w ON w.word = j.value
	WHERE EXISTS (SELECT 1 FROM med_sense s WHERE s.wrid = w.id)`;

/**
 * Myanmar text as headwords (shared/query/segment.js), asking the
 * dictionary once which of the possible spans exist.
 * @param {D1Database} db
 * @param {string} text
 * @returns {Promise<Array<{ text: string, known: boolean }>>}
 */
export async function myanmarWords(db, text) {
	const pieces = chunks(text).map(syllables);
	/** @type {Set<string>} */
	const candidates = new Set();
	for (const piece of pieces) for (const span of spans(piece)) candidates.add(span);
	if (!candidates.size) return [];
	const { results } = await db.prepare(MYANMAR_KNOWN).bind(JSON.stringify([...candidates])).all();
	const known = new Set(results.map((r) => String(r.word)));
	return pieces.flatMap((piece) => groupWords(piece, (w) => known.has(w)));
}

/**
 * @param {any} result  A lookup.
 * @returns {result is LookupResult}
 */
function found(result) {
	return result.entries.length > 0 || (result.language === 'en' && result.forms_of.length > 0);
}

/**
 * A query, read as typed, or in Unicode when it is Zawgyi.
 * @param {D1Database} db
 * @param {string} q  Normalised.
 * @returns {Promise<Reading>}
 */
export function readQuery(db, q) {
	return zawgyiReading(q, (text) => readAsTyped(db, text));
}

/**
 * @param {D1Database} db
 * @param {string} q  Normalised.
 * @returns {Promise<Reading>}
 */
async function readAsTyped(db, q) {
	const look = (/** @type {string} */ text) => /** @type {Promise<LookupResult>} */ (search(d1Database(db), statements, text));
	const lang = detectLang(q);

	const result = await look(q);
	if (found(result)) return { q, kind: 'entry', result };

	if (lang === 'en') {
		const phrase = await readPhrase(db, q);
		if (phrase.parts.some((p) => p.sense)) return { q, kind: 'phrase', phrase };
	}

	/** @type {Array<{ text: string, known?: boolean }>} */
	let words = lang === 'my' ? await myanmarWords(db, q) : spacedWords(q).map((text) => ({ text }));
	const seen = new Set();
	words = words.filter((w) => !seen.has(w.text.toLowerCase()) && seen.add(w.text.toLowerCase())).slice(0, SENTENCE_WORDS);

	// Only punctuation or spacing kept it from being found ("love!", "ချစ်။").
	if (words.length === 1 && words[0].text !== q && words[0].known !== false) {
		const one = await look(words[0].text);
		if (found(one)) return { q, kind: 'entry', result: one };
	}
	if (words.length > 1) {
		const first = await look(words[0].text);
		return { q, kind: 'sentence', words, first: found(first) ? first : null };
	}

	const [close, starts] = await Promise.all([closeWords(db, q, NONE_LIMIT), startingWith(db, q, NONE_LIMIT)]);
	const same = (/** @type {string} */ w) => w.toLowerCase() === q.toLowerCase();
	return { q, kind: 'none', close: close.filter((w) => !same(w)), starts: starts.filter((w) => !same(w) && !close.includes(w)) };
}

/**
 * @param {URL} url
 * @param {import('../lib/dict.js').DictEnv} env
 */
export async function read(url, env) {
	const q = normalizeQuery(url.searchParams.get('q') ?? '');
	const { dict, db } = await dictionary(env);
	const body = await readQuery(db, q).catch((err) => {
		throw explainDictError(err, dict, env);
	});
	return json(body, { cache: 300 });
}
