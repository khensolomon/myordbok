// @ts-check
/**
 * The studio's API. Roles are read from the database on every request
 * (worker/lib/session.js); a member sees only their own suggestions.
 *
 *   GET  /api/studio/summary                  suggestion counts by status, and the role
 *   GET  /api/studio/edits?status=&mine=1&before=
 *                                             suggestions, newest first, 30 at a time;
 *                                             each with the sense as the dictionary has it now
 *   POST /api/studio/edits/{id}/review        { decision: 'approve' | 'reject', note? }  editors
 *   POST /api/studio/edits/{id}/withdraw      the author, while it waits for review
 *
 * Only a waiting suggestion can be reviewed or withdrawn; what happens after
 * approval (export, merge) is make edits-export and the next release.
 */
import { AppError } from '../../shared/errors.js';
import { dictionary, explainDictError } from '../lib/dict.js';
import { json } from '../lib/http.js';
import { currentMember } from '../lib/session.js';

/** @typedef {import('./auth.js').AuthEnv & import('../lib/dict.js').DictEnv} Env */
/** @typedef {import('../lib/session.js').Member} Member */

export const PAGE = 30;
const STATUSES = Object.freeze(['pending', 'approved', 'rejected', 'exported', 'merged', 'conflict']);
const NO_STORE = { headers: { 'cache-control': 'no-store' } };

/** Senses as the dictionary has them now, by id. */
const CURRENT = {
	emd: `SELECT s.id, w.word, t.name AS type, s.sense, s.exam FROM emd_sense s
		JOIN eng_word w ON w.id = s.wrid JOIN type_word t ON t.id = s.wrte
		WHERE s.id IN (SELECT value FROM json_each(?1))`,
	med: `SELECT s.id, w.word, t.name AS type, s.sense, s.exam FROM med_sense s
		JOIN mya_word w ON w.id = s.wrid JOIN type_word t ON t.id = s.wrte
		WHERE s.id IN (SELECT value FROM json_each(?1))`,
};

/** @param {Member} m */
const isEditor = (m) => m.role === 'editor' || m.role === 'admin';

/**
 * @param {Request} request
 * @param {Env} env
 * @param {string[]} parts  Path parts after /api/.
 */
export async function studio(request, env, parts) {
	const member = await currentMember(request, env);
	if (!member) throw new AppError('unauthorized', 'Sign in to open the studio.');
	const [, what, id, action] = parts;
	if (request.method === 'GET' && what === 'summary' && parts.length === 2) return summary(env, member);
	if (request.method === 'GET' && what === 'edits' && parts.length === 2) return list(request, env, member);
	if (request.method === 'POST' && what === 'edits' && parts.length === 4 && /^\d+$/.test(id)) {
		if (action === 'review') return review(request, env, member, Number(id));
		if (action === 'withdraw') return withdraw(env, member, Number(id));
	}
	throw new AppError('not_found', `No API route for ${request.method} ${new URL(request.url).pathname}`);
}

/**
 * @param {Env} env
 * @param {Member} member
 */
async function summary(env, member) {
	const own = await env.APP.prepare('SELECT status, count(*) AS n FROM dict_edits WHERE user_id = ?1 GROUP BY status').bind(member.id).all();
	const waiting = isEditor(member)
		? /** @type {{ n: number }} */ (await env.APP.prepare("SELECT count(*) AS n FROM dict_edits WHERE status = 'pending'").first()).n
		: null;
	return json(
		{ role: member.role, mine: Object.fromEntries(own.results.map((r) => [String(r.status), Number(r.n)])), waiting: waiting === null ? null : Number(waiting) },
		NO_STORE,
	);
}

/**
 * @param {Request} request
 * @param {Env} env
 * @param {Member} member
 */
