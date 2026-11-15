// @ts-check
/**
 * The definition page as HTML (GET /definition?q=word), for readers that
 * run no script: search engines beyond Google, link previews, and Google's
 * first pass. The Worker takes the app's page (index.html) and writes into
 * it what the page is about: a title, a description, the address to index
 * it under, and one sentence in <main> (shared/summary.js), which the app
 * replaces with the entry once its scripts run.
 *
 *   an entry          the sentence; indexed under /definition?q=word
 *   a form (went)     "went: past tense of go"; indexed
 *   no entry          the page as it is, status 404, not indexed
 *   a phrase, a sentence, a sum, a question
 *                     the page as it is, not indexed
 *
 * The same page goes to every reader: nothing looks at who asks. The
 * sentence is the only dictionary text in it, and requests count towards
 * the heavy rate limit as the API's do; over the limit, the page goes out
 * as it is (the app says so when it asks the API). Whatever fails here,
 * the page still goes out as it is, and the error is logged: reading must
 * not depend on the summary.
 */
import { classify } from '../../shared/query/classify.js';
import { entrySummary, summaryText } from '../../shared/summary.js';
import { normalizeQuery } from '../../shared/validate.js';
import { dictionary } from '../lib/dict.js';
import { liveLayer } from '../lib/layer.js';
import { readQuery } from './read.js';

/**
 * What the Worker replaces in index.html; the build is tested to hold each
 * exactly once (tests/build.test.js).
 */
export const MARKS = Object.freeze({
	title: '<title>MyOrdbok</title>',
	description: /<meta name="description" content="[^"]*">/,
	head: '</head>',
	main: '<main id="view" tabindex="-1"></main>',
});

