// @ts-check
/**
 * GET /api/stats: the dictionary in figures, for the search guide on
 * /definition with no word. Read from the statistics kept for the build the
 * site reads (build_stats, written by make data-publish or make data-stats);
 * null when none were kept for it. Kept at the edge for an hour.
 */
import { dictionary, explainDictError } from '../lib/dict.js';
import { json } from '../lib/http.js';

/** @param {import('../lib/dict.js').DictEnv & { APP: D1Database }} env */
export async function publicStats(env) {
	const { dict, db } = await dictionary(env);
	const built = /** @type {{ value: string } | null} */ (
		await db
			.prepare("SELECT value FROM meta WHERE key = 'built'")
			.first()
			.catch((err) => {
				throw explainDictError(err, dict, env);
			})
	)?.value ?? null;
	const row = built ? await env.APP.prepare('SELECT stats FROM build_stats WHERE build = ?1').bind(built).first() : null;
	const s = row ? JSON.parse(String(row.stats)) : null;
	const side = (/** @type {any} */ x) => ({ headwords: Number(x.headwords), senses: Number(x.senses), examples: Number(x.examples) });
	const stats = s ? { build: built, en: { ...side(s.en), forms: Number(s.en.forms), synsets: Number(s.en.synsets) }, my: { ...side(s.my), pronunciations: Number(s.my.pronunciations) } } : null;
	return json({ stats }, { headers: { 'cache-control': 'public, max-age=3600' } });
}
