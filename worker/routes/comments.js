// @ts-check
/**
 * Comments on an entry (table comments, migrations 0001 and 0010): plain
 * text from signed-in members, shown under the entry with the member's name.
 * They show at once; editors hide one in the workspace, and its author
 * deletes it. The site setting comments.open closes new comments.
 *
 *   GET  /api/comments?lang=&word=               the entry's comments, newest first
 *   POST /api/comments                           { lang, word, body }: a member's comment
 *   POST /api/comments/{id}/delete               the author deletes their own
 *   GET  /api/workspace/comments?show=visible|hidden&q=&offset=   editors: all of them
 *   POST /api/workspace/comments/{id}            { status: visible | hidden }, editors
 */
import { AppError } from '../../shared/errors.js';
import { atLeast } from '../../shared/roles.js';
import { json } from '../lib/http.js';
import { currentMember } from '../lib/session.js';
import { getSetting } from '../lib/settings.js';

/** @typedef {import('./auth.js').AuthEnv} Env */
/** @typedef {import('../lib/session.js').Member} Member */

const NO_STORE = { headers: { 'cache-control': 'no-store' } };
export const BODY_MAX = 1000;
const WORD_MAX = 60;
/** Most comments shown under one entry. */
const SHOWN = 100;
/** Most comments one member posts in RECENT seconds. */
const BURST = 5;
const RECENT = 600;
const PAGE = 50;

/**
 * @param {URLSearchParams | Record<string, unknown>} from
 */
function entryOf(from) {
	const get = (/** @type {string} */ k) => (from instanceof URLSearchParams ? from.get(k) : from[k]);
	const lang = get('lang');
	const word = typeof get('word') === 'string' ? String(get('word')).normalize('NFC').trim() : '';
	if (lang !== 'en' && lang !== 'my') throw new AppError('bad_request', 'lang must be en or my');
	if (!word || word.length > WORD_MAX) throw new AppError('bad_request', `word must be 1 to ${WORD_MAX} characters`);
	return { lang, word };
}

/**
 * /api/comments and /api/comments/{id}/delete.
 * @param {Request} request
 * @param {Env} env
 * @param {string[]} parts
 */
export async function comments(request, env, parts) {
	const url = new URL(request.url);
	if (request.method === 'GET' && parts.length === 1) return list(request, env, url);
	if (request.method === 'POST' && parts.length === 1) return post(request, env);
	if (request.method === 'POST' && parts.length === 3 && /^\d+$/.test(parts[1]) && parts[2] === 'delete') return remove(request, env, Number(parts[1]));
	throw new AppError('not_found', `No API route for ${request.method} ${url.pathname}`);
}

/**
 * @param {Request} request
 * @param {Env} env
 * @param {URL} url
 */
async function list(request, env, url) {
	const { lang, word } = entryOf(url.searchParams);
	const [member, open] = await Promise.all([currentMember(request, env), getSetting(env, 'comments.open')]);
	const { results } = await env.APP.prepare(
		`SELECT c.id, c.body, c.created_at, c.user_id, u.name, u.avatar_url FROM comments c JOIN users u ON u.id = c.user_id
		 WHERE c.lang = ?1 AND c.word = ?2 AND c.status = 'visible' AND u.status = 'active' ORDER BY c.created_at DESC, c.id DESC LIMIT ?3`,
	)
		.bind(lang, word, SHOWN)
		.all();
	return json(
		{
			open: open === 'on',
			signedIn: member !== null,
			comments: results.map((r) => ({ id: Number(r.id), body: r.body, at: Number(r.created_at), name: r.name, avatar_url: r.avatar_url, own: member !== null && Number(r.user_id) === member.id })),
		},
		NO_STORE,
	);
}

/**
 * @param {Request} request
 * @param {Env} env
 */
async function post(request, env) {
	const member = await currentMember(request, env);
	if (!member) throw new AppError('unauthorized', 'Sign in to comment.');
	if ((await getSetting(env, 'comments.open')) !== 'on') throw new AppError('forbidden', 'Comments are closed for now.');
	const data = /** @type {Record<string, unknown> | null} */ (await request.json().catch(() => null));
	if (!data) throw new AppError('bad_request', 'Send { lang, word, body }');
	const { lang, word } = entryOf(data);
	const body = cleanBody(data.body);
	const recent = /** @type {{ n: number }} */ (await env.APP.prepare('SELECT count(*) AS n FROM comments WHERE user_id = ?1 AND created_at > unixepoch() - ?2').bind(member.id, RECENT).first());
	if (Number(recent.n) >= BURST) throw new AppError('rate_limited', 'That is a lot of comments in a short time. Wait a few minutes, then try again.');
	const row = /** @type {{ id: number, created_at: number }} */ (
		await env.APP.prepare('INSERT INTO comments (user_id, lang, word, body) VALUES (?1, ?2, ?3, ?4) RETURNING id, created_at').bind(member.id, lang, word, body).first()
	);
	return json({ comment: { id: Number(row.id), body, at: Number(row.created_at), name: member.name, avatar_url: member.avatar_url, own: true } }, NO_STORE);
}

