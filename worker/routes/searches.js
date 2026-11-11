// @ts-check
/**
 * The workspace's Searches (search_counts), for editors and admins: every
 * word searched, summed over a period, to find what the dictionary lacks.
 *
 *   GET /api/workspace/searches             the list: ?show=missed|found|all
 *                                           (missed: never found in the period),
 *                                           ?days=7|30|90|0 (0: all kept), ?lang=en|my,
 *                                           ?q= (contains), ?order=hits|recent|days|az
 *                                           (most searched first by default), ?offset=; 50 a page.
 *                                           ?format=csv: every matching word as CSV
 *   GET /api/workspace/searches/word        ?lang=&term=: one word, day by day
 *   POST /api/workspace/searches/prune      { days }: admins delete the counts of days
 *                                           older than that many days (at least 30)
 *
 * A word never found is checked against the dictionary in use: "now" says it
 * has become a headword since, so the list shrinks as words are added.
 */
import { AppError } from '../../shared/errors.js';
import { atLeast, seesStatistics } from '../../shared/roles.js';
import { TERM_MAX } from '../lib/counts.js';
import { dictionary, explainDictError } from '../lib/dict.js';
import { json } from '../lib/http.js';

/** @typedef {import('./auth.js').AuthEnv & import('../lib/dict.js').DictEnv} Env */
/** @typedef {import('../lib/session.js').Member} Member */

const NO_STORE = { headers: { 'cache-control': 'no-store' } };
const PAGE = 50;
/** Most rows one CSV holds. */
export const CSV_MAX = 10000;
const SHOWS = ['missed', 'found', 'all'];
const PERIODS = [7, 30, 90, 0];
/** Orders of the list, and how each sorts. */
const ORDERS = {
	hits: 'hits DESC, last DESC, term',
	recent: 'last DESC, hits DESC, term',
	days: 'days DESC, hits DESC, term',
	az: 'term, lang',
};

/**
 * @param {Request} request
 * @param {Env} env
 * @param {Member} member
 * @param {string | undefined} sub
 */
export async function searches(request, env, member, sub) {
	if (!seesStatistics(member)) throw new AppError('forbidden', 'Searches are for editors and members shown the statistics.');
	const url = new URL(request.url);
	if (request.method === 'POST' && sub === 'prune') return prune(request, env, member);
	if (request.method !== 'GET') throw new AppError('not_found', `No API route for ${request.method} ${url.pathname}`);
	if (sub === 'word') return word(env, url);
	if (sub !== undefined) throw new AppError('not_found', `No API route for ${url.pathname}`);
	return list(env, url);
}

/**
 * The filter in the address, checked.
 * @param {URL} url
 */
function filter(url) {
	const p = url.searchParams;
	const show = p.get('show') ?? 'missed';
	if (!SHOWS.includes(show)) throw new AppError('bad_request', `show must be one of ${SHOWS.join(', ')}`);
	const days = Number(p.get('days') ?? 30);
	if (!PERIODS.includes(days)) throw new AppError('bad_request', `days must be one of ${PERIODS.join(', ')}`);
	const lang = p.get('lang') ?? '';
	if (!['', 'en', 'my'].includes(lang)) throw new AppError('bad_request', 'lang must be en or my');
	const q = (p.get('q') ?? '').normalize('NFC').trim().toLowerCase();
	if (q.length > TERM_MAX) throw new AppError('bad_request', `q is longer than ${TERM_MAX} characters`);
	const offset = Number(p.get('offset') ?? 0);
	if (!Number.isInteger(offset) || offset < 0) throw new AppError('bad_request', 'offset must be a whole number');
	// The first day counted: days ago, today included; 0 keeps every day.
	const since = days ? new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10) : '0000-00-00';
	const order = p.get('order') ?? 'hits';
	if (!Object.hasOwn(ORDERS, order)) throw new AppError('bad_request', `order must be one of ${Object.keys(ORDERS).join(', ')}`);
	return { show, days, lang, q, offset, since, order: /** @type {keyof typeof ORDERS} */ (order) };
}

/**
 * Words of the period, summed, before the found filter: the SQL and its arguments.
 * @param {ReturnType<typeof filter>} f
 */
function grouped(f) {
	const where = ['day >= ?1'];
	/** @type {unknown[]} */
	const args = [f.since];
	if (f.lang) where.push(`lang = ?${args.push(f.lang)}`);
	if (f.q) where.push(`term LIKE ?${args.push(`%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`)} ESCAPE '\\'`);
	return {
		sql: `SELECT lang, term, sum(hits) AS hits, count(*) AS days, min(day) AS first, max(day) AS last, max(found) AS found
		      FROM search_counts WHERE ${where.join(' AND ')} GROUP BY lang, term`,
		args,
	};
}

/** @param {string} show */
const having = (show) => (show === 'missed' ? 'WHERE found = 0' : show === 'found' ? 'WHERE found = 1' : '');

/**
 * @param {Env} env
 * @param {URL} url
 */
