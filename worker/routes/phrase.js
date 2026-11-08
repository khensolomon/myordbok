// @ts-check
/**
 * GET /api/phrase?q=king of danmark
 * A phrase that is not an entry, read from its words' entries (see
 * shared/query/phrase.js): each part is found as typed, as the root of a
 * form (kings → king) or by its spelling (danmark → Denmark); the sense that
 * fits the phrase is chosen and the Myanmar put together. One request, so a
 * slow connection waits once.
 */
import { d1Database, search } from '../../shared/search/search.mjs';
import statements from '../../shared/search/statements.js';
import { bestSense, composeMyanmar, isProper, planPhrase } from '../../shared/query/phrase.js';
import { normalizeQuery } from '../../shared/validate.js';
import { dictionary, explainDictError } from '../lib/dict.js';
import { json } from '../lib/http.js';
import { closeWords } from './spelling.js';

/** @typedef {import('../../shared/types.js').EnglishSense} EnglishSense */

/**
 * @param {URL} url
 * @param {import('../lib/dict.js').DictEnv} env
 */
export async function phrase(url, env) {
	const q = normalizeQuery(url.searchParams.get('q') ?? '');
	const plan = planPhrase(q);
	if (!plan) return json(/** @type {import('../../shared/types.js').Phrase} */ ({ q, pattern: null, myanmar: null, parts: [] }), { cache: 300 });
	const { dict, db } = await dictionary(env);
	const database = d1Database(db);
	const look = (/** @type {string} */ word) => /** @type {Promise<any>} */ (search(database, statements, word));

	/** @param {string} term */
	const resolve = async (term) => {
		let found = await look(term);
		/** @type {'form' | 'spelling' | null} */
		let note = null;
		if (!found.entries.length && found.forms_of?.length) {
			const root = found.forms_of.map((/** @type {string[]} */ r) => r[0]).find((/** @type {string} */ r) => (found.root_senses[r] ?? 0) > 0);
			if (root) {
				found = await look(root);
				note = 'form';
			}
		}
		if (!found.entries.length && !term.includes(' ')) {
			const [near] = await closeWords(db, term, 1);
			if (near) {
				found = await look(near);
				note = 'spelling';
			}
		}
		/** @type {EnglishSense[]} */
		const senses = found.entries;
		return { term, word: senses[0]?.word ?? term, note, senses };
	};

	const found = await Promise.all(plan.terms.map(resolve)).catch((err) => {
		throw explainDictError(err, dict, env);
	});
	// The describing part first: whether it names something decides the head's sense.
	const modifiers = found.map((f, i) => (i === plan.head ? null : bestSense(f.senses, { word: f.word, pattern: plan.pattern, role: 'modifier' })));
	const named = found.some((f, i) => i !== plan.head && isProper(f.word, modifiers[i]));
	const parts = found.map((f, i) => ({
		term: f.term,
		word: f.word,
		note: f.note,
		senses: f.senses.length,
		sense: i === plan.head ? bestSense(f.senses, { word: f.word, pattern: plan.pattern, role: 'head', proper: named }) : modifiers[i],
	}));
	const myanmar = composeMyanmar(plan, parts.map((p) => p.sense));
	/** @type {import('../../shared/types.js').Phrase} */
	const body = { q, pattern: plan.pattern, head: plan.head, myanmar, parts };
	return json(body, { cache: 300 });
}
