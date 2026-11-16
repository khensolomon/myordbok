// @ts-check
/**
 * The contact form, and the Inbox where admins read what it sends.
 *
 *   POST /api/messages                        { kind, body, reply_to?, page?, lang?, website? }
 *   GET  /api/messages                        a member's own messages, with the answers
 *   POST /api/messages/seen                   the member has seen the answers
 *   GET  /api/workspace/messages?status=new|read|replied|done|all&before=   admins;
 *        also &kind= &from=member|visitor &lang=en|my &answer=yes|no &q= (contains)
 *   POST /api/workspace/messages/{id}         { status?, note?, answer? }   admins
 *   POST /api/workspace/messages/bulk         { ids, action, answer? }      admins: up to 200
 *        at once; action new|read|done sets the state, thank answers each member in their
 *        language ({ answer: { en, my } }) and closes it, delete removes them for good
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
/** Most messages one bulk action takes. */
export const BULK_MAX = 200;
const BULK_ACTIONS = /** @type {const} */ (['new', 'read', 'done', 'thank', 'delete']);
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
	if (request.method === 'POST' && id === 'bulk') return bulk(request, env, member);
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
	// The other filters narrow the list and the counts of each state alike.
	/** @type {string[]} */
	const where = [];
	/** @type {unknown[]} */
	const args = [];
	const pick = (/** @type {string} */ name, /** @type {readonly string[]} */ allowed) => {
		const v = url.searchParams.get(name) ?? '';
		if (v && !allowed.includes(v)) throw new AppError('bad_request', `${name} must be one of ${allowed.join(', ')}`);
		return v;
	};
	const kind = pick('kind', KINDS);
	if (kind) where.push(`m.kind = ?${args.push(kind)}`);
	const from = pick('from', ['member', 'visitor']);
	if (from) where.push(from === 'member' ? 'm.user_id IS NOT NULL' : 'm.user_id IS NULL');
	const lang = pick('lang', ['en', 'my']);
	if (lang) where.push(`m.lang = ?${args.push(lang)}`);
	const answer = pick('answer', ['yes', 'no']);
	if (answer) where.push(answer === 'yes' ? 'm.answer IS NOT NULL' : 'm.answer IS NULL');
	const q = (url.searchParams.get('q') ?? '').normalize('NFC').trim();
	if (q.length > 100) throw new AppError('bad_request', 'q is longer than 100 characters');
	if (q) {
		const like = `?${args.push(`%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`)}`;
		where.push(`(m.body LIKE ${like} ESCAPE '\\' OR m.reply_to LIKE ${like} ESCAPE '\\' OR m.note LIKE ${like} ESCAPE '\\' OR m.answer LIKE ${like} ESCAPE '\\' OR m.user_id IN (SELECT id FROM users WHERE name LIKE ${like} ESCAPE '\\'))`);
	}
	const narrowed = where.length ? ` AND ${where.join(' AND ')}` : '';
	const n = args.length;
	const { results } = await env.APP.prepare(
		`SELECT m.id, m.created_at, m.kind, m.body, m.reply_to, m.page, m.lang, m.status, m.note, m.handled_at,
		        m.answer, m.answered_at, (m.answered_at IS NOT NULL AND m.seen_at IS NOT NULL) AS answer_seen,
		        u.name AS member, a.name AS handled_by
		 FROM messages m LEFT JOIN users u ON u.id = m.user_id LEFT JOIN users a ON a.id = m.handled_by AND m.handled_by > 0
		 WHERE (?${n + 1} = 'all' OR m.status = ?${n + 1}) AND m.id < ?${n + 2}${narrowed} ORDER BY m.id DESC LIMIT ?${n + 3}`,
	)
		.bind(...args, status, before, PAGE_SIZE + 1)
		.all();
	const { results: counted } = await env.APP.prepare(`SELECT m.status, count(*) AS n FROM messages m WHERE 1 = 1${narrowed} GROUP BY m.status`).bind(...args).all();
	const counts = Object.fromEntries(STATES.map((s) => [s, 0]));
	for (const r of counted) counts[String(r.status)] = Number(r.n);
	// The rail's badge counts every unread message, whatever the list is narrowed to.
	const unread = where.length ? Number(/** @type {{ n: number }} */ (await env.APP.prepare("SELECT count(*) AS n FROM messages WHERE status = 'new'").first()).n) : counts.new;
	return json({ messages: results.slice(0, PAGE_SIZE).map((r) => ({ ...r, answer_seen: Boolean(r.answer_seen) })), more: results.length > PAGE_SIZE, unread, counts }, NO_STORE);
}

