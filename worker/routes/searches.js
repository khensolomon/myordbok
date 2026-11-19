// @ts-check
/**
 * The workspace's Searches (search_counts), for editors and admins: every
 * word searched, summed over a period, to find what the dictionary lacks.
 *
 *   GET /api/workspace/searches             the list: ?show=missed|found|all
 *                                           (missed: never found in the period),
 *                                           ?days=1|3|5|7|30|90|0 (1: today, UTC; 0: all kept), ?lang=en|my,
 *                                           ?q= (contains), ?order=hits|recent|days|az
 *                                           (most searched first by default), ?offset=; 50 a page.
 *                                           ?label=open|none|add|misspelling|noise|all (open: to
 *                                           sort or to add, the default), ?min= searches at least,
 *                                           ?spread= days at least, ?shape=word|phrase|digits,
 *                                           ?fresh=1 first searched in the period, ?noted=1
 *                                           ?format=csv: every matching word as CSV
 *   GET /api/workspace/searches/word        ?lang=&term=: one word, day by day, its label
 *                                           and note, and headwords spelled nearly the same
 *   POST /api/workspace/searches/mark       { words: [{ lang, term }], label?, note? }: editors
 *                                           label up to 200 words at once (label null takes it
 *                                           off); a note goes on one word
 *   POST /api/workspace/searches/prune      { days }: admins delete the counts of days
 *                                           older than that many days (at least 30)
 *
 * A word never found is checked against the dictionary in use: "now" says it
 * has become a headword since, so the list shrinks as words are added.
 *
 * Labels (migration 0016) say what a word never found is: to add, a
 * misspelling, or not a word. A word without one is still to be sorted, and
 * the default list holds those and the ones to add, so that sorting the
 * list from the top leaves nothing important behind.
 */
import { AppError } from '../../shared/errors.js';
import { atLeast, seesStatistics } from '../../shared/roles.js';
import { TERM_MAX } from '../lib/counts.js';
import { dictionary, explainDictError } from '../lib/dict.js';
import { json } from '../lib/http.js';
import { closeWords } from './spelling.js';

/** @typedef {import('./auth.js').AuthEnv & import('../lib/dict.js').DictEnv} Env */
/** @typedef {import('../lib/session.js').Member} Member */

const NO_STORE = { headers: { 'cache-control': 'no-store' } };
const PAGE = 50;
/** Most rows one CSV holds. */
export const CSV_MAX = 10000;
const SHOWS = ['missed', 'found', 'all'];
export const LABELS = /** @type {const} */ (['add', 'misspelling', 'noise']);
/** What ?label= takes: a label, none (to sort), open (to sort or to add), all. */
const LABEL_VIEWS = { open: "(label IS NULL OR label = 'add')", none: 'label IS NULL', add: "label = 'add'", misspelling: "label = 'misspelling'", noise: "label = 'noise'", all: '' };
const MINS = [1, 2, 5, 10, 25];
const SPREADS = [1, 2, 5];
/** A word's shape: one word, several, or holding a digit. */
const SHAPES = { '': '', word: "term NOT LIKE '% %' AND term NOT GLOB '*[0-9]*'", phrase: "term LIKE '% %'", digits: "term GLOB '*[0-9]*'" };
/** Most words one request labels. */
export const MARK_MAX = 200;
const NOTE_MAX = 500;
const PERIODS = [1, 3, 5, 7, 30, 90, 0];
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
	if (request.method === 'POST' && sub === 'mark') return markWords(request, env, member);
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
	const label = p.get('label') ?? 'open';
	if (!Object.hasOwn(LABEL_VIEWS, label)) throw new AppError('bad_request', `label must be one of ${Object.keys(LABEL_VIEWS).join(', ')}`);
	const min = Number(p.get('min') ?? 1);
	if (!MINS.includes(min)) throw new AppError('bad_request', `min must be one of ${MINS.join(', ')}`);
	const spread = Number(p.get('spread') ?? 1);
	if (!SPREADS.includes(spread)) throw new AppError('bad_request', `spread must be one of ${SPREADS.join(', ')}`);
	const shape = p.get('shape') ?? '';
	if (!Object.hasOwn(SHAPES, shape)) throw new AppError('bad_request', 'shape must be word, phrase or digits');
	const flag = (/** @type {string} */ name) => {
		const v = p.get(name) ?? '';
		if (v !== '' && v !== '1') throw new AppError('bad_request', `${name} is 1 or left out`);
		return v === '1';
	};
	return {
		show, days, lang, q, offset, since, order: /** @type {keyof typeof ORDERS} */ (order),
		label: /** @type {keyof typeof LABEL_VIEWS} */ (label), min, spread, shape: /** @type {keyof typeof SHAPES} */ (shape), fresh: flag('fresh'), noted: flag('noted'),
	};
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
	if (f.shape) where.push(SHAPES[f.shape]);
	// First searched in the period: no count of an earlier day is kept.
	if (f.fresh) where.push('NOT EXISTS (SELECT 1 FROM search_counts o WHERE o.lang = search_counts.lang AND o.term = search_counts.term AND o.day < ?1)');
	const having = [f.min > 1 ? `sum(hits) >= ${f.min}` : '', f.spread > 1 ? `count(*) >= ${f.spread}` : ''].filter(Boolean);
	return {
		sql: `SELECT g.*, m.label, m.note FROM (
		        SELECT lang, term, sum(hits) AS hits, count(*) AS days, min(day) AS first, max(day) AS last, max(found) AS found
		        FROM search_counts WHERE ${where.join(' AND ')} GROUP BY lang, term${having.length ? ` HAVING ${having.join(' AND ')}` : ''}
		      ) g LEFT JOIN search_marks m ON m.lang = g.lang AND m.term = g.term`,
		args,
	};
}

