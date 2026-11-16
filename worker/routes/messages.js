// @ts-check
/**
 * The contact form, and the Inbox where admins read what it sends.
 *
 *   POST /api/messages                        { kind, body, reply_to?, page?, lang?, website? }
 *   GET  /api/messages                        a member's own messages, with the answers
 *   POST /api/messages/seen                   the member has seen the answers
 *   GET  /api/workspace/messages?status=new|read|replied|done|all&before=   admins
 *   POST /api/workspace/messages/{id}         { status?, note?, answer? }   admins
 *
 * States: new (unread) → read (opened) → replied → done; any can be set
 * again, "new" included. The note is the admins' own, never sent anywhere.
 *
 * An answer is a text the sender reads in their own Inbox (migration 0015):
 * only a message sent while signed in can have one, since a visitor has no
 * Inbox; theirs goes by mail to the address left. The sender sees the state
 * too, so "replied" or "done" alone is an answer of a kind.
 *
 * Spam: the form has a field people never see (website); a message that
 * fills it is answered as sent and not kept. Beyond that the same-origin
 * rule and the stricter rate limit apply (worker/lib/guard.js).
 */
import { AppError } from '../../shared/errors.js';
import { atLeast } from '../../shared/roles.js';
import { json } from '../lib/http.js';
import { requireOn } from '../lib/settings.js';
import { currentMember } from '../lib/session.js';
import { refuseZawgyi } from '../../shared/zawgyi/index.js';

/** @typedef {{ APP: D1Database }} Env */
/** @typedef {import('../lib/session.js').Member} Member */

export const KINDS = /** @type {const} */ (['feedback', 'question', 'problem', 'word']);
export const BODY_MAX = 4000;
const PAGE_SIZE = 30;
export const STATES = /** @type {const} */ (['new', 'read', 'replied', 'done']);
const NOTE_MAX = 2000;
export const ANSWER_MAX = 2000;
/** A member's own messages listed at once: the latest. */
const MINE_MAX = 100;
const NO_STORE = { headers: { 'cache-control': 'no-store' } };
/** An address with one @ and a dot after it; whether it is real is the reader's to find out. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param {Request} request
 * @param {Env} env
 */
