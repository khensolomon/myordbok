// @ts-check
/**
 * Members, for admins and owners (workspace section Members).
 *
 *   GET  /api/workspace/members?q=&role=&status=   the list, newest first; q matches name or email
 *   GET  /api/workspace/members/{id}               one member: sign-ins, contributions, role history
 *   POST /api/workspace/members/{id}               { role?, status?, insights? }; insights:
 *                                                  shown the site's statistics (shared/roles.js)
 *
 * Who may change what (shared/roles.js assignable): an owner gives and takes
 * every level and may suspend anyone but themselves; an admin moves members
 * and editors between those two levels and may suspend them, nobody above.
 * Nobody changes their own level or suspends themselves, and the site always
 * keeps one active owner. Each change of level is kept in role_grants with
 * who made it; suspending signs the member out everywhere.
 */
import { AppError } from '../../shared/errors.js';
import { assignable, atLeast, isRole } from '../../shared/roles.js';
import { json } from '../lib/http.js';

/** @typedef {{ APP: D1Database }} Env */
/** @typedef {import('../lib/session.js').Member} Member */

const NO_STORE = { headers: { 'cache-control': 'no-store' } };
const PAGE = 100;

/**
 * @param {Request} request
 * @param {Env} env
 * @param {Member} actor
 * @param {string | undefined} id
 */
export async function members(request, env, actor, id) {
	if (!atLeast(actor.role, 'admin')) throw new AppError('forbidden', 'Only admins and owners manage members.');
	if (id === undefined && request.method === 'GET') return list(request, env, actor);
	if (id && /^\d+$/.test(id) && Number(id) > 0) {
		if (request.method === 'GET') return one(env, actor, Number(id));
		if (request.method === 'POST') return change(request, env, actor, Number(id));
	}
	throw new AppError('not_found', `No API route for ${request.method} ${new URL(request.url).pathname}`);
}

/**
 * @param {Request} request
 * @param {Env} env
 * @param {Member} actor
 */
async function list(request, env, actor) {
	const url = new URL(request.url);
	const q = (url.searchParams.get('q') ?? '').trim().toLowerCase().slice(0, 100);
	const role = url.searchParams.get('role') ?? '';
	const status = url.searchParams.get('status') ?? '';
	if (role && !isRole(role)) throw new AppError('bad_request', 'role must be member, editor, admin or owner');
	if (status && status !== 'active' && status !== 'suspended') throw new AppError('bad_request', 'status must be active or suspended');
	const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
	const { results } = await env.APP.prepare(
		`SELECT u.id, u.name, u.email, u.avatar_url, u.role, u.status, u.insights, u.created_at, u.seen_at,
		        (SELECT group_concat(provider) FROM identities i WHERE i.user_id = u.id) AS providers,
		        (SELECT count(*) FROM dict_edits e WHERE e.user_id = u.id) AS suggestions
		 FROM users u
		 WHERE u.id > 0
		   AND (?1 = '' OR lower(u.name) LIKE ?2 ESCAPE '\\' OR u.email LIKE ?2 ESCAPE '\\')
		   AND (?3 = '' OR u.role = ?3) AND (?4 = '' OR u.status = ?4)
		 ORDER BY u.id DESC LIMIT ?5`,
	)
		.bind(q, like, role, status, PAGE + 1)
		.all();
	const { results: counted } = await env.APP.prepare("SELECT role, status, count(*) AS n FROM users WHERE id > 0 GROUP BY role, status").all();
	return json(
		{
			members: results.slice(0, PAGE).map((r) => shape(r, actor)),
			more: results.length > PAGE,
			counts: counted.map((r) => ({ role: r.role, status: r.status, n: Number(r.n) })),
		},
		NO_STORE,
	);
}

/**
 * One row as the workspace shows it, with what the actor may do to it.
 * @param {Record<string, unknown>} r
 * @param {Member} actor
 */
function shape(r, actor) {
	const self = Number(r.id) === actor.id;
	const role = /** @type {import('../../shared/roles.js').Role} */ (r.role);
	const levels = assignable(actor.role, role, self);
	return {
		id: Number(r.id),
		name: r.name,
		email: r.email,
		avatar_url: r.avatar_url,
		role,
		status: r.status,
		insights: Number(r.insights ?? 0) === 1,
		created_at: Number(r.created_at),
		seen_at: r.seen_at === null ? null : Number(r.seen_at),
		providers: r.providers ? String(r.providers).split(',') : [],
		suggestions: Number(r.suggestions ?? 0),
		self,
		may: { roles: levels, suspend: levels.length > 0 },
	};
}

/**
 * @param {Env} env
 * @param {Member} actor
 * @param {number} id
 */
