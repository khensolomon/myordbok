// @ts-check
/**
 * GET /api/lookup?q=went
 * The full result for one query, from the dataset's own lookup
 * (shared/search, kept in step with the dataset by `make dataset-sync`), so
 * the site and the dataset's tests agree on every answer.
 */
import { d1Database, search } from '../../shared/search/search.mjs';
import statements from '../../shared/search/statements.js';
import { normalizeQuery } from '../../shared/validate.js';
import { dictionary, explainDictError } from '../lib/dict.js';
import { json } from '../lib/http.js';

/**
 * @param {URL} url
 * @param {import('../lib/dict.js').DictEnv} env
 */
export async function lookup(url, env) {
	const q = normalizeQuery(url.searchParams.get('q') ?? '');
	const { dict, db } = await dictionary(env);
	const result = await search(d1Database(db), statements, q).catch((err) => {
		throw explainDictError(err, dict, env);
	});
	return json(result, { cache: 300 });
}
