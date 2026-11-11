// @ts-check
/**
 * GET /api/popular: the words searched most over the last week, for the home
 * page. Only searches that found an entry, and only words searched at least
 * POPULAR_MIN times, so nothing typed by one person alone shows. The same for
 * everyone: kept at the edge for an hour (worker/lib/guard.js cached).
 */
import { json } from '../lib/http.js';

export const POPULAR_DAYS = 7;
export const POPULAR_MIN = 3;
const LIMIT = 12;

/** @param {{ APP: D1Database }} env */
export async function popular(env) {
	const since = new Date(Date.now() - (POPULAR_DAYS - 1) * 86_400_000).toISOString().slice(0, 10);
	const { results } = await env.APP.prepare(
		`SELECT lang, term, sum(hits) AS hits FROM search_counts
		 WHERE day >= ?1 AND found = 1
		 GROUP BY lang, term HAVING sum(hits) >= ?2
		 ORDER BY hits DESC, term LIMIT ?3`,
	)
		.bind(since, POPULAR_MIN, LIMIT)
		.all();
	return json({ days: POPULAR_DAYS, words: results.map((r) => ({ lang: r.lang, term: r.term })) }, { headers: { 'cache-control': 'public, max-age=3600' } });
}
