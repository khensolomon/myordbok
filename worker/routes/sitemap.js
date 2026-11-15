// @ts-check
/**
 * What search engines may read, and where every entry is.
 *
 *   GET /robots.txt        live: everything but the API and the workspace,
 *                          and the sitemap's address; beta: nothing
 *   GET /sitemap.xml       an index of the files below
 *   GET /sitemap/en-1.xml  English headwords that have meanings, SITEMAP_PAGE
 *                          to a file, as addresses of their definition pages
 *   GET /sitemap/my-1.xml  the same for Myanmar headwords
 *
 * The files are made from the dictionary this site reads, so they follow
 * each data release by themselves, and are kept at the edge for a day.
 * Headwords only the live layer has are not listed until a release holds
 * them.
 */
import { AppError } from '../../shared/errors.js';
import { dictionary, explainDictError } from '../lib/dict.js';

/** Addresses in one file; the format allows 50,000. */
export const SITEMAP_PAGE = 25_000;
const DAY = 86_400;

/** Headwords with at least one meaning, one spelling per word, in a stable order. */
const WORDS = {
	en: `SELECT min(w.word) AS word FROM eng_word w WHERE w.id IN (SELECT wrid FROM emd_sense) GROUP BY lower(w.word) ORDER BY min(w.id) LIMIT ?1 OFFSET ?2`,
	my: `SELECT w.word FROM mya_word w WHERE w.id IN (SELECT wrid FROM med_sense) ORDER BY w.id LIMIT ?1 OFFSET ?2`,
};
const COUNT = {
	en: 'SELECT count(DISTINCT lower(w.word)) AS n FROM eng_word w WHERE w.id IN (SELECT wrid FROM emd_sense)',
	my: 'SELECT count(*) AS n FROM mya_word w WHERE w.id IN (SELECT wrid FROM med_sense)',
};

const xml = (/** @type {string} */ s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * @param {string} body
 * @param {string} type
 */
const text = (body, type) => new Response(body, { headers: { 'content-type': `${type}; charset=utf-8`, 'cache-control': `public, max-age=${DAY}` } });

/**
 * @param {{ ENV_NAME?: string, NOINDEX?: string }} env
 * @param {URL} url
 */
export function robots(env, url) {
	// Only the live site is for search engines; beta (NOINDEX) and local development are not.
	if (env.ENV_NAME !== 'live' || env.NOINDEX === '1') return text('User-agent: *\nDisallow: /\n', 'text/plain');
	return text(`User-agent: *\nDisallow: /api/\nDisallow: /workspace\nDisallow: /account\n\nSitemap: ${url.origin}/sitemap.xml\n`, 'text/plain');
}

/**
 * GET /sitemap.xml and /sitemap/{en|my}-{n}.xml, from the edge when kept there.
 * @param {Request} request
 * @param {import('../lib/dict.js').DictEnv} env
 * @param {ExecutionContext} [ctx]
 * @returns {Promise<Response>}
 */
export async function sitemap(request, env, ctx) {
	// The Cache API exists only on Cloudflare (and wrangler dev); the tests have none.
	const cache = ctx && typeof caches !== 'undefined' ? /** @type {Cache} */ (/** @type {any} */ (caches).default) : null;
	const key = new Request(request.url, { method: 'GET' });
	const hit = await cache?.match(key);
	if (hit) return hit;
	const res = await make(new URL(request.url), env);
	if (cache && ctx) ctx.waitUntil(cache.put(key, res.clone()));
	return res;
}

/**
 * @param {URL} url
 * @param {import('../lib/dict.js').DictEnv} env
 */
async function make(url, env) {
	const { dict, db } = await dictionary(env);
	const failed = (/** @type {unknown} */ err) => {
		throw explainDictError(err, dict, env);
	};
	// The day of the build, as the day every entry was last changed.
	const built = /** @type {{ value: string } | null} */ (await db.prepare("SELECT value FROM meta WHERE key = 'built'").first().catch(failed));
	const day = /^\d{4}-\d{2}-\d{2}/.exec(built?.value ?? '')?.[0] ?? null;
	const lastmod = day ? `<lastmod>${day}</lastmod>` : '';

	if (url.pathname === '/sitemap.xml') {
		const counts = await Promise.all((/** @type {const} */ (['en', 'my'])).map(async (lang) => [lang, Number(/** @type {{ n: number }} */ (await db.prepare(COUNT[lang]).first().catch(failed)).n)]));
		const files = counts.flatMap(([lang, n]) => Array.from({ length: Math.ceil(Number(n) / SITEMAP_PAGE) }, (_, i) => `<sitemap><loc>${xml(`${url.origin}/sitemap/${lang}-${i + 1}.xml`)}</loc>${lastmod}</sitemap>`));
		return text(`<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${files.join('\n')}\n</sitemapindex>\n`, 'application/xml');
	}
	const file = /^\/sitemap\/(en|my)-([1-9]\d{0,3})\.xml$/.exec(url.pathname);
	if (!file) throw new AppError('not_found', `No sitemap at ${url.pathname}`);
	const lang = /** @type {'en' | 'my'} */ (file[1]);
	const { results } = await db
		.prepare(WORDS[lang])
		.bind(SITEMAP_PAGE, (Number(file[2]) - 1) * SITEMAP_PAGE)
		.all()
		.catch(failed);
	if (!results.length) throw new AppError('not_found', `No sitemap at ${url.pathname}`);
	const urls = results.map((r) => `<url><loc>${xml(`${url.origin}/definition?q=${encodeURIComponent(String(r.word))}`)}</loc>${lastmod}</url>`);
	return text(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`, 'application/xml');
}
