// @ts-check
/**
 * Site notices (assets/db/migrations/0008_notices.sql, shared/notices.js).
 *
 *   GET  /api/notices                    the notices in effect for everyone; kept
 *                                        at the edge for five minutes
 *   GET  /api/notices?for=me             the same plus those for members or editors,
 *                                        by the session's role; never cached
 *   GET  /api/workspace/notices          every notice, for admins
 *   POST /api/workspace/notices          a new notice, for admins
 *   POST /api/workspace/notices/{id}     a notice changed, for admins
 *   POST /api/workspace/notices/{id}/delete
 */
import { AppError } from '../../shared/errors.js';
import { checkNotice, nextShowing, seenBy, showingNow } from '../../shared/notices.js';
import { atLeast } from '../../shared/roles.js';
import { json } from '../lib/http.js';
import { currentMember } from '../lib/session.js';

/** @typedef {import('./auth.js').AuthEnv} Env */
/** @typedef {import('../lib/session.js').Member} Member */

const NO_STORE = { headers: { 'cache-control': 'no-store' } };
const COLUMNS = 'id, kind, text_en, text_my, link, audience, announce_at, starts_at, ends_at, yearly, updated_at';

/**
 * The notices in effect now.
 * @param {Request} request
 * @param {Env} env
 * @param {URL} url
 */
export async function activeNotices(request, env, url) {
	const forMe = url.searchParams.get('for') === 'me';
	const role = forMe ? ((await currentMember(request, env))?.role ?? null) : null;
	const now = Math.floor(Date.now() / 1000);
	const { results } = await env.APP.prepare(`SELECT ${COLUMNS} FROM notices WHERE yearly = 1 OR (coalesce(announce_at, starts_at) <= ?1 AND ends_at > ?1) ORDER BY starts_at`).bind(now).all();
	const notices = [];
	for (const n of /** @type {any[]} */ (results)) {
		const o = seenBy(n.audience, role) ? showingNow(n, now) : null;
		if (o) notices.push({ id: n.id, kind: n.kind, text_en: n.text_en, text_my: n.text_my, link: n.link, starts: o.starts, ends: o.ends, version: n.updated_at });
	}
	return json({ notices }, forMe ? NO_STORE : { headers: { 'cache-control': 'public, max-age=300' } });
}

/**
 * The workspace's notices manager, for admins.
 * @param {Request} request
 * @param {Env} env
 * @param {Member} member
 * @param {string | undefined} id
 * @param {string | undefined} action
 */
export async function manageNotices(request, env, member, id, action) {
	if (!atLeast(member.role, 'admin')) throw new AppError('forbidden', 'Only admins manage notices.');
	if (request.method === 'GET' && id === undefined) return list(env);
	if (request.method === 'POST' && id === undefined) return save(request, env, member, null);
	if (request.method === 'POST' && id && /^\d+$/.test(id) && action === undefined) return save(request, env, member, Number(id));
	if (request.method === 'POST' && id && /^\d+$/.test(id) && action === 'delete') {
		const { meta } = await env.APP.prepare('DELETE FROM notices WHERE id = ?1').bind(Number(id)).run();
		if (!meta.changes) throw new AppError('not_found', `No notice ${id}`);
		return json({ ok: true }, NO_STORE);
	}
	throw new AppError('not_found', `No API route for ${request.method} ${new URL(request.url).pathname}`);
}

/** @param {Env} env */
async function list(env) {
	const now = Math.floor(Date.now() / 1000);
	const { results } = await env.APP.prepare(
		`SELECT n.id, n.kind, n.text_en, n.text_my, n.link, n.audience, n.announce_at, n.starts_at, n.ends_at, n.yearly, n.updated_at,
		        CASE WHEN n.updated_by > 0 THEN u.name END AS updated_by
		 FROM notices n LEFT JOIN users u ON u.id = n.updated_by ORDER BY n.starts_at DESC LIMIT 200`,
	).all();
	return json({ notices: results.map((/** @type {any} */ n) => ({ ...n, next: nextShowing(/** @type {any} */ (n), now) })), now }, NO_STORE);
}

/**
 * @param {Request} request
 * @param {Env} env
 * @param {Member} member
 * @param {number | null} id  null for a new notice.
 */
async function save(request, env, member, id) {
	const n = checkNotice(await request.json().catch(() => null));
	const values = [n.kind, n.text_en, n.text_my, n.link, n.audience, n.starts_at, n.ends_at, n.yearly, member.id, n.announce_at];
	if (id === null) {
		const row = await env.APP.prepare(
			`INSERT INTO notices (kind, text_en, text_my, link, audience, starts_at, ends_at, yearly, updated_by, announce_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10) RETURNING id`,
		)
			.bind(...values)
			.first();
		return json({ ok: true, id: Number(row?.id) }, NO_STORE);
	}
	const { meta } = await env.APP.prepare(
		`UPDATE notices SET kind = ?1, text_en = ?2, text_my = ?3, link = ?4, audience = ?5, starts_at = ?6, ends_at = ?7, yearly = ?8,
		        updated_by = ?9, announce_at = ?10, updated_at = unixepoch() WHERE id = ?11`,
	)
		.bind(...values, id)
		.run();
	if (!meta.changes) throw new AppError('not_found', `No notice ${id}`);
	return json({ ok: true, id }, NO_STORE);
}