/**
 * The rows of the list out of the grouped words: found or not, and the label.
 * A label says what a word never found is, so it narrows that list only.
 * @param {ReturnType<typeof filter>} f
 * @param {boolean} [anyLabel]  Leaves the label out (the counts by label).
 */
function having(f, anyLabel = false) {
	const where = [f.show === 'missed' ? 'found = 0' : f.show === 'found' ? 'found = 1' : '', !anyLabel && f.show === 'missed' ? LABEL_VIEWS[f.label] : '', f.noted ? 'note IS NOT NULL' : ''].filter(Boolean);
	return where.length ? `WHERE ${where.join(' AND ')}` : '';
}

/**
 * @param {Env} env
 * @param {URL} url
 */
async function list(env, url) {
	const f = filter(url);
	const g = grouped(f);
	const order = `ORDER BY ${ORDERS[f.order]}`;
	if (url.searchParams.get('format') === 'csv') {
		const { results } = await env.APP.prepare(`SELECT * FROM (${g.sql}) ${having(f)} ${order} LIMIT ${CSV_MAX}`).bind(...g.args).all();
		const now = await headwords(env, /** @type {any[]} */ (results).filter((r) => !r.found));
		const lines = [['language', 'word', 'searches', 'days', 'first', 'last', 'found', 'now_in_dictionary', 'label', 'note'].join(',')];
		for (const r of /** @type {any[]} */ (results)) {
			lines.push([r.lang, csvCell(String(r.term)), r.hits, r.days, r.first, r.last, r.found ? 'yes' : 'no', r.found ? '' : now.has(`${r.lang}:${r.term}`) ? 'yes' : 'no', r.label ?? '', csvCell(String(r.note ?? ''))].join(','));
		}
		const name = `searches-${f.show}-${f.days ? `${f.days}days` : 'all'}-${new Date().toISOString().slice(0, 10)}.csv`;
		return new Response(`${lines.join('\r\n')}\r\n`, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' } });
	}
	const [page, totals, shown0, labelled] = await Promise.all([
		env.APP.prepare(`SELECT * FROM (${g.sql}) ${having(f)} ${order} LIMIT ${PAGE + 1} OFFSET ${f.offset}`).bind(...g.args).all(),
		env.APP.prepare(`SELECT count(*) AS words, coalesce(sum(found = 0), 0) AS missed, coalesce(sum(found = 1), 0) AS found, coalesce(sum(hits), 0) AS hits FROM (${g.sql})`).bind(...g.args).first(),
		// How many the list holds as filtered, and the never-found words by label (whatever label is shown).
		env.APP.prepare(`SELECT count(*) AS n FROM (${g.sql}) ${having(f)}`).bind(...g.args).first(),
		env.APP.prepare(`SELECT coalesce(label, 'none') AS label, count(*) AS n FROM (${g.sql}) ${having({ ...f, show: 'missed' }, true)} GROUP BY 1`).bind(...g.args).all(),
	]);
	const labels = { none: 0, add: 0, misspelling: 0, noise: 0 };
	for (const r of labelled.results) labels[/** @type {keyof typeof labels} */ (String(r.label))] = Number(r.n);
	const rows = /** @type {any[]} */ (page.results);
	const more = rows.length > PAGE;
	const shown = rows.slice(0, PAGE);
	const now = await headwords(env, shown.filter((r) => !r.found));
	const t = /** @type {Record<string, number>} */ (totals);
	return json(
		{
			show: f.show,
			days: f.days,
			counts: { words: Number(t.words), missed: Number(t.missed), found: Number(t.found), hits: Number(t.hits), listed: Number(/** @type {{ n: number }} */ (shown0).n), labels },
			words: shown.map((r) => ({ lang: r.lang, term: r.term, hits: Number(r.hits), days: Number(r.days), first: r.first, last: r.last, found: Boolean(r.found), now: !r.found && now.has(`${r.lang}:${r.term}`), label: r.label ?? null, note: r.note ?? null })),
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
	const mark = await env.APP.prepare('SELECT m.label, m.note, m.marked_at, u.name AS marked_by FROM search_marks m LEFT JOIN users u ON u.id = m.marked_by AND m.marked_by > 0 WHERE m.lang = ?1 AND m.term = ?2').bind(lang, term).first();
	// Headwords spelled nearly the same: what "did you mean" offers a reader, to tell a misspelling from a missing word.
	const { dict, db } = await dictionary(env);
	const near = found || now ? [] : await closeWords(db, term).catch((err) => {
		throw explainDictError(err, dict, env);
	});
	return json({ lang, term, hits: daily.reduce((a, d) => a + d.hits, 0), found, now, daily, label: mark?.label ?? null, note: mark?.note ?? null, marked_by: mark?.marked_by ?? null, marked_at: mark?.marked_at ?? null, near }, NO_STORE);
}

/**
 * Labels words, or writes one word's note, for editors.
 * @param {Request} request
 * @param {Env} env
 * @param {Member} member
 */
async function markWords(request, env, member) {
	if (!atLeast(member.role, 'editor')) throw new AppError('forbidden', 'Only editors label searched words.');
	const body = /** @type {{ words?: unknown, label?: unknown, note?: unknown } | null} */ (await request.json().catch(() => null));
	const words = body?.words;
	if (!Array.isArray(words) || !words.length) throw new AppError('bad_request', 'Send { words: [{ lang, term }], label } or { words: [one], note }');
	if (words.length > MARK_MAX) throw new AppError('bad_request', `At most ${MARK_MAX} words at once.`);
	/** @type {Array<{ lang: string, term: string }>} */
	const clean = [];
	const seen = new Set();
	for (const w of words) {
		const lang = /** @type {any} */ (w)?.lang;
		const term = typeof (/** @type {any} */ (w)?.term) === 'string' ? /** @type {any} */ (w).term.normalize('NFC').trim() : '';
		if ((lang !== 'en' && lang !== 'my') || !term || term.length > TERM_MAX) throw new AppError('bad_request', 'Each word is { lang: en or my, term }');
		if (seen.has(`${lang}:${term}`)) continue;
		seen.add(`${lang}:${term}`);
		clean.push({ lang, term });
	}
	const hasLabel = body?.label !== undefined;
	const hasNote = body?.note !== undefined;
	if (!hasLabel && !hasNote) throw new AppError('bad_request', 'Send a label, a note, or both');
	const label = body?.label ?? null;
	if (label !== null && !LABELS.includes(/** @type {any} */ (label))) throw new AppError('bad_request', `label must be one of ${LABELS.join(', ')}, or null to take it off`);
	if (hasNote && clean.length !== 1) throw new AppError('bad_request', 'A note goes on one word at a time.');
	const rawNote = body?.note ?? null;
	if (rawNote !== null && typeof rawNote !== 'string') throw new AppError('bad_request', 'note must be text, or null');
	const note = typeof rawNote === 'string' ? rawNote.normalize('NFC').trim() || null : null;
	if (note && note.length > NOTE_MAX) throw new AppError('bad_request', `The note is too long: at most ${NOTE_MAX} characters.`);

	// One statement per word, all in one batch: every word is labelled or none is.
	// A word left with neither label nor note has no row.
	const set = () => env.APP.prepare(
		`INSERT INTO search_marks (lang, term, label, note, marked_by) VALUES (?1, ?2, ?3, ?4, ?5)
		 ON CONFLICT (lang, term) DO UPDATE SET
		   label = CASE WHEN ?6 THEN excluded.label ELSE label END,
		   note = CASE WHEN ?7 THEN excluded.note ELSE note END,
		   marked_by = excluded.marked_by, marked_at = unixepoch()`,
	);
	const statements = [];
	for (const w of clean) {
		// A new row needs a label or a note (the table says so); taking both off an unmarked word changes nothing.
		if (label === null && note === null) statements.push(env.APP.prepare('UPDATE search_marks SET label = CASE WHEN ?3 THEN NULL ELSE label END, note = CASE WHEN ?4 THEN NULL ELSE note END, marked_by = ?5, marked_at = unixepoch() WHERE lang = ?1 AND term = ?2 AND ((CASE WHEN ?3 THEN NULL ELSE label END) IS NOT NULL OR (CASE WHEN ?4 THEN NULL ELSE note END) IS NOT NULL)').bind(w.lang, w.term, hasLabel ? 1 : 0, hasNote ? 1 : 0, member.id), env.APP.prepare('DELETE FROM search_marks WHERE lang = ?1 AND term = ?2 AND (CASE WHEN ?3 THEN NULL ELSE label END) IS NULL AND (CASE WHEN ?4 THEN NULL ELSE note END) IS NULL').bind(w.lang, w.term, hasLabel ? 1 : 0, hasNote ? 1 : 0));
		else statements.push(set().bind(w.lang, w.term, label, note, member.id, hasLabel ? 1 : 0, hasNote ? 1 : 0));
	}
	await env.APP.batch(statements);
	return json({ ok: true, marked: clean.length, label, ...(hasNote ? { note } : {}) }, NO_STORE);
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
export function csvCell(value) {
	const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
	return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