export async function sendMessage(request, env) {
	await requireOn(env, 'contact.open', 'The contact form is closed for now.');
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
	refuseZawgyi(body, 'The message');
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
 * A member's own messages, newest first, each with its state and answer.
 * The admins' note and who handled it stay out.
 * @param {Request} request
 * @param {Env} env
 */
export async function myMessages(request, env) {
	const member = await currentMember(request, env);
	if (!member) throw new AppError('unauthorized', 'Sign in to see the messages you sent.');
	const { results } = await env.APP.prepare(
		`SELECT id, created_at, kind, body, page, lang, status, answer, answered_at,
		        (answered_at IS NOT NULL AND seen_at IS NULL) AS unseen
		 FROM messages WHERE user_id = ?1 ORDER BY id DESC LIMIT ?2`,
	)
		.bind(member.id, MINE_MAX)
		.all();
	return json({ messages: results.map((r) => ({ ...r, unseen: Boolean(r.unseen) })) }, NO_STORE);
}

/**
 * The member has opened the Inbox: every answer so far is seen.
 * @param {Request} request
 * @param {Env} env
 */
export async function seenMessages(request, env) {
	const member = await currentMember(request, env);
	if (!member) throw new AppError('unauthorized', 'Sign in first.');
	await env.APP.prepare('UPDATE messages SET seen_at = unixepoch() WHERE user_id = ?1 AND answered_at IS NOT NULL AND seen_at IS NULL').bind(member.id).run();
	return json({ ok: true }, NO_STORE);
}

/**
 * Answers a member has not seen yet (the workspace's badge).
 * @param {Env} env
 * @param {number} userId
 */
export async function unseenAnswers(env, userId) {
	const row = /** @type {{ n: number }} */ (await env.APP.prepare('SELECT count(*) AS n FROM messages WHERE user_id = ?1 AND answered_at IS NOT NULL AND seen_at IS NULL').bind(userId).first());
	return Number(row.n);
}

/**
 * The Inbox, for admins: GET lists, POST marks one new or done.
 * @param {Request} request
 * @param {Env} env
 * @param {Member} member
 * @param {string | undefined} id
 */
export async function inbox(request, env, member, id) {
	if (!atLeast(member.role, 'admin')) throw new AppError('forbidden', 'Only admins read the Inbox.');
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
		        m.answer, m.answered_at, (m.answered_at IS NOT NULL AND m.seen_at IS NOT NULL) AS answer_seen,
		        u.name AS member, a.name AS handled_by
		 FROM messages m LEFT JOIN users u ON u.id = m.user_id LEFT JOIN users a ON a.id = m.handled_by AND m.handled_by > 0
		 WHERE (?1 = 'all' OR m.status = ?1) AND m.id < ?2 ORDER BY m.id DESC LIMIT ?3`,
	)
		.bind(status, before, PAGE_SIZE + 1)
		.all();
	const { results: counted } = await env.APP.prepare('SELECT status, count(*) AS n FROM messages GROUP BY status').all();
	const counts = Object.fromEntries(STATES.map((s) => [s, 0]));
	for (const r of counted) counts[String(r.status)] = Number(r.n);
	return json({ messages: results.slice(0, PAGE_SIZE).map((r) => ({ ...r, answer_seen: Boolean(r.answer_seen) })), more: results.length > PAGE_SIZE, unread: counts.new, counts }, NO_STORE);
}

/**
 * A message's state, its note, its answer, or several of them.
 * @param {Request} request
 * @param {Env} env
 * @param {number} id
 * @param {Member} member
 */
async function mark(request, env, id, member) {
	const data = /** @type {{ status?: unknown, note?: unknown, answer?: unknown } | null} */ (await request.json().catch(() => null));
	if (!data || (data.status === undefined && data.note === undefined && data.answer === undefined)) throw new AppError('bad_request', 'Send { status }, { note }, { answer } or several');
	const status = data.status;
	if (status !== undefined && !STATES.includes(/** @type {any} */ (status))) throw new AppError('bad_request', `status must be one of ${STATES.join(', ')}`);
	const note = data.note;
	if (note !== undefined && note !== null && (typeof note !== 'string' || note.length > NOTE_MAX)) throw new AppError('bad_request', `note must be text of at most ${NOTE_MAX} characters, or null`);
	const cleanNote = typeof note === 'string' ? note.trim() || null : null;
	const answer = data.answer;
	if (answer !== undefined && answer !== null && typeof answer !== 'string') throw new AppError('bad_request', 'answer must be text, or null to take it back');
	const cleanAnswer = typeof answer === 'string' ? answer.normalize('NFC').trim() : null;
	if (typeof answer === 'string') {
		if (!cleanAnswer) throw new AppError('bad_request', 'Write the answer first.');
		if (cleanAnswer.length > ANSWER_MAX) throw new AppError('bad_request', `The answer is too long: at most ${ANSWER_MAX} characters.`);
		refuseZawgyi(cleanAnswer, 'The answer');
	}

	const before = /** @type {{ user_id: number | null, status: string } | null} */ (await env.APP.prepare('SELECT user_id, status FROM messages WHERE id = ?1').bind(id).first());
	if (!before) throw new AppError('not_found', `No message ${id}`);
	if (cleanAnswer && before.user_id === null) throw new AppError('bad_request', 'The sender was not signed in and has no Inbox to read an answer in. Reply by email to the address left, if there is one.');
	// An answer written without a state says "replied"; the sender sees the state either way.
	const next = /** @type {string} */ (status ?? (cleanAnswer ? 'replied' : before.status));
	// New to the sender: an answer written, or the state moved to replied or done.
	const answered = Boolean(cleanAnswer) || (next !== before.status && (next === 'replied' || next === 'done'));
	await env.APP.prepare(
		`UPDATE messages SET
		   status = ?1,
		   note = CASE WHEN ?2 THEN ?3 ELSE note END,
		   answer = CASE WHEN ?4 THEN ?5 ELSE answer END,
		   answered_at = CASE WHEN ?6 THEN unixepoch() ELSE answered_at END,
		   answered_by = CASE WHEN ?6 THEN ?7 ELSE answered_by END,
		   seen_at = CASE WHEN ?6 THEN NULL ELSE seen_at END,
		   handled_by = ?7, handled_at = unixepoch()
		 WHERE id = ?8`,
	)
		.bind(next, note !== undefined ? 1 : 0, cleanNote, answer !== undefined ? 1 : 0, cleanAnswer, answered ? 1 : 0, member.id, id)
		.run();
	const row = await env.APP.prepare('SELECT status, note, answer, answered_at FROM messages WHERE id = ?1').bind(id).first();
	return json({ ok: true, ...row }, NO_STORE);
}
