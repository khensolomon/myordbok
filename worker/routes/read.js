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
 *   none      nothing: headwords one edit away and words starting the same way;
 *             whether the word is known at all (in eng_word or mya_word, with or
 *             without a meaning), and an editor's label of it from Searches
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
import { liveLayer } from '../lib/layer.js';
import { readPhrase } from './phrase.js';
import { closeWords } from './spelling.js';
import { startingWith } from './suggest.js';
import { zawgyiReading } from '../../shared/zawgyi/index.js';
import { variable, variants } from '../../shared/myanmar-variants.js';

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
 * @param {Over} [over]  Live edits laid over each lookup (worker/lib/layer.js).
 * @returns {Promise<Reading>}
 */
export function readQuery(db, q, over = asBuilt) {
	return zawgyiReading(q, (text) => readAsTyped(db, text, over));
}

/** @typedef {<T extends LookupResult>(result: T) => T} Over */
/** @type {Over} */
const asBuilt = (result) => result;

/**
 * @param {D1Database} db
 * @param {string} q  Normalised.
 * @param {Over} over
 * @returns {Promise<Reading>}
 */
async function readAsTyped(db, q, over) {
	const look = (/** @type {string} */ text) => /** @type {Promise<LookupResult>} */ (search(d1Database(db), statements, text)).then(over);
	const lang = detectLang(q);

	const result = await look(q);
	if (found(result)) return { q, kind: 'entry', result };

	if (lang === 'en') {
		const phrase = await readPhrase(db, q, over);
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

	const [found1, starts, known] = await Promise.all([closeWords(db, q, NONE_LIMIT), startingWith(db, q, NONE_LIMIT), isWord(db, q, lang)]);
	// A Myanmar word one common slip away from a headword (ျ/ြ, ိ/ီ, a tone mark…): its "did you mean".
	const close = lang === 'my' && !found1.length ? await myanmarSlips(db, q) : found1;
	const same = (/** @type {string} */ w) => w.toLowerCase() === q.toLowerCase();
	// Not a headword, but WordNet and Moby may still know it: the words around it, so the page leads on.
	const near =
		result.language === 'en'
			? { synonyms: result.synonyms.filter((w) => !same(w)), similar: result.similar.filter((w) => !same(w)), broader: result.broader, opposite: result.opposite, related: result.related }
			: null;
	const around = near && Object.values(near).some((list) => list.length) ? near : null;
	const more = result.language === 'en' ? { nearest: result.nearest ?? [], with_entry: result.with_entry ?? [] } : {};
	return { q, kind: 'none', known, close: close.filter((w) => !same(w)), starts: starts.filter((w) => !same(w) && !close.includes(w)), around, ...more };
}

/**
 * Whether the dictionary knows the word at all, defined or not: English
 * words come from WordNet, Moby and the forms table (eng_word), so one there
 * is a real word not yet defined; one that is not is more likely a misspelling.
 * @param {D1Database} db
 * @param {string} q
 * @param {'en' | 'my'} lang
 */
async function isWord(db, q, lang) {
	const sql = lang === 'en' ? 'SELECT 1 FROM eng_word WHERE word = ?1 COLLATE NOCASE LIMIT 1' : 'SELECT 1 FROM mya_word WHERE word = ?1 LIMIT 1';
	return Boolean(await db.prepare(sql).bind(q).first());
}

/**
 * Myanmar headwords with senses one common slip away from the text (shared/myanmar-variants.js).
 * @param {D1Database} db
 * @param {string} q
 */
async function myanmarSlips(db, q) {
	if (!variable(q)) return [];
	const { results } = await db.prepare(MYANMAR_KNOWN).bind(JSON.stringify(variants(q))).all();
	return results.map((r) => String(r.word)).slice(0, NONE_LIMIT);
}

/**
 * @param {URL} url
 * @param {import('../lib/dict.js').DictEnv & { APP: D1Database }} env
 */
export async function read(url, env) {
	const q = normalizeQuery(url.searchParams.get('q') ?? '');
	const { dict, db } = await dictionary(env);
	const layer = await liveLayer(env);
	const body = await readQuery(db, q, layer.apply).catch((err) => {
		throw explainDictError(err, dict, env);
	});
	// Nothing found: what editors decided about the word in Searches, if anything (migration 0016).
	if (body.kind === 'none') {
		const lang = detectLang(body.q);
		const mark = await env.APP.prepare('SELECT label, note FROM search_marks WHERE lang = ?1 AND term = ?2')
			.bind(lang, lang === 'en' ? body.q.toLowerCase() : body.q)
			.first();
		return json({ ...body, marked: mark ? { label: mark.label ?? null, note: mark.note ?? null } : null }, { cache: 300 });
	}
	return json(body, { cache: 300 });
}
