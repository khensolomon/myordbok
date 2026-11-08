// @ts-check
/**
 * Grammar content: static JSON made by the build from assets/data/thuddar
 * (scripts/grammar-data.js), kept by the service worker for offline use.
 */
import { AppError } from '#shared/errors.js';
import { getJSON } from '#platform/http.js';

/**
 * @typedef {object} GrammarTopicRef
 * @property {string} slug   URL part: /grammar/<slug>.
 * @property {string} name   English name, e.g. "Noun".
 * @property {string} my     Myanmar name, e.g. "နာမ်".
 * @property {string} desc   Myanmar definition.
 * @property {'pos' | 'other'} group  The nine parts of speech, or another topic.
 */

/**
 * @typedef {object} GrammarIndex
 * @property {{ name: string, desc: string, kind: Array<{ name: string, desc: string }> }} context
 * @property {GrammarTopicRef[]} topics  In reading order.
 */

/**
 * A section of a topic; topics nest sections in `kind`.
 * @typedef {object} GrammarNode
 * @property {{ name: string, desc?: string | null, note?: string | null }} root
 * @property {Array<{ name?: string, desc?: string, row?: string[] }>} [cate]   Classifications.
 * @property {Array<{ name?: string, desc?: string | string[] | null, row?: string[] }>} [word]  Example words.
 * @property {Array<{ name?: string, desc?: string[] | null, form?: Array<{ title: string[], chain?: string, caption?: string, row: string[][] }> }>} [exam]  Example sentences and tables.
 * @property {GrammarNode[]} [kind]
 */

/**
 * @typedef {GrammarNode & { slug: string, info: { name: string }, english?: Array<{ type: 'h1' | 'h2' | 'quote' | 'p', text: string }> }} GrammarTopic
 */

/** @type {Promise<GrammarIndex> | null} */
let indexRequest = null;

/** @returns {Promise<GrammarIndex>} */
export function grammarIndex() {
	indexRequest ??= getJSON('/data/grammar/index.json').catch((err) => {
		indexRequest = null; // try again next time
		throw err;
	});
	return indexRequest;
}

/**
 * @param {string} slug
 * @returns {Promise<GrammarTopic>}
 */
export async function grammarTopic(slug) {
	const index = await grammarIndex();
	if (!index.topics.some((t) => t.slug === slug)) throw new AppError('not_found', `No grammar topic "${slug}"`);
	return getJSON(`/data/grammar/${encodeURIComponent(slug)}.json`);
}