/**
 * The text as kept: trimmed, at most one blank line in a row.
 * @param {unknown} value
 */
export function cleanBody(value) {
	if (typeof value !== 'string') throw new AppError('bad_request', 'body must be text');
	const body = value
		.normalize('NFC')
		.replace(/\r\n?/g, '\n')
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
	if (body.length < 2) throw new AppError('bad_request', 'Write a little more.');
	if (body.length > BODY_MAX) throw new AppError('bad_request', `A comment is at most ${BODY_MAX} characters.`);
	return body;
}

/**
 * @param {Request} request
 * @param {Env} env
 * @param {number} id
 */
async function remove(request, env, id) {
	const member = await currentMember(request, env);
	if (!member) throw new AppError('unauthorized', 'Sign in first.');
	const { meta } = await env.APP.prepare('DELETE FROM comments WHERE id = ?1 AND user_id = ?2').bind(id, member.id).run();
	if (!meta.changes) throw new AppError('not_found', `You have no comment ${id}.`);
	return json({ ok: true }, NO_STORE);
}

/**
 * The workspace's Comments, for editors.
 * @param {Request} request
 * @param {Env} env
 * @param {Member} member
 * @param {string | undefined} id
 */
export async function moderateComments(request, env, member, id) {
	if (!atLeast(member.role, 'editor')) throw new AppError('forbidden', 'Comments are moderated by editors.');
	const url = new URL(request.url);
	if (request.method === 'GET' && id === undefined) {
		const show = url.searchParams.get('show') ?? 'visible';
		if (show !== 'visible' && show !== 'hidden') throw new AppError('bad_request', 'show must be visible or hidden');
		const q = (url.searchParams.get('q') ?? '').normalize('NFC').trim().toLowerCase().slice(0, 100);
		const offset = Number(url.searchParams.get('offset') ?? 0);
		if (!Number.isInteger(offset) || offset < 0) throw new AppError('bad_request', 'offset must be a whole number');
		const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
		const [page, counts] = await Promise.all([
			env.APP.prepare(
				`SELECT c.id, c.lang, c.word, c.body, c.created_at, c.status, u.id AS user_id, u.name FROM comments c JOIN users u ON u.id = c.user_id
				 WHERE c.status = ?1 AND (?2 = '' OR lower(c.word) LIKE ?3 ESCAPE '\\' OR lower(c.body) LIKE ?3 ESCAPE '\\' OR lower(u.name) LIKE ?3 ESCAPE '\\')
				 ORDER BY c.created_at DESC, c.id DESC LIMIT ?4 OFFSET ?5`,
			)
				.bind(show, q, like, PAGE + 1, offset)
				.all(),
			env.APP.prepare("SELECT sum(status = 'visible') AS visible, sum(status = 'hidden') AS hidden, sum(created_at > unixepoch() - 7 * 86400) AS week FROM comments").first(),
		]);
		const c = /** @type {Record<string, number | null>} */ (counts);
		return json(
			{
				comments: page.results.slice(0, PAGE).map((r) => ({ id: Number(r.id), lang: r.lang, word: r.word, body: r.body, at: Number(r.created_at), status: r.status, author: r.name, author_id: Number(r.user_id) })),
				more: page.results.length > PAGE,
				counts: { visible: Number(c.visible ?? 0), hidden: Number(c.hidden ?? 0), week: Number(c.week ?? 0) },
			},
			NO_STORE,
		);
	}
	if (request.method === 'POST' && id && /^\d+$/.test(id)) {
		const data = /** @type {{ status?: unknown } | null} */ (await request.json().catch(() => null));
		if (data?.status !== 'visible' && data?.status !== 'hidden') throw new AppError('bad_request', 'status must be visible or hidden');
		const { meta } = await env.APP.prepare('UPDATE comments SET status = ?1 WHERE id = ?2').bind(data.status, Number(id)).run();
		if (!meta.changes) throw new AppError('not_found', `No comment ${id}`);
		return json({ ok: true, id: Number(id), status: data.status }, NO_STORE);
	}
	throw new AppError('not_found', `No API route for ${request.method} ${url.pathname}`);
}
