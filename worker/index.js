// @ts-check
/**
 * Worker entry: `/api/*` is handled here, everything else is a static asset.
 * A path the build lacks comes here too (wrangler.toml `not_found_handling`
 * "none"): an app page gets index.html, which makes deep links work, and a
 * missing file a 404 (asset()).
 * Bindings stay in this file and worker/lib; route modules receive env.
 */
import pkg from '../package.json' with { type: 'json' };
import { AppError } from '../shared/errors.js';
import { DATABASE_NAME, dictionary, explainDictError } from './lib/dict.js';
import { countSearch } from './lib/counts.js';
import { appOf, cached, guard } from './lib/guard.js';
import { errorResponse, json } from './lib/http.js';
import { auth, me, providersOffered } from './routes/auth.js';
import { devices, link } from './routes/link.js';
import { publicSupport } from './routes/support.js';
import { reactions, senses, suggestEdit } from './routes/contribute.js';
import { lookup } from './routes/lookup.js';
import { myMessages, seenMessages, sendMessage } from './routes/messages.js';
import { activeNotices } from './routes/notices.js';
import { comments } from './routes/comments.js';
import { packs } from './routes/packs.js';
import { popular } from './routes/popular.js';
import { workspace } from './routes/workspace.js';
import { phrase } from './routes/phrase.js';
import { read } from './routes/read.js';
import { spelling } from './routes/spelling.js';
import { definitionPage, movedTo, privacyPage } from './routes/page.js';
import { robots, sitemap } from './routes/sitemap.js';
import { appLinkFile } from './routes/app-links.js';
import { guideFile } from './routes/guide.js';
import { publicStats } from './routes/stats.js';
import { suggest } from './routes/suggest.js';
import { pronunciation } from './routes/pronunciation.js';
import { quiz } from './routes/quiz.js';
import { help } from './routes/help.js';
import { today } from './routes/today.js';
import { addUsage, reportUsage } from './lib/usage.js';
import { getSetting, getSettings } from './lib/settings.js';

/**
 * @typedef {import('./lib/dict.js').DictEnv & import('./lib/guard.js').GuardEnv & import('./routes/auth.js').AuthEnv & {
 *   ASSETS: Fetcher,
 *   NOINDEX?: string,
 *   APP_MIN?: string,
 * }} Env
 * NOINDEX is "1" on beta: every API response tells search engines not to index.
 * APP_MIN is the lowest app build still served (GET /api/site).
 * API_GUARD is "1" on beta and live: own pages only, rate limits, edge
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
 * GET /api/site: the switches the pages follow (worker/lib/settings.js), the
 * same for everyone, kept at the edge for a minute; the sign-in providers
 * offered (routes/auth.js, providersOffered); and the lowest app build
 * still served (APP_MIN in wrangler.toml, a build number: "161" of
 * 26.11.21+161), below which the app asks to be updated.
 * @param {Env} env
 */
async function siteSwitches(env) {
	const min = Number(env.APP_MIN ?? '0');
	if (!Number.isInteger(min) || min < 0) throw new AppError('internal', `APP_MIN must be a build number, not "${env.APP_MIN}"`);
	const s = await getSettings(env, ['site.readonly', 'comments.open', 'contact.open', 'ratings.open', 'suggestions.open', 'support.ask', 'support.lines', 'quiz.open', 'help.open']);
	return json(
		{ readonly: s['site.readonly'] === 'on', comments: s['comments.open'], contact: s['contact.open'] === 'on', ratings: s['ratings.open'] === 'on', suggestions: s['suggestions.open'] === 'on', support_ask: s['support.ask'] === 'on', support_lines: s['support.lines'], quiz: s['quiz.open'] === 'on', help: s['help.open'] === 'on', app: { min }, signin: await providersOffered(env) },
		{ headers: { 'cache-control': 'public, max-age=60' } },
	);
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
	const res = await cached(request, route, ctx, () => answer(request, env, url, parts));
	// A search page is counted after it is answered (worker/lib/counts.js).
	if (route === 'read' && ctx) {
		ctx.waitUntil(countSearch(env, res.clone()).catch((err) => console.error(JSON.stringify({ event: 'count_failed', error: String(err) }))));
	}
	// A pack sent is counted: to a device that had none, or again for a newer
	// build (the app says which, x-pack-update). Never holding the download up.
	if (route === 'packs' && parts.length === 2 && res.status === 200) {
		const name = `download.${parts[1]}.${request.headers.get('x-pack-update') === '1' ? 'update' : 'new'}`;
		const counting = addUsage(env, { [name]: 1 }).catch((err) => console.error(JSON.stringify({ event: 'usage_failed', name, error: String(err) })));
		if (ctx) ctx.waitUntil(counting);
		else await counting;
	}
	return res;
}

/**
 * @param {Request} request
 * @param {Env} env
 * @param {URL} url
 * @param {string[]} parts
 */
