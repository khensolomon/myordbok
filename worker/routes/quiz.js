// @ts-check
/**
 * What readers answered in Test yourself, and what they reported as wrong
 * with a question (migration 0017). Questions are made on the reader's
 * device (shared/quiz.js); the server only counts and keeps reports.
 *
 *   POST /api/quiz/answers   { answers: [{ kind, word, answer, chosen }] }   a round's answers, up to 20;
 *        sent by the app only when the reader allowed usage statistics
 *   POST /api/quiz/reports   { kind, word, prompt, answer, choices, chosen?, reason, note?, lang? }
 *   POST /api/quiz/progress  { progress }  signed in: merged with the progress kept for the member,
 *        which is stored and returned with how many answers of theirs help the dictionary;
 *        { progress: null } forgets it
 *   GET  /api/workspace/questions?view=reports&status=new|done|all&q=&offset=   editors
 *   GET  /api/workspace/questions?view=missed&order=wrong|answers&q=&offset=    editors
 *   POST /api/workspace/questions/{id}  { status: new|done }                     editors
 *
 * Both writes need the quiz switched on (setting quiz.open), and fall under
 * the stricter rate limit (worker/lib/guard.js). An answer count keeps no
 * reader; a report keeps the member who sent it, if signed in.
 */
import { AppError } from '../../shared/errors.js';
import { atLeast } from '../../shared/roles.js';
import { refuseZawgyi } from '../../shared/zawgyi/index.js';
import { json } from '../lib/http.js';
import { currentMember } from '../lib/session.js';
import { requireOn } from '../lib/settings.js';
import { mergeProgress, readProgress } from '../../shared/quiz.js';

/** @typedef {{ APP: D1Database }} Env */
/** @typedef {import('../lib/session.js').Member} Member */

export const QUESTION_KINDS = /** @type {const} */ (['en-my', 'my-en', 'gap', 'listen', 'type', 'sense']);
export const REASONS = /** @type {const} */ (['answer', 'choices', 'spelling', 'other']);
/** Answers one round sends at most. */
export const ROUND_MAX = 20;
/** Answers a question needs before it is listed as often missed. */
export const MISSED_FROM = 3;
const PAGE = 50;
const NO_STORE = { headers: { 'cache-control': 'no-store' } };
const OFF = 'Test yourself is switched off for now.';

/**
 * A text field, trimmed and in NFC, or an error naming it.
 * @param {unknown} value
 * @param {string} name
 * @param {number} max
 */
function text(value, name, max) {
	const s = typeof value === 'string' ? value.normalize('NFC').trim() : '';
	if (!s) throw new AppError('bad_request', `${name} is missing`);
	if (s.length > max) throw new AppError('bad_request', `${name} is longer than ${max} characters`);
	return s;
}

/** @param {unknown} value */
function kindOf(value) {
	const kind = /** @type {typeof QUESTION_KINDS[number]} */ (value);
	if (!QUESTION_KINDS.includes(kind)) throw new AppError('bad_request', `kind must be one of ${QUESTION_KINDS.join(', ')}`);
	return kind;
}

/** @param {Request} request */
async function body(request) {
	const data = /** @type {Record<string, unknown> | null} */ (await request.json().catch(() => null));
	if (!data || typeof data !== 'object' || Array.isArray(data)) throw new AppError('bad_request', 'The request body must be a JSON object');
	return data;
}

/**
 * @param {Request} request
 * @param {Env} env
 * @param {string[]} parts
 */
export async function quiz(request, env, parts) {
	if (request.method !== 'POST' || parts.length !== 2) throw new AppError('not_found', `No API route for ${request.method} ${new URL(request.url).pathname}`);
	if (parts[1] === 'answers') return answers(request, env);
	if (parts[1] === 'reports') return report(request, env);
	if (parts[1] === 'progress') return syncProgress(request, env);
	throw new AppError('not_found', `No API route for ${new URL(request.url).pathname}`);
}

/**
 * @param {Request} request
 * @param {Env} env
 */
async function answers(request, env) {
	await requireOn(env, 'quiz.open', OFF);
	const data = await body(request);
	if (!Array.isArray(data.answers) || !data.answers.length) throw new AppError('bad_request', 'answers must be a list with at least one answer');
	if (data.answers.length > ROUND_MAX) throw new AppError('bad_request', `A round sends at most ${ROUND_MAX} answers`);
	const rows = data.answers.map((/** @type {Record<string, unknown>} */ a, /** @type {number} */ i) => {
		if (!a || typeof a !== 'object') throw new AppError('bad_request', `answers[${i}] must be an object`);
		return [kindOf(a.kind), text(a.word, `answers[${i}].word`, 100), text(a.answer, `answers[${i}].answer`, 300), text(a.chosen, `answers[${i}].chosen`, 300)];
	});
	const db = env.APP;
	await db.batch(
		rows.map((r) =>
			db
				.prepare('INSERT INTO quiz_answers (kind, word, answer, chosen, n) VALUES (?1, ?2, ?3, ?4, 1) ON CONFLICT (kind, word, answer, chosen) DO UPDATE SET n = n + 1, last_at = unixepoch()')
				.bind(...r),
		),
	);
	return json({ ok: true, counted: rows.length }, NO_STORE);
}