/**
 * One action on several messages, all or none.
 * @param {Request} request
 * @param {Env} env
 * @param {Member} member
 */
async function bulk(request, env, member) {
	const data = /** @type {{ ids?: unknown, action?: unknown, answer?: unknown } | null} */ (await request.json().catch(() => null));
	const ids = data?.ids;
	if (!Array.isArray(ids) || !ids.length || !ids.every((id) => Number.isInteger(id) && id > 0)) throw new AppError('bad_request', 'Send { ids: [message ids], action }');
	if (ids.length > BULK_MAX) throw new AppError('bad_request', `At most ${BULK_MAX} messages at once.`);
	const action = /** @type {typeof BULK_ACTIONS[number]} */ (data?.action);
	if (!BULK_ACTIONS.includes(action)) throw new AppError('bad_request', `action must be one of ${BULK_ACTIONS.join(', ')}`);
	const list = JSON.stringify([...new Set(ids)]);
	const these = 'id IN (SELECT value FROM json_each(?1))';

	if (action === 'delete') {
		const { meta } = await env.APP.prepare(`DELETE FROM messages WHERE ${these}`).bind(list).run();
		console.log(JSON.stringify({ event: 'messages_deleted', by: member.id, n: Number(meta.changes ?? 0) }));
		return json({ ok: true, action, changed: Number(meta.changes ?? 0), skipped: 0 }, NO_STORE);
	}
	if (action === 'thank') {
		// The thanks is written in the language each message came in; a visitor has no Inbox to read it in and is left as is.
		const answer = /** @type {{ en?: unknown, my?: unknown } | null} */ (data?.answer);
		const texts = ['en', 'my'].map((l) => (typeof answer?.[/** @type {'en' | 'my'} */ (l)] === 'string' ? /** @type {string} */ (answer[/** @type {'en' | 'my'} */ (l)]).normalize('NFC').trim() : ''));
		if (texts.some((x) => !x || x.length > ANSWER_MAX)) throw new AppError('bad_request', `Send { answer: { en, my } }, each a text of at most ${ANSWER_MAX} characters`);
		refuseZawgyi(texts[1], 'The answer');
		const { meta } = await env.APP.prepare(
			`UPDATE messages SET answer = CASE lang WHEN 'my' THEN ?3 ELSE ?2 END, status = 'done',
			   answered_at = unixepoch(), answered_by = ?4, seen_at = NULL, handled_by = ?4, handled_at = unixepoch()
			 WHERE ${these} AND user_id IS NOT NULL`,
		)
			.bind(list, texts[0], texts[1], member.id)
			.run();
		const changed = Number(meta.changes ?? 0);
		return json({ ok: true, action, changed, skipped: new Set(ids).size - changed }, NO_STORE);
	}
	// A state: "done" is new to the sender, as it is when set on one message.
	const { meta } = await env.APP.prepare(
		`UPDATE messages SET
		   answered_at = CASE WHEN ?2 = 'done' THEN unixepoch() ELSE answered_at END,
		   answered_by = CASE WHEN ?2 = 'done' THEN ?3 ELSE answered_by END,
		   seen_at = CASE WHEN ?2 = 'done' THEN NULL ELSE seen_at END,
		   status = ?2, handled_by = ?3, handled_at = unixepoch()
		 WHERE ${these} AND status <> ?2`,
	)
		.bind(list, action, member.id)
		.run();
	const changed = Number(meta.changes ?? 0);
	return json({ ok: true, action, changed, skipped: new Set(ids).size - changed }, NO_STORE);
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