async function answer(request, env, url, parts) {
	if (parts[0] === 'auth') return auth(request, env, parts);
	// Linking the app checks who may ask itself (routes/link.js): it is
	// signing in, so read-only mode does not stop it.
	if (parts[0] === 'link') return link(request, env, parts);
	if (request.method === 'POST') {
		// Writes come only from this site's own pages (sign-out checks the same
		// itself), or from the app, which has no origin of this site and sends no
		// cookies; another site's page cannot send the app's header (guard.js).
		if (request.headers.get('origin') !== url.origin && !appOf(request)) throw new AppError('forbidden', 'Access denied.');
		// Removing a linked device is signing it out: allowed when read-only.
		if (parts[0] === 'devices') return devices(request, env, parts);
		// Read-only (setting site.readonly): every write waits, but changing that setting.
		const settingsWrite = parts[0] === 'workspace' && parts[1] === 'settings';
		if (!settingsWrite && (await getSetting(env, 'site.readonly')) === 'on') {
			throw new AppError('forbidden', 'MyOrdbok is read-only for a while. Reading and searching work; try again later.');
		}
		if (parts[0] === 'workspace') return workspace(request, env, parts);
		if (parts.length === 1 && parts[0] === 'reactions') return reactions(request, env);
		if (parts.length === 1 && parts[0] === 'edits') return suggestEdit(request, env);
		if (parts.length === 1 && parts[0] === 'messages') return sendMessage(request, env);
		if (parts.length === 2 && parts[0] === 'messages' && parts[1] === 'seen') return seenMessages(request, env);
		if (parts.length === 1 && parts[0] === 'usage') return reportUsage(request, env);
		if (parts[0] === 'comments') return comments(request, env, parts);
		if (parts[0] === 'quiz') return quiz(request, env, parts);
		if (parts[0] === 'help') return help(request, env, parts);
	}
	if (request.method !== 'GET') {
		throw new AppError('not_implemented', `${request.method} ${url.pathname} is not available yet`);
	}
	if (parts.length === 1) {
		if (parts[0] === 'health') return health(env);
		if (parts[0] === 'lookup') return lookup(url, env);
		if (parts[0] === 'suggest') return suggest(url, env);
		if (parts[0] === 'spelling') return spelling(url, env);
		if (parts[0] === 'pronunciation') return pronunciation(url);
		if (parts[0] === 'today') return today(url, env);
		if (parts[0] === 'phrase') return phrase(url, env);
		if (parts[0] === 'read') return read(url, env);
		if (parts[0] === 'me') return me(request, env);
		if (parts[0] === 'notices') return activeNotices(request, env, url);
		if (parts[0] === 'stats') return publicStats(env);
		if (parts[0] === 'site') return siteSwitches(env);
		if (parts[0] === 'support') return publicSupport(env);
		if (parts[0] === 'comments') return comments(request, env, parts);
		if (parts[0] === 'messages') return myMessages(request, env);
		if (parts[0] === 'reactions') return reactions(request, env);
		if (parts[0] === 'senses') return senses(request, env);
	}
	if (parts[0] === 'workspace') return workspace(request, env, parts);
	if (parts[0] === 'devices') return devices(request, env, parts);
	if (parts[0] === 'help') return help(request, env, parts);
	if (parts[0] === 'packs') return packs(request, env, parts);
	if (parts[0] === 'popular' && parts.length === 1 && request.method === 'GET') return popular(env);
	throw new AppError('not_found', `No API route for ${url.pathname}`);
}

/**
 * A file of the build; for a path it lacks, the app page or a 404. A path
 * with an extension other than .html names a file, and a missing file is a
 * 404: a page open across a release asks for scripts the release no longer
 * has, and the app page in their place would break the import, and the
 * service worker's copy. Any other path is an app page (/practice,
 * /grammar/noun): index.html, whose router shows the page or "Page not found".
 * @param {Request} request
 * @param {{ ASSETS: Fetcher }} env
 */
export async function asset(request, env) {
	const res = await env.ASSETS.fetch(request);
	if (res.status !== 404) return res;
	const url = new URL(request.url);
	if (/\.[A-Za-z0-9]+$/.test(url.pathname) && !url.pathname.endsWith('.html')) {
		return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
	}
	return env.ASSETS.fetch(new Request(new URL('/', url), { headers: { accept: 'text/html' } }));
}

export default {
	/**
	 * @param {Request} request
	 * @param {Env} env
	 * @param {ExecutionContext} [ctx]
	 */
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const { pathname } = url;
		// Only https is a registered sign-in address and keeps the session cookie;
		// a request over plain http (a typed address without https://) is sent
		// there first. Pages themselves are switched by the zone's Always Use
		// HTTPS; this covers the API, sign-in above all. Local development stays on http.
		if (url.protocol === 'http:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
			url.protocol = 'https:';
			return Response.redirect(url.toString(), 308);
		}
		if (!pathname.startsWith('/api/')) {
			// Addresses of the earlier site, and the definition page with what it is about (routes/page.js).
			const moved = movedTo(pathname);
			if (moved) return Response.redirect(new URL(moved, url).toString(), 301);
			if (pathname === '/definition' && request.method === 'GET') return definitionPage(request, env);
			if (pathname === '/privacy' && request.method === 'GET') return privacyPage(request, env);
			if (pathname === '/robots.txt') return robots(env, url);
			if (pathname.startsWith('/guide/') && request.method === 'GET') return guideFile(request, env);
			if (pathname.startsWith('/.well-known/')) {
				const file = appLinkFile(pathname);
				if (file) return file;
			}
			if (pathname === '/sitemap.xml' || pathname.startsWith('/sitemap/')) return sitemap(request, env, ctx).catch(errorResponse);
			return asset(request, env);
		}
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