async function list(env, url) {
	const f = filter(url);
	const g = grouped(f);
	const order = `ORDER BY ${ORDERS[f.order]}`;
	if (url.searchParams.get('format') === 'csv') {
		const { results } = await env.APP.prepare(`SELECT * FROM (${g.sql}) ${having(f.show)} ${order} LIMIT ${CSV_MAX}`).bind(...g.args).all();
		const now = await headwords(env, /** @type {any[]} */ (results).filter((r) => !r.found));
		const lines = [['language', 'word', 'searches', 'days', 'first', 'last', 'found', 'now_in_dictionary'].join(',')];
		for (const r of /** @type {any[]} */ (results)) {
			lines.push([r.lang, csvCell(String(r.term)), r.hits, r.days, r.first, r.last, r.found ? 'yes' : 'no', r.found ? '' : now.has(`${r.lang}:${r.term}`) ? 'yes' : 'no'].join(','));
		}
		const name = `searches-${f.show}-${f.days ? `${f.days}days` : 'all'}-${new Date().toISOString().slice(0, 10)}.csv`;
		return new Response(`${lines.join('\r\n')}\r\n`, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' } });
	}
	const [page, totals] = await Promise.all([
		env.APP.prepare(`SELECT * FROM (${g.sql}) ${having(f.show)} ${order} LIMIT ${PAGE + 1} OFFSET ${f.offset}`).bind(...g.args).all(),
		env.APP.prepare(`SELECT count(*) AS words, coalesce(sum(found = 0), 0) AS missed, coalesce(sum(found = 1), 0) AS found, coalesce(sum(hits), 0) AS hits FROM (${g.sql})`).bind(...g.args).first(),
	]);
	const rows = /** @type {any[]} */ (page.results);
	const more = rows.length > PAGE;
	const shown = rows.slice(0, PAGE);
	const now = await headwords(env, shown.filter((r) => !r.found));
	const t = /** @type {Record<string, number>} */ (totals);
	return json(
		{
			show: f.show,
			days: f.days,
			counts: { words: Number(t.words), missed: Number(t.missed), found: Number(t.found), hits: Number(t.hits) },
			words: shown.map((r) => ({ lang: r.lang, term: r.term, hits: Number(r.hits), days: Number(r.days), first: r.first, last: r.last, found: Boolean(r.found), now: !r.found && now.has(`${r.lang}:${r.term}`) })),
			more,
		},
		NO_STORE,
	);
}

/**
 * One word, every day it was searched.
 * @param {Env} env
 * @param {URL} url
 */
async function word(env, url) {
	const lang = url.searchParams.get('lang') ?? '';
	const term = (url.searchParams.get('term') ?? '').normalize('NFC').trim();
	if (!['en', 'my'].includes(lang) || !term || term.length > TERM_MAX) throw new AppError('bad_request', 'Give lang (en or my) and term');
	const { results } = await env.APP.prepare('SELECT day, hits, found FROM search_counts WHERE lang = ?1 AND term = ?2 ORDER BY day').bind(lang, term).all();
	if (!results.length) throw new AppError('not_found', `“${term}” was not searched.`);
	const daily = results.map((r) => ({ day: String(r.day), hits: Number(r.hits), found: Boolean(r.found) }));
	const found = daily.some((d) => d.found);
	const now = found ? false : (await headwords(env, [{ lang, term }])).size > 0;
	return json({ lang, term, hits: daily.reduce((a, d) => a + d.hits, 0), found, now, daily }, NO_STORE);
}

/** Fewest days of counts a prune keeps. */
export const PRUNE_MIN_DAYS = 30;

/**
 * Deletes the counts older than the given number of days, for admins.
 * @param {Request} request
 * @param {Env} env
 * @param {Member} member
 */
async function prune(request, env, member) {
	if (!atLeast(member.role, 'admin')) throw new AppError('forbidden', 'Only admins delete search counts.');
	const body = /** @type {{ days?: unknown } | null} */ (await request.json().catch(() => null));
	const days = Number(body?.days);
	if (!Number.isInteger(days) || days < PRUNE_MIN_DAYS || days > 36500) throw new AppError('bad_request', `days must be a whole number of at least ${PRUNE_MIN_DAYS}`);
	// Days older than this many: the cut-off day itself and later stay.
	const keepFrom = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
	const { meta } = await env.APP.prepare('DELETE FROM search_counts WHERE day < ?1').bind(keepFrom).run();
	return json({ ok: true, deleted: Number(meta.changes ?? 0), keptFrom: keepFrom }, NO_STORE);
}

/**
 * Which of these never-found words are headwords in the dictionary now,
 * as "lang:term" (English without regard to case).
 * @param {Env} env
 * @param {Array<{ lang: string, term: string }>} words
 * @returns {Promise<Set<string>>}
 */
async function headwords(env, words) {
	/** @type {Set<string>} */
	const out = new Set();
	if (!words.length) return out;
	const { dict, db } = await dictionary(env);
	for (const [lang, sql] of /** @type {const} */ ([
		['en', 'SELECT lower(word) AS term FROM eng_word WHERE word COLLATE NOCASE IN (SELECT value FROM json_each(?1))'],
		['my', 'SELECT word AS term FROM mya_word WHERE word IN (SELECT value FROM json_each(?1))'],
	])) {
		const terms = words.filter((w) => w.lang === lang).map((w) => w.term);
		// json_each takes the list in one bound value; long CSV lists go in slices.
		for (let i = 0; i < terms.length; i += 500) {
			const { results } = await db
				.prepare(sql)
				.bind(JSON.stringify(terms.slice(i, i + 500)))
				.all()
				.catch((err) => {
					throw explainDictError(err, dict, env);
				});
			for (const r of results) out.add(`${lang}:${r.term}`);
		}
	}
	return out;
}

/**
 * A CSV field: quoted when it holds a comma, quote or line break; a leading
 * =, +, - or @ is prefixed so spreadsheets do not run it as a formula.
 * @param {string} value
 */
function csvCell(value) {
	const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
	return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