async function one(env, actor, id) {
	const db = env.APP;
	const row = await db
		.prepare(
			`SELECT u.id, u.name, u.email, u.avatar_url, u.role, u.status, u.insights, u.created_at, u.seen_at,
			        (SELECT group_concat(provider) FROM identities i WHERE i.user_id = u.id) AS providers,
			        (SELECT count(*) FROM dict_edits e WHERE e.user_id = u.id) AS suggestions
			 FROM users u WHERE u.id = ?1 AND u.id > 0`,
		)
		.bind(id)
		.first();
	if (!row) throw new AppError('not_found', `No member ${id}`);
	const [edits, ratings, history, sessions] = await Promise.all([
		db.prepare('SELECT status, count(*) AS n FROM dict_edits WHERE user_id = ?1 GROUP BY status').bind(id).all(),
		db.prepare('SELECT (SELECT count(*) FROM reactions WHERE user_id = ?1) + (SELECT count(*) FROM sense_reactions WHERE user_id = ?1) AS n').bind(id).first(),
		db
			.prepare(
				`SELECT g.role, g.created_at, CASE WHEN g.granted_by IS NULL THEN NULL WHEN g.granted_by = 0 THEN 'Former member' ELSE b.name END AS by
				 FROM role_grants g LEFT JOIN users b ON b.id = g.granted_by WHERE g.user_id = ?1 ORDER BY g.created_at DESC, g.id DESC LIMIT 20`,
			)
			.bind(id)
			.all(),
		db.prepare('SELECT count(*) AS n FROM sessions WHERE user_id = ?1 AND expires_at > unixepoch()').bind(id).first(),
	]);
	return json(
		{
			member: {
				...shape(row, actor),
				edits: Object.fromEntries(edits.results.map((r) => [String(r.status), Number(r.n)])),
				ratings: Number(/** @type {{ n: number }} */ (ratings).n),
				sessions: Number(/** @type {{ n: number }} */ (sessions).n),
				history: history.results.map((r) => ({ role: r.role, at: Number(r.created_at), by: r.by })),
			},
		},
		NO_STORE,
	);
}

/**
 * @param {Request} request
 * @param {Env} env
 * @param {Member} actor
 * @param {number} id
 */
async function change(request, env, actor, id) {
	const data = /** @type {{ role?: unknown, status?: unknown, insights?: unknown } | null} */ (await request.json().catch(() => null));
	if (!data || (data.role === undefined && data.status === undefined && data.insights === undefined)) throw new AppError('bad_request', 'Send { role }, { status } or { insights }');
	const db = env.APP;
	const target = /** @type {{ id: number, role: import('../../shared/roles.js').Role, status: string } | null} */ (
		await db.prepare('SELECT id, role, status FROM users WHERE id = ?1 AND id > 0').bind(id).first()
	);
	if (!target) throw new AppError('not_found', `No member ${id}`);
	const levels = assignable(actor.role, target.role, target.id === actor.id);
	if (!levels.length) {
		throw new AppError('forbidden', target.id === actor.id ? 'Your own level and account are changed by an owner, not by yourself.' : `An ${actor.role} cannot change a member who is ${target.role}.`);
	}
	/** @type {D1PreparedStatement[]} */
	const steps = [];
	if (data.role !== undefined) {
		if (!isRole(data.role)) throw new AppError('bad_request', 'role must be member, editor, admin or owner');
		if (!levels.includes(data.role)) throw new AppError('forbidden', `An ${actor.role} cannot make a member ${data.role}.`);
		if (data.role !== target.role) {
			steps.push(db.prepare('UPDATE users SET role = ?1 WHERE id = ?2').bind(data.role, id));
			steps.push(db.prepare('INSERT INTO role_grants (user_id, role, granted_by) VALUES (?1, ?2, ?3)').bind(id, data.role, actor.id));
		}
	}
	if (data.status !== undefined) {
		if (data.status !== 'active' && data.status !== 'suspended') throw new AppError('bad_request', 'status must be active or suspended');
		if (data.status !== target.status) {
			steps.push(db.prepare('UPDATE users SET status = ?1 WHERE id = ?2').bind(data.status, id));
			if (data.status === 'suspended') steps.push(db.prepare('DELETE FROM sessions WHERE user_id = ?1').bind(id));
		}
	}
	if (data.insights !== undefined) {
		if (typeof data.insights !== 'boolean') throw new AppError('bad_request', 'insights must be true or false');
		steps.push(db.prepare('UPDATE users SET insights = ?1 WHERE id = ?2').bind(data.insights ? 1 : 0, id));
	}
	// The site keeps an active owner: one who stops being owner, or is suspended, must not be the last.
	const leavesOwner = target.role === 'owner' && ((data.role !== undefined && data.role !== 'owner') || data.status === 'suspended');
	if (leavesOwner) {
		const owners = /** @type {{ n: number }} */ (await db.prepare("SELECT count(*) AS n FROM users WHERE role = 'owner' AND status = 'active' AND id > 0").first());
		if (Number(owners.n) <= 1) throw new AppError('conflict', 'The site keeps at least one owner. Make another member owner first.');
	}
	if (steps.length) await db.batch(steps);
	return one(env, actor, id);
}