/**
 * @param {Request} request
 * @param {Env} env
 */
async function report(request, env) {
	await requireOn(env, 'quiz.open', OFF);
	const data = await body(request);
	const kind = kindOf(data.kind);
	const word = text(data.word, 'word', 100);
	const prompt = text(data.prompt, 'prompt', 600);
	const answer = text(data.answer, 'answer', 300);
	// A typed question has one choice, the word; the others 2 to 6.
	const fewest = kind === 'type' ? 1 : 2;
	if (!Array.isArray(data.choices) || data.choices.length < fewest || data.choices.length > 6) throw new AppError('bad_request', `choices must be a list of ${fewest} to 6 texts`);
	const choices = data.choices.map((c, i) => text(c, `choices[${i}]`, 300));
	if (!choices.includes(answer)) throw new AppError('bad_request', 'The answer must be one of the choices');
	const chosen = data.chosen === undefined || data.chosen === null ? null : text(data.chosen, 'chosen', 300);
	if (chosen !== null && kind !== 'type' && !choices.includes(chosen)) throw new AppError('bad_request', 'chosen must be one of the choices');
	const reason = /** @type {typeof REASONS[number]} */ (data.reason);
	if (!REASONS.includes(reason)) throw new AppError('bad_request', `reason must be one of ${REASONS.join(', ')}`);
	const note = data.note === undefined || data.note === null || (typeof data.note === 'string' && !data.note.trim()) ? null : text(data.note, 'The note', 500);
	if (note) refuseZawgyi(note, 'The note');
	if (reason === 'other' && !note) throw new AppError('bad_request', 'Say what is wrong in the note.');
	const lang = data.lang === 'my' ? 'my' : 'en';
	const member = await currentMember(request, env);
	const row = /** @type {{ id: number }} */ (
		await env.APP.prepare('INSERT INTO quiz_reports (kind, word, prompt, answer, choices, chosen, reason, note, lang, user_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10) RETURNING id')
			.bind(kind, word, prompt, answer, JSON.stringify(choices), chosen, reason, note, lang, member?.id ?? null)
			.first()
	);
	return json({ ok: true, id: row.id }, NO_STORE);
}

/** @param {string} s */
const likeEscape = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * The workspace's Questions: reports to look at, and questions often missed.
 * @param {Request} request
 * @param {Env} env
 * @param {Member} member
 * @param {string | undefined} id
 */