async function list(request, env, member) {
	const url = new URL(request.url);
	const status = url.searchParams.get('status') ?? 'pending';
	if (status !== 'all' && !STATUSES.includes(status)) throw new AppError('bad_request', `status must be all or one of ${STATUSES.join(', ')}`);
	// A member's list is always their own.
	const mine = url.searchParams.get('mine') === '1' || !isEditor(member);
	const before = Number(url.searchParams.get('before') ?? 0);
	if (!Number.isInteger(before) || before < 0) throw new AppError('bad_request', 'before must be a suggestion id');

	const { results } = await env.APP.prepare(
		`SELECT e.id, e.dict, e.action, e.sense_id, e.field, e.old_value, e.new_value, e.word, e.data, e.source,
		        e.status, e.note, e.review_note, e.created_at, e.reviewed_at, e.user_id,
		        u.name AS author, r.name AS reviewer
		 FROM dict_edits e JOIN users u ON u.id = e.user_id LEFT JOIN users r ON r.id = e.reviewed_by
		 WHERE (?1 = 'all' OR e.status = ?1) AND (?2 = 0 OR e.user_id = ?3) AND (?4 = 0 OR e.id < ?4)
		 ORDER BY e.id DESC LIMIT ?5`,
	)
		.bind(status, mine ? 1 : 0, member.id, before, PAGE + 1)
		.all();
	const page = results.slice(0, PAGE);

	// Each sense as it is now, so a reviewer sees whether the dictionary moved on.
	/** @type {Record<string, Record<string, unknown>>} */
	const current = {};
	const ids = { emd: new Set(), med: new Set() };
	for (const e of page) if (e.sense_id !== null) ids[/** @type {'emd' | 'med'} */ (e.dict)].add(Number(e.sense_id));
	if (ids.emd.size || ids.med.size) {
		const { dict, db } = await dictionary(env);
		for (const name of /** @type {Array<'emd' | 'med'>} */ (['emd', 'med'])) {
			if (!ids[name].size) continue;
			const { results: rows } = await db
				.prepare(CURRENT[name])
				.bind(JSON.stringify([...ids[name]]))
				.all()
				.catch((err) => {
					throw explainDictError(err, dict, env);
				});
			for (const r of rows) current[`${name}:${r.id}`] = { word: r.word, type: r.type, sense: r.sense, exam: r.exam };
		}
	}

	const edits = page.map((e) => ({
		...e,
		data: e.data ? JSON.parse(String(e.data)) : null,
		own: e.user_id === member.id,
		current: e.sense_id === null ? null : (current[`${e.dict}:${e.sense_id}`] ?? null),
	}));
	return json({ edits, more: results.length > PAGE, role: member.role }, NO_STORE);
}

/**
 * @param {Request} request
 * @param {Env} env
 * @param {Member} member
 * @param {number} id
 */
async function review(request, env, member, id) {
	if (!isEditor(member)) throw new AppError('forbidden', 'Only editors review suggestions.');
	const data = /** @type {Record<string, unknown> | null} */ (await request.json().catch(() => null));
	const decision = data?.decision;
	if (decision !== 'approve' && decision !== 'reject') throw new AppError('bad_request', 'decision must be approve or reject');
	const note = typeof data?.note === 'string' ? data.note.replace(/[\t\r\n]+/g, ' ').trim().slice(0, 600) || null : null;
	const row = /** @type {{ id: number, status: string } | null} */ (
		await env.APP.prepare(
			`UPDATE dict_edits SET status = ?2, reviewed_by = ?3, reviewed_at = unixepoch(), review_note = ?4
			 WHERE id = ?1 AND status = 'pending' RETURNING id, status`,
		)
			.bind(id, decision === 'approve' ? 'approved' : 'rejected', member.id, note)
			.first()
	);
	if (!row) await notWaiting(env, id);
	return json({ edit: row }, NO_STORE);
}

/**
 * @param {Env} env
 * @param {Member} member
 * @param {number} id
 */
async function withdraw(env, member, id) {
	const row = await env.APP.prepare("DELETE FROM dict_edits WHERE id = ?1 AND user_id = ?2 AND status = 'pending' RETURNING id").bind(id, member.id).first();
	if (!row) {
		const own = await env.APP.prepare('SELECT user_id FROM dict_edits WHERE id = ?1').bind(id).first();
		if (own && own.user_id !== member.id) throw new AppError('forbidden', 'Only the author can withdraw a suggestion.');
		await notWaiting(env, id);
	}
	return json({ ok: true }, NO_STORE);
}

/**
 * Explains why a suggestion could not be acted on.
 * @param {Env} env
 * @param {number} id
 * @returns {Promise<never>}
 */
async function notWaiting(env, id) {
	const row = /** @type {{ status: string } | null} */ (await env.APP.prepare('SELECT status FROM dict_edits WHERE id = ?1').bind(id).first());
	if (!row) throw new AppError('not_found', `There is no suggestion ${id}.`);
	throw new AppError('conflict', `Suggestion ${id} is already ${row.status}.`);
}