const escape = (/** @type {string} */ s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * index.html with the page's own head and a first content.
 * @param {string} html
 * @param {{ title: string, description: string | null, canonical: string | null, index: boolean, body: string | null }} page  body: HTML, already escaped.
 * @returns {string}
 */
export function writePage(html, page) {
	const once = (/** @type {string | RegExp} */ mark, /** @type {string} */ to) => {
		const found = typeof mark === 'string' ? html.split(mark).length - 1 : (html.match(new RegExp(mark, 'g')) ?? []).length;
		if (found !== 1) throw new Error(`index.html holds ${String(mark)} ${found} times, expected once`);
		html = html.replace(mark, () => to);
	};
	once(MARKS.title, `<title>${escape(page.title)} · MyOrdbok</title>`);
	if (page.description) once(MARKS.description, `<meta name="description" content="${escape(page.description)}">`);
	const head = [
		page.index ? '' : '<meta name="robots" content="noindex">',
		page.canonical ? `<link rel="canonical" href="${escape(page.canonical)}">` : '',
		page.index && page.description ? `<meta property="og:type" content="website"><meta property="og:site_name" content="MyOrdbok"><meta property="og:title" content="${escape(page.title)}"><meta property="og:description" content="${escape(page.description)}"><meta property="og:url" content="${escape(page.canonical ?? '')}">` : '',
	].join('');
	once(MARKS.head, `${head}</head>`);
	if (page.body) once(MARKS.main, `<main id="view" tabindex="-1">${page.body}</main>`);
	return html;
}

/**
 * @typedef {import('../lib/dict.js').DictEnv & import('../lib/guard.js').GuardEnv & { ASSETS: { fetch(request: Request): Promise<Response> } }} PageEnv
 */

/**
 * What the page says about a query, or null to send the page as it is.
 * @param {PageEnv} env
 * @param {URL} url
 * @returns {Promise<{ status: number, page: Parameters<typeof writePage>[1] } | null>}
 */
async function pageFor(env, url) {
	const raw = url.searchParams.get('q') ?? '';
	if (!raw.trim()) return null; // how to search: the page as it is
	const q = normalizeQuery(raw);
	const notIndexed = { status: 200, page: { title: q, description: null, canonical: null, index: false, body: null } };
	// A sum, a number, a question: answered by the app, nothing to index.
	const intent = classify(q);
	if (url.searchParams.get('exact') !== '1' && (intent.kind !== 'lookup' || intent.understood)) return notIndexed;

	const { db } = await dictionary(env);
	const layer = await liveLayer(env);
	const reading = await readQuery(db, q, layer.apply);
	if (reading.kind === 'none') return { status: 404, page: notIndexed.page };
	if (reading.kind !== 'entry') return notIndexed;

	const result = reading.result;
	// One address per headword, in its own spelling, however the query was typed (LOVE, Love).
	const word = (result.language === 'en' && result.entries[0]?.word) || result.query;
	const canonical = `${url.origin}/definition?q=${encodeURIComponent(word)}`;
	const lang = result.language === 'my' ? 'my' : 'en';
	if (!result.entries.length) {
		// Only a form of other words: said in a line, as the page says it.
		if (result.language !== 'en' || !result.forms_of.length) return notIndexed;
		const [root, pos, form] = result.forms_of[0];
		const line = `“${result.query}”: ${form}${pos ? ` (${pos})` : ''} of “${root}”`;
		return { status: 200, page: { title: line, description: `${line}, in the English–Myanmar dictionary.`, canonical, index: true, body: `<article class="page entry-summary"><h1 lang="en">${escape(result.query)}</h1><p>${escape(line)}</p></article>` } };
	}
	const summary = entrySummary(result);
	if (!summary) return notIndexed;
	const text = summaryText({ ...summary, word });
	return { status: 200, page: { title: text.title, description: text.sentence, canonical, index: true, body: `<article class="page entry-summary"><h1 lang="${lang}">${escape(word)}</h1><p>${escape(text.sentence)}</p></article>` } };
}

/**
 * GET /definition.
 * @param {Request} request
 * @param {PageEnv & { ENV_NAME?: string }} env
 * @returns {Promise<Response>}
 */
export async function definitionPage(request, env) {
	const url = new URL(request.url);
	// The app's page, as any other address gets it.
	const shell = await env.ASSETS.fetch(new Request(new URL('/', url), { headers: { accept: 'text/html' } }));
	if (!shell.ok || !(shell.headers.get('content-type') ?? '').includes('text/html')) return shell;
	const headers = new Headers(shell.headers);
	headers.delete('content-length');
	headers.delete('etag');
	// Beta is never indexed, whatever a page says of itself.
	if (env.ENV_NAME === 'beta') headers.set('x-robots-tag', 'noindex');
	const html = await shell.text();
	const asItIs = () => new Response(html, { status: 200, headers });
	try {
		if (env.API_GUARD === '1') {
			if (!env.RATE_HEAVY) throw new Error('Rate limit binding RATE_HEAVY is missing; it is declared in wrangler.toml for each environment.');
			const { success } = await env.RATE_HEAVY.limit({ key: request.headers.get('cf-connecting-ip') ?? 'unknown' });
			if (!success) {
				console.warn(JSON.stringify({ event: 'page_limited', country: /** @type {any} */ (request).cf?.country ?? null }));
				return asItIs();
			}
		}
		const found = await pageFor(env, url);
		if (!found) return asItIs();
		return new Response(writePage(html, found.page), { status: found.status, headers });
	} catch (err) {
		console.error(JSON.stringify({ event: 'page_failed', path: url.pathname + url.search, detail: err instanceof Error ? err.message : String(err) }));
		return asItIs();
	}
}

/** Addresses of the earlier site that have another home here. */
const MOVED = /** @type {Record<string, string>} */ ({ '/dictionary': '/', '/cookie-policy': '/privacy', '/health': '/api/health' });

/**
 * Where an address of the earlier site lives now, or null.
 * @param {string} pathname
 * @returns {string | null}
 */
export function movedTo(pathname) {
	const path = pathname.replace(/\/+$/, '');
	if (Object.hasOwn(MOVED, path)) return MOVED[path];
	// /dictionary/<language>: the dictionaries of other languages, not carried over.
	return path.startsWith('/dictionary/') ? '/' : null;
}
