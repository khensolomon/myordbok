// @ts-check
/**
 * Worker entry: `/api/*` is handled here, everything else is a static asset.
 * Unknown app paths fall back to index.html (wrangler.toml
 * `not_found_handling`), which is what makes deep links work.
 * Bindings stay in this file and worker/lib; route modules receive env.
 */
import pkg from '../package.json' with { type: 'json' };
import { AppError } from '../shared/errors.js';
import { DATABASE_NAME, dictionary, explainDictError } from './lib/dict.js';
import { cached, guard } from './lib/guard.js';
import { errorResponse, json } from './lib/http.js';
import { auth, me } from './routes/auth.js';
import { reactions, senses, suggestEdit } from './routes/contribute.js';
import { lookup } from './routes/lookup.js';
import { phrase } from './routes/phrase.js';
import { read } from './routes/read.js';
import { spelling } from './routes/spelling.js';
import { suggest } from './routes/suggest.js';

/**
 * @typedef {import('./lib/dict.js').DictEnv & import('./lib/guard.js').GuardEnv & import('./routes/auth.js').AuthEnv & {
 *   ASSETS: Fetcher,
 *   NOINDEX?: string,
 * }} Env
 * NOINDEX is "1" on beta: every API response tells search engines not to index.
 * API_GUARD is "1" on beta and production: own pages only, rate limits, edge
 * cache (worker/lib/guard.js).
 */

/**
 * GET /api/health — the app version and the dictionary in use: its
 * database, build, source and row counts (meta), which the About page shows.
 * Answers even when no dictionary is published, saying why.
 * @param {Env} env
 */
async function health(env) {
	try {
		const { dict, db } = await dictionary(env);
		const { results } = await db
			.prepare('SELECT key, value FROM meta')
			.all()
			.catch((err) => {
				throw explainDictError(err, dict, env);
			});
		/** @type {Record<string, string>} */
		const meta = Object.fromEntries(results.map((r) => [String(r.key), String(r.value)]));
		/** @type {Record<string, number>} */
		const rows = {};
		for (const [key, value] of Object.entries(meta)) if (key.startsWith('rows.')) rows[key.slice(5)] = Number(value);
		return json({ ok: true, version: pkg.version, dictionary: { database: DATABASE_NAME[dict], built: meta.built ?? null, source: meta.source ?? null, rows } });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return json({ ok: false, version: pkg.version, dictionary: null, error: message }, { status: 503 });
	}
}

/**
 * @param {Request} request
 * @param {Env} env
 * @param {ExecutionContext} [ctx]
 */
async function api(request, env, ctx) {
	const url = new URL(request.url);
	const parts = url.pathname.split('/').filter(Boolean).slice(1); // drop "api"
	const route = parts[0] ?? '';
	await guard(request, env, route);
	return cached(request, route, ctx, () => answer(request, env, url, parts));
}

/**
 * @param {Request} request
 * @param {Env} env
 * @param {URL} url
 * @param {string[]} parts
 */
async function answer(request, env, url, parts) {
	if (parts[0] === 'auth') return auth(request, env, parts);
	if (request.method === 'POST') {
		// Writes come only from this site's own pages (sign-out checks the same itself).
		if (request.headers.get('origin') !== url.origin) throw new AppError('forbidden', 'Access denied.');
		if (parts.length === 1 && parts[0] === 'reactions') return reactions(request, env);
		if (parts.length === 1 && parts[0] === 'edits') return suggestEdit(request, env);
	}
	if (request.method !== 'GET') {
		throw new AppError('not_implemented', `${request.method} ${url.pathname} is not available yet`);
	}
	if (parts.length === 1) {
		if (parts[0] === 'health') return health(env);
		if (parts[0] === 'lookup') return lookup(url, env);
		if (parts[0] === 'suggest') return suggest(url, env);
		if (parts[0] === 'spelling') return spelling(url, env);
		if (parts[0] === 'phrase') return phrase(url, env);
		if (parts[0] === 'read') return read(url, env);
		if (parts[0] === 'me') return me(request, env);
		if (parts[0] === 'reactions') return reactions(request, env);
		if (parts[0] === 'senses') return senses(request, env);
	}
	throw new AppError('not_found', `No API route for ${url.pathname}`);
}

export default {
	/**
	 * @param {Request} request
	 * @param {Env} env
	 * @param {ExecutionContext} [ctx]
	 */
	async fetch(request, env, ctx) {
		const { pathname } = new URL(request.url);
		if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
		let res;
		try {
			res = await api(request, env, ctx);
		} catch (err) {
			res = errorResponse(err);
		}
		if (env.NOINDEX === '1') res.headers.set('x-robots-tag', 'noindex');
		return res;
	},
};
