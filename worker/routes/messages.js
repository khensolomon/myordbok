// @ts-check
/**
 * The contact form, and the Inbox where admins read what it sends.
 *
 *   POST /api/messages                        { kind, body, reply_to?, page?, lang?, website? }
 *   GET  /api/workspace/messages?status=new|read|replied|done|all&before=   admins
 *   POST /api/workspace/messages/{id}         { status?, note? }            admins
 *
 * States: new (unread) → read (opened) → replied → done; any can be set
 * again, "new" included. The note is the admins' own, never sent anywhere.
 *
 * Spam: the form has a field people never see (website); a message that
 * fills it is answered as sent and not kept. Beyond that the same-origin
 * rule and the stricter rate limit apply (worker/lib/guard.js).
 */
import { AppError } from '../../shared/errors.js';
import { json } from '../lib/http.js';
import { currentMember } from '../lib/session.js';

/** @typedef {{ APP: D1Database }} Env */
/** @typedef {import('../lib/session.js').Member} Member */

export const KINDS = /** @type {const} */ (['feedback', 'question', 'problem', 'word']);
export const BODY_MAX = 4000;
const PAGE_SIZE = 30;
export const STATES = /** @type {const} */ (['new', 'read', 'replied', 'done']);
const NOTE_MAX = 2000;
const NO_STORE = { headers: { 'cache-control': 'no-store' } };
/** An address with one @ and a dot after it; whether it is real is the reader's to find out. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param {Request} request
 * @param {Env} env
 */
export async function sendMessage(request, env) {
	const data = /** @type {Record<string, unknown> | null} */ (await request.json().catch(() => null));
	if (!data || typeof data !== 'object') throw new AppError('bad_request', 'The request body must be a JSON object');
	if (typeof data.website === 'string' && data.website.trim()) {
		console.warn(JSON.stringify({ event: 'message_trap' }));
		return json({ ok: true }, NO_STORE);
	}
	const kind = /** @type {typeof KINDS[number]} */ (data.kind);
	if (!KINDS.includes(kind)) throw new AppError('bad_request', `kind must be one of ${KINDS.join(', ')}`);
	const body = typeof data.body === 'string' ? data.body.normalize('NFC').trim() : '';
	if (!body) throw new AppError('bad_request', 'Write a message first.');
	if (body.length > BODY_MAX) throw new AppError('bad_request', `The message is too long: at most ${BODY_MAX} characters.`);
	const replyTo = typeof data.reply_to === 'string' ? data.reply_to.trim() : '';
	if (replyTo && (replyTo.length > 254 || !EMAIL.test(replyTo))) throw new AppError('bad_request', 'The email address does not look right.');
	const page = typeof data.page === 'string' && data.page.startsWith('/') ? data.page.slice(0, 300) : null;
	const lang = data.lang === 'my' ? 'my' : 'en';
	const member = await currentMember(request, env);
	await env.APP.prepare('INSERT INTO messages (kind, body, reply_to, page, lang, user_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
		.bind(kind, body, replyTo || null, page, lang, member?.id ?? null)
		.run();
	return json({ ok: true }, NO_STORE);
}

/**
 * The Inbox, for admins: GET lists, POST marks one new or done.
 * @param {Request} request
 * @param {Env} env
 * @param {Member} member
 * @param {string | undefined} id
 */
export async function inbox(request, env, member, id) {
	if (member.role !== 'admin') throw new AppError('forbidden', 'Only admins read the Inbox.');
	if (request.method === 'GET' && id === undefined) return list(request, env);
	if (request.method === 'POST' && id && /^\d+$/.test(id)) return mark(request, env, Number(id), member);
	throw new AppError('not_found', `No API route for ${request.method} ${new URL(request.url).pathname}`);
}

/**
 * @param {Request} request
 * @param {Env} env
 */
async function list(request, env) {
	const url = new URL(request.url);
	const status = url.searchParams.get('status') ?? 'new';
	if (status !== 'all' && !STATES.includes(/** @type {any} */ (status))) throw new AppError('bad_request', `status must be one of ${STATES.join(', ')} or all`);
	const before = Number(url.searchParams.get('before')) || Number.MAX_SAFE_INTEGER;
	const { results } = await env.APP.prepare(
		`SELECT m.id, m.created_at, m.kind, m.body, m.reply_to, m.page, m.lang, m.status, m.note, m.handled_at,
		        u.name AS member, a.name AS handled_by
		 FROM messages m LEFT JOIN users u ON u.id = m.user_id LEFT JOIN users a ON a.id = m.handled_by AND m.handled_by > 0
		 WHERE (?1 = 'all' OR m.status = ?1) AND m.id < ?2 ORDER BY m.id DESC LIMIT ?3`,
	)
		.bind(status, before, PAGE_SIZE + 1)
		.all();
	const { results: counted } = await env.APP.prepare('SELECT status, count(*) AS n FROM messages GROUP BY status').all();
	const counts = Object.fromEntries(STATES.map((s) => [s, 0]));
	for (const r of counted) counts[String(r.status)] = Number(r.n);
	return json({ messages: results.slice(0, PAGE_SIZE), more: results.length > PAGE_SIZE, unread: counts.new, counts }, NO_STORE);
}

/**
 * A message's state, its note, or both.
 * @param {Request} request
 * @param {Env} env
 * @param {number} id
 * @param {Member} member
 */
async function mark(request, env, id, member) {
	const data = /** @type {{ status?: unknown, note?: unknown } | null} */ (await request.json().catch(() => null));
	if (!data || (data.status === undefined && data.note === undefined)) throw new AppError('bad_request', 'Send { status } or { note } or both');
	const status = data.status;
	if (status !== undefined && !STATES.includes(/** @type {any} */ (status))) throw new AppError('bad_request', `status must be one of ${STATES.join(', ')}`);
	const note = data.note;
	if (note !== undefined && note !== null && (typeof note !== 'string' || note.length > NOTE_MAX)) throw new AppError('bad_request', `note must be text of at most ${NOTE_MAX} characters, or null`);
	const cleanNote = typeof note === 'string' ? note.trim() || null : null;
	const { meta } = await env.APP.prepare(
		`UPDATE messages SET
		   status = coalesce(?1, status),
		   note = CASE WHEN ?2 THEN ?3 ELSE note END,
		   handled_by = ?4, handled_at = unixepoch()
		 WHERE id = ?5`,
	)
		.bind(status ?? null, note !== undefined ? 1 : 0, cleanNote, member.id, id)
		.run();
	if (!meta.changes) throw new AppError('not_found', `No message ${id}`);
	const row = await env.APP.prepare('SELECT status, note FROM messages WHERE id = ?1').bind(id).first();
	return json({ ok: true, ...row }, NO_STORE);
}
