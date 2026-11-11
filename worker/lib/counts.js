// @ts-check
/**
 * Search counts: one per search page (/api/read), per word and day, with
 * whether the dictionary had it. Counted after the answer is ready, cached
 * or not, and never holding it up (waitUntil). Nothing about who searched is
 * kept. Suggestions while typing are not counted, and numbers, sums and the
 * time never reach the server.
 */
import { detectLang } from '../../shared/validate.js';
import { getSettings } from './settings.js';

/** Longest term counted; longer text (sentences) is not kept. */
export const TERM_MAX = 60;

/**
 * @param {{ APP: D1Database }} env
 * @param {Response} res  The /api/read answer.
 */
export async function countSearch(env, res) {
	if (res.status !== 200) return;
	const body = /** @type {{ q?: string, kind?: string }} */ (await res.json().catch(() => ({})));
	const q = (body.q ?? '').normalize('NFC').trim();
	if (!q || q.length > TERM_MAX) return;
	const lang = detectLang(q);
	const term = lang === 'en' ? q.toLowerCase() : q;
	const found = body.kind === 'none' ? 0 : 1;
	const set = await getSettings(env, ['searches.count', 'searches.keep_days']);
	if (set['searches.count'] !== 'on') return;
	// Old days go as new ones come in, about once in two hundred counts.
	if (set['searches.keep_days'] && Math.random() < 0.005) {
		const keepFrom = new Date(Date.now() - (set['searches.keep_days'] - 1) * 86400000).toISOString().slice(0, 10);
		await env.APP.prepare('DELETE FROM search_counts WHERE day < ?1').bind(keepFrom).run();
	}
	await env.APP.prepare(
		`INSERT INTO search_counts (day, lang, term, found) VALUES (?1, ?2, ?3, ?4)
		 ON CONFLICT (day, lang, term) DO UPDATE SET hits = hits + 1, found = excluded.found`,
	)
		.bind(new Date().toISOString().slice(0, 10), lang, term, found)
		.run();
}
