// @ts-check
/**
 * Worker entry: `/api/*` is handled here, everything else is a static asset.
 * Unknown app paths fall back to index.html (wrangler.toml
 * `not_found_handling`), which is what makes deep links work.
 * Bindings stay in this file; route modules receive only what they need.
 */
import pkg from '../package.json' with { type: 'json' };
import { AppError } from '../shared/errors.js';
import { entry } from './routes/entry.js';
import { search } from './routes/search.js';
import { errorResponse, json } from './lib/http.js';

/**
 * @typedef {object} Env
 * @property {D1Database} DB
 * @property {Fetcher} ASSETS
 */

/**
 * @param {Request} request
 * @param {Env} env
 */
async function api(request, env) {
	const url = new URL(request.url);
	const parts = url.pathname.split('/').filter(Boolean).slice(1); // drop "api"

	if (request.method !== 'GET') {
		throw new AppError('not_implemented', `${request.method} ${url.pathname} is not available yet`);
	}
	if (parts[0] === 'health' && parts.length === 1) return json({ ok: true, version: pkg.version });
	if (parts[0] === 'search' && parts.length === 1) return search(url, env);
	if (parts[0] === 'entry' && parts.length === 3) return entry(parts[1], parts[2], env);

	throw new AppError('not_found', `No API route for ${url.pathname}`);
}

export default {
	/**
	 * @param {Request} request
	 * @param {Env} env
	 */
	async fetch(request, env) {
		const { pathname } = new URL(request.url);
		if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
		try {
			return await api(request, env);
		} catch (err) {
			return errorResponse(err);
		}
	},
};
