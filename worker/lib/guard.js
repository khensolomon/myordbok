// @ts-check
/**
 * Who may use the API, how often, and which answers come from the edge
 * cache. On when API_GUARD is "1" (beta and production); local development
 * and the tests run without it unless they set it.
 *
 * 1. Own pages only. Browsers send Sec-Fetch-Site, which a web page cannot
 *    set; anything but "same-origin" is refused. Browsers too old to send it
 *    (Safari before iOS 16.4) are recognised by a Referer on this site;
 *    requests with neither (scripts) are refused. The header can be forged by a script,
 *    so this keeps the API to the app in browsers; the rate limits are what
 *    slow a script down.
 * 2. Rate limits per visitor (IP address), counted by Cloudflare at each
 *    location: a generous one for lookups and suggestions, a stricter one
 *    for the routes that read many rows (read, phrase, spelling). A visitor
 *    over the limit is logged with a short hash, never the address itself.
 * 3. Edge cache: dictionary answers are kept at the Cloudflare location for
 *    as long as their Cache-Control allows (minutes), so a word asked again
 *    does not reach D1. Requests still count towards the limits.
 *
 * /api/health holds no dictionary data and stays open to monitoring, within
 * the lookup limit. /api/auth/* are page navigations, the callback coming
 * from Google or GitHub, so they are exempt from the same-origin rule; they
 * check their own state, and signing out checks Origin.
 */
import { AppError } from '../../shared/errors.js';

/**
 * @typedef {{ limit(options: { key: string }): Promise<{ success: boolean }> }} RateLimit
 * @typedef {{ API_GUARD?: string, RATE_LOOKUP?: RateLimit, RATE_HEAVY?: RateLimit }} GuardEnv
 */

/** Routes open to any caller. */
const OPEN = new Set(['health', 'auth']);
/** Routes that read many rows per request, and the contact form. */
const HEAVY = new Set(['read', 'phrase', 'spelling', 'messages']);
/** Routes whose answers depend only on the URL and the dictionary. */
const CACHED = new Set(['lookup', 'suggest', 'read', 'phrase', 'spelling', 'popular', 'notices', 'stats', 'site']);

/**
 * Refuses callers other than the app's own pages, and visitors over their
 * limit. Throws AppError forbidden or rate_limited.
 * @param {Request} request
 * @param {GuardEnv} env
 * @param {string} route  The first path part after /api/.
 */
export async function guard(request, env, route) {
	if (env.API_GUARD !== '1') return;
	const site = request.headers.get('sec-fetch-site');
	if (!OPEN.has(route) && !ownPage(request, site)) {
		console.warn(JSON.stringify({ event: 'api_refused', route, site: site ?? 'none', referer: refererKind(request), country: country(request) }));
		throw new AppError('forbidden', 'Access denied.');
	}
	const name = HEAVY.has(route) ? 'RATE_HEAVY' : 'RATE_LOOKUP';
	const limiter = env[name];
	if (!limiter) throw new AppError('internal', `Rate limit binding ${name} is missing; it is declared in wrangler.toml for each environment.`);
	const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
	const { success } = await limiter.limit({ key: ip });
	if (!success) {
		console.warn(JSON.stringify({ event: 'rate_limited', route, limit: name, visitor: await shortHash(ip), country: country(request) }));
		throw new AppError('rate_limited', 'Too many searches in a short time. Wait a minute, then try again.');
	}
}

/**
 * The answer for a GET from the edge cache when it is there; otherwise made,
 * and kept when it is a public, successful answer.
 * @param {Request} request
 * @param {string} route
 * @param {ExecutionContext | undefined} ctx
 * @param {() => Promise<Response>} make
 * @returns {Promise<Response>}
 */
export async function cached(request, route, ctx, make) {
	// The Cache API exists only on Cloudflare (and wrangler dev); the tests have none.
	if (!CACHED.has(route) || request.method !== 'GET' || !ctx || typeof caches === 'undefined') return make();
	const cache = /** @type {Cache} */ (/** @type {any} */ (caches).default);
	// Only the URL decides the answer; the request's own headers are left out of the key.
	const key = new Request(request.url, { method: 'GET' });
	const hit = await cache.match(key);
	if (hit) return new Response(hit.body, hit);
	const res = await make();
	if (res.status === 200 && /\bpublic\b/.test(res.headers.get('cache-control') ?? '')) ctx.waitUntil(cache.put(key, res.clone()));
	return res;
}

/**
 * Whether a request comes from this site's own pages: Sec-Fetch-Site says so
 * in current browsers; browsers that do not send it (Safari before iOS 16.4)
 * send a Referer on this site instead. Either header can be forged by a
 * script, which the rate limits are for.
 * @param {Request} request
 * @param {string | null} site
 */
function ownPage(request, site) {
	if (site !== null) return site === 'same-origin';
	return refererKind(request) === 'own';
}

/**
 * @param {Request} request
 * @returns {'own' | 'other' | 'none'}
 */
function refererKind(request) {
	const referer = request.headers.get('referer');
	if (!referer) return 'none';
	try {
		return new URL(referer).origin === new URL(request.url).origin ? 'own' : 'other';
	} catch {
		return 'other';
	}
}

/** @param {Request} request */
function country(request) {
	return /** @type {{ cf?: { country?: string } }} */ (request).cf?.country ?? null;
}

/**
 * The first 12 hex digits of SHA-256: enough to see one visitor return in
 * the logs, not enough to recover the address.
 * @param {string} text
 */
async function shortHash(text) {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return [...new Uint8Array(digest).slice(0, 6)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