export async function questions(request, env, member, id) {
	if (!atLeast(member.role, 'editor')) throw new AppError('forbidden', 'Questions are for editors.');
	if (request.method === 'POST' && id !== undefined) return setReport(request, env, id);
	if (request.method !== 'GET' || id !== undefined) throw new AppError('not_found', `No API route for ${request.method} ${new URL(request.url).pathname}`);
	const p = new URL(request.url).searchParams;
	const view = p.get('view') ?? 'reports';
	if (view !== 'reports' && view !== 'missed') throw new AppError('bad_request', 'view must be reports or missed');
	const offset = Number(p.get('offset') ?? 0);
	if (!Number.isInteger(offset) || offset < 0) throw new AppError('bad_request', 'offset must be a whole number, 0 or more');
	const q = (p.get('q') ?? '').normalize('NFC').trim();
	if (q.length > 60) throw new AppError('bad_request', 'q is longer than 60 characters');
	const like = `${likeEscape(q)}%`;
	const db = env.APP;
	const counts = /** @type {{ new: number, done: number, missed: number }} */ (
		await db
			.prepare(
				`SELECT (SELECT count(*) FROM quiz_reports WHERE status = 'new') AS new, (SELECT count(*) FROM quiz_reports WHERE status = 'done') AS done,
				        (SELECT count(*) FROM (SELECT 1 FROM quiz_answers GROUP BY kind, word, answer HAVING sum(n) >= ?1 AND sum(CASE WHEN chosen = answer THEN 0 ELSE n END) > 0)) AS missed`,
			)
			.bind(MISSED_FROM)
			.first()
	);
	const base = { counts: { new: Number(counts.new), done: Number(counts.done), missed: Number(counts.missed) } };

	if (view === 'reports') {
		const status = p.get('status') ?? 'new';
		if (!['new', 'done', 'all'].includes(status)) throw new AppError('bad_request', 'status must be new, done or all');
		const { results } = await db
			.prepare(
				`SELECT r.id, r.kind, r.word, r.prompt, r.answer, r.choices, r.chosen, r.reason, r.note, r.lang, r.status, r.created_at AS at, u.name AS member
				 FROM quiz_reports r LEFT JOIN users u ON u.id = r.user_id
				 WHERE (?1 = 'all' OR r.status = ?1) AND (?2 = '' OR r.word LIKE ?3 ESCAPE '\\')
				 ORDER BY r.created_at DESC, r.id DESC LIMIT ?4 OFFSET ?5`,
			)
			.bind(status, q, like, PAGE + 1, offset)
			.all();
		const items = results.slice(0, PAGE).map((r) => ({ ...r, choices: JSON.parse(String(r.choices)), at: Number(r.at), member: r.member ?? null }));
		return json({ ...base, view, items, more: results.length > PAGE }, NO_STORE);
	}

	const order = p.get('order') ?? 'wrong';
	if (order !== 'wrong' && order !== 'answers') throw new AppError('bad_request', 'order must be wrong or answers');
	const { results } = await db
		.prepare(
			`SELECT kind, word, answer, sum(n) AS answers, sum(CASE WHEN chosen = answer THEN 0 ELSE n END) AS wrong, max(last_at) AS at,
			        json_group_array(json_array(chosen, n)) FILTER (WHERE chosen <> answer) AS picks
			 FROM quiz_answers WHERE (?1 = '' OR word LIKE ?2 ESCAPE '\\')
			 GROUP BY kind, word, answer HAVING answers >= ?3 AND wrong > 0
			 ORDER BY ${order === 'wrong' ? 'wrong * 1.0 / answers DESC, answers DESC' : 'answers DESC, wrong DESC'}, word LIMIT ?4 OFFSET ?5`,
		)
		.bind(q, like, MISSED_FROM, PAGE + 1, offset)
		.all();
	const items = results.slice(0, PAGE).map((r) => ({
		kind: r.kind,
		word: r.word,
		answer: r.answer,
		answers: Number(r.answers),
		wrong: Number(r.wrong),
		at: Number(r.at),
		// The wrong choices picked, most picked first.
		picks: /** @type {Array<[string, number]>} */ (JSON.parse(String(r.picks ?? '[]'))).sort((a, b) => b[1] - a[1]).map(([text, n]) => ({ text, n })),
	}));
	return json({ ...base, view, items, more: results.length > PAGE }, NO_STORE);
}

/**
 * @param {Request} request
 * @param {Env} env
 * @param {string} id
 */
async function setReport(request, env, id) {
	if (!/^\d+$/.test(id)) throw new AppError('bad_request', 'The report id must be a number');
	const data = await body(request);
	if (data.status !== 'new' && data.status !== 'done') throw new AppError('bad_request', 'status must be new or done');
	const row = await env.APP.prepare('UPDATE quiz_reports SET status = ?1 WHERE id = ?2 RETURNING id, status').bind(data.status, Number(id)).first();
	if (!row) throw new AppError('not_found', `No report ${id}`);
	return json({ id: Number(row.id), status: row.status }, NO_STORE);
}

/**
 * The device's progress merged with the one kept for the member.
 * @param {Request} request
 * @param {Env} env
 */
async function syncProgress(request, env) {
	const member = await currentMember(request, env);
	if (!member) throw new AppError('unauthorized', 'Sign in to keep your progress on every device.');
	const data = await body(request);
	const db = env.APP;
	if (data.progress === null) {
		await db.prepare('DELETE FROM quiz_progress WHERE user_id = ?1').bind(member.id).run();
		return json({ progress: null }, NO_STORE);
	}
	if (!data.progress || typeof data.progress !== 'object') throw new AppError('bad_request', 'progress must be an object, or null to forget it');
	const sent = readProgress(data.progress);
	const row = /** @type {{ data: string } | null} */ (await db.prepare('SELECT data FROM quiz_progress WHERE user_id = ?1').bind(member.id).first());
	const merged = row ? mergeProgress(readProgress(JSON.parse(row.data)), sent) : sent;
	await db
		.prepare('INSERT INTO quiz_progress (user_id, data) VALUES (?1, ?2) ON CONFLICT (user_id) DO UPDATE SET data = excluded.data, updated_at = unixepoch()')
		.bind(member.id, JSON.stringify(merged))
		.run();
	const helped = /** @type {{ n: number }} */ (await db.prepare('SELECT (SELECT count(*) FROM help_votes WHERE user_id = ?1) + (SELECT count(*) FROM quiz_reports WHERE user_id = ?1) AS n').bind(member.id).first());
	return json({ progress: merged, helped: Number(helped.n) }, NO_STORE);
}
