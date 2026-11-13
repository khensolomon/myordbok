// @ts-check
/**
 * Supporters (tables donors and donations, migration 0012): the public
 * Support page's figures, and the owner's list in the workspace (Sponsors).
 *
 *   GET  /api/support                                   totals and the names shown, by year, and
 *                                                       the monthly running cost when the owner gave one;
 *                                                       kept at the edge for ten minutes
 *   GET  /api/workspace/sponsors                        every donor with their totals, owner
 *   GET  /api/workspace/sponsors/{id}                   one donor and their donations
 *   POST /api/workspace/sponsors                        a new donor
 *   POST /api/workspace/sponsors/{id}                   a donor changed
 *   POST /api/workspace/sponsors/{id}/delete            a donor with no donations
 *   POST /api/workspace/sponsors/{id}/donations         a donation of theirs
 *   POST /api/workspace/donations/{id}/delete           a donation removed
 *
 * The public answer has names only of donors shown (their consent), never an
 * amount beside a name, and counts the rest as anonymous. Amounts are US
 * cents, after the payment service's fees.
 */
import { AppError } from '../../shared/errors.js';
import { atLeast } from '../../shared/roles.js';
import { json } from '../lib/http.js';
import { getSetting } from '../lib/settings.js';

/** @typedef {import('./auth.js').AuthEnv} Env */
/** @typedef {import('../lib/session.js').Member} Member */

const NO_STORE = { headers: { 'cache-control': 'no-store' } };
export const METHODS = /** @type {const} */ (['paypal', 'github', 'stripe', 'bank', 'cash', 'other']);
const NAME_MAX = 80;
const NOTE_MAX = 500;
/** Largest single donation taken, in cents ($100,000): beyond it, a typing slip. */
const CENTS_MAX = 10_000_000;

/**
 * GET /api/support
 * @param {Env} env
 */
export async function publicSupport(env) {
	const [totals, rows, cost] = await Promise.all([
		env.APP.prepare('SELECT count(*) AS n, coalesce(sum(cents), 0) AS cents, min(day) AS first FROM donations').first(),
		env.APP.prepare(
			`SELECT substr(d.day, 1, 4) AS year, o.id, o.name, o.shown, u.avatar_url FROM donations d
			 JOIN donors o ON o.id = d.donor_id LEFT JOIN users u ON u.id = o.user_id AND u.status = 'active'
			 GROUP BY year, o.id ORDER BY year DESC, o.name COLLATE NOCASE`,
		).all(),
		getSetting(env, 'support.monthly_cost'),
	]);
	const t = /** @type {{ n: number, cents: number, first: string | null }} */ (totals);
	/** @type {Map<string, { year: string, names: Array<{ name: string, avatar_url: string | null }>, anonymous: number }>} */
	const years = new Map();
	for (const r of rows.results) {
		const year = String(r.year);
		if (!years.has(year)) years.set(year, { year, names: [], anonymous: 0 });
		const y = /** @type {{ names: Array<{ name: string, avatar_url: string | null }>, anonymous: number }} */ (years.get(year));
		if (Number(r.shown)) y.names.push({ name: String(r.name), avatar_url: r.avatar_url ? String(r.avatar_url) : null });
		else y.anonymous++;
	}
	return json({ count: Number(t.n), cents: Number(t.cents), since: t.first ? t.first.slice(0, 4) : null, years: [...years.values()], monthly_cost: Number(cost) || null }, { cache: 600 });
}

/**
 * Whether a member is a supporter: a donor linked to their account.
 * @param {Env} env
 * @param {number} userId
 */
export async function isSupporter(env, userId) {
	return Boolean(await env.APP.prepare('SELECT 1 FROM donors WHERE user_id = ?1').bind(userId).first());
}

// ---------------------------------------------------------------- the owner's list

/**
 * @param {Request} request
 * @param {Env} env
 * @param {Member} member
 * @param {string[]} parts  After /api/: workspace, sponsors|donations, …
 */
export async function manageSponsors(request, env, member, parts) {
	if (!atLeast(member.role, 'owner')) throw new AppError('forbidden', 'Sponsors are kept by the owner.');
	const [, what, id, action, extra] = parts;
	const get = request.method === 'GET';
	const post = request.method === 'POST';
	const isId = (/** @type {string | undefined} */ s) => s !== undefined && /^\d+$/.test(s);
	if (what === 'donations') {
		if (post && isId(id) && action === 'delete' && extra === undefined) return removeDonation(env, Number(id));
	} else if (what === 'sponsors') {
		if (get && id === undefined) return donorList(env);
		if (get && isId(id) && action === undefined) return donorDetail(env, Number(id));
		if (post && id === undefined) return saveDonor(request, env, null);
		if (post && isId(id) && action === undefined) return saveDonor(request, env, Number(id));
		if (post && isId(id) && action === 'delete' && extra === undefined) return removeDonor(env, Number(id));
		if (post && isId(id) && action === 'donations' && extra === undefined) return addDonation(request, env, Number(id));
	}
	throw new AppError('not_found', `No API route for ${request.method} ${new URL(request.url).pathname}`);
}

const DONOR = `SELECT o.id, o.name, o.shown, o.user_id, o.note, u.name AS member, count(d.id) AS count, coalesce(sum(d.cents), 0) AS cents, max(d.day) AS last, min(d.day) AS first
	FROM donors o LEFT JOIN users u ON u.id = o.user_id LEFT JOIN donations d ON d.donor_id = o.id`;

/** @param {Record<string, unknown>} r */
const donorOf = (r) => ({
	id: Number(r.id),
	name: String(r.name),
	shown: Boolean(Number(r.shown)),
	user_id: r.user_id === null ? null : Number(r.user_id),
	member: r.member === null ? null : String(r.member),
	note: r.note === null ? null : String(r.note),
	count: Number(r.count),
	cents: Number(r.cents),
	first: r.first === null ? null : String(r.first),
	last: r.last === null ? null : String(r.last),
});

/** @param {Env} env */
async function donorList(env) {
	const [donors, totals] = await Promise.all([
		env.APP.prepare(`${DONOR} GROUP BY o.id ORDER BY last IS NULL DESC, last DESC, o.name COLLATE NOCASE`).all(),
		env.APP.prepare('SELECT count(*) AS n, coalesce(sum(cents), 0) AS cents, min(day) AS first FROM donations').first(),
	]);
	const t = /** @type {{ n: number, cents: number, first: string | null }} */ (totals);
	return json({ donors: donors.results.map(donorOf), totals: { count: Number(t.n), cents: Number(t.cents), since: t.first ? t.first.slice(0, 4) : null } }, NO_STORE);
}

/**
 * @param {Env} env
 * @param {number} id
 */
async function donorDetail(env, id) {
	const row = await env.APP.prepare(`${DONOR} WHERE o.id = ?1 GROUP BY o.id`).bind(id).first();
	if (!row) throw new AppError('not_found', `There is no donor ${id}.`);
	const { results } = await env.APP.prepare('SELECT id, day, cents, method, recurring FROM donations WHERE donor_id = ?1 ORDER BY day DESC, id DESC').bind(id).all();
	return json({ donor: donorOf(row), donations: results.map((r) => ({ id: Number(r.id), day: String(r.day), cents: Number(r.cents), method: String(r.method), recurring: Boolean(Number(r.recurring)) })) }, NO_STORE);
}

/**
 * The member a donor is linked to, from their id or the email they sign in
 * with; null to unlink. Only the account's id is kept.
 * @param {Env} env
 * @param {unknown} value
 */
async function memberOf(env, value) {
	if (value === null || value === undefined || value === '') return null;
	const text = String(value).trim().toLowerCase();
	const row = /^\d+$/.test(text)
		? await env.APP.prepare('SELECT id FROM users WHERE id = ?1 AND id > 0').bind(Number(text)).first()
		: text.includes('@')
			? await env.APP.prepare('SELECT id FROM users WHERE email = ?1').bind(text).first()
			: null;
	if (!row) throw new AppError('bad_request', `No member has the id or sign-in email “${String(value).trim()}”.`);
	return Number(row.id);
}

/**
 * @param {Request} request
 * @param {Env} env
 * @param {number | null} id  null: a new donor.
 */
async function saveDonor(request, env, id) {
	const data = /** @type {Record<string, unknown> | null} */ (await request.json().catch(() => null));
	if (!data || typeof data !== 'object') throw new AppError('bad_request', 'Send { name, shown, member, note }');
	const name = typeof data.name === 'string' ? data.name.normalize('NFC').replace(/\s+/g, ' ').trim() : '';
	if (!name || name.length > NAME_MAX) throw new AppError('bad_request', `A name is 1 to ${NAME_MAX} characters.`);
	if (typeof data.shown !== 'boolean') throw new AppError('bad_request', 'shown must be true or false');
	const note = typeof data.note === 'string' && data.note.trim() ? data.note.normalize('NFC').trim() : null;
	if (note && note.length > NOTE_MAX) throw new AppError('bad_request', `A note is at most ${NOTE_MAX} characters.`);
	const userId = await memberOf(env, data.member);
	if (userId !== null) {
		const taken = await env.APP.prepare('SELECT id, name FROM donors WHERE user_id = ?1 AND id != ?2').bind(userId, id ?? 0).first();
		if (taken) throw new AppError('conflict', `That member is linked to ${taken.name} already.`);
	}
	if (id === null) {
		const row = /** @type {{ id: number }} */ (await env.APP.prepare('INSERT INTO donors (name, shown, user_id, note) VALUES (?1, ?2, ?3, ?4) RETURNING id').bind(name, data.shown ? 1 : 0, userId, note).first());
		return donorDetail(env, Number(row.id));
	}
	const { meta } = await env.APP.prepare('UPDATE donors SET name = ?1, shown = ?2, user_id = ?3, note = ?4 WHERE id = ?5').bind(name, data.shown ? 1 : 0, userId, note, id).run();
	if (!meta.changes) throw new AppError('not_found', `There is no donor ${id}.`);
	return donorDetail(env, id);
}

/**
 * @param {Env} env
 * @param {number} id
 */
async function removeDonor(env, id) {
	const gave = /** @type {{ n: number }} */ (await env.APP.prepare('SELECT count(*) AS n FROM donations WHERE donor_id = ?1').bind(id).first());
	if (Number(gave.n)) throw new AppError('conflict', `This donor has ${gave.n} donation(s); remove those first.`);
	const { meta } = await env.APP.prepare('DELETE FROM donors WHERE id = ?1').bind(id).run();
	if (!meta.changes) throw new AppError('not_found', `There is no donor ${id}.`);
	return json({ ok: true }, NO_STORE);
}

/**
 * Dollars as typed ("25", "6.85") in cents.
 * @param {unknown} value
 */
export function centsOf(value) {
	const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
	if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new AppError('bad_request', 'The amount is in dollars, like 25 or 6.85.');
	const [whole, part = ''] = text.split('.');
	const cents = Number(whole) * 100 + Number(part.padEnd(2, '0'));
	if (cents <= 0 || cents > CENTS_MAX) throw new AppError('bad_request', 'The amount must be more than 0 and at most 100,000 dollars.');
	return cents;
}

/**
 * A calendar day, not after tomorrow (UTC, so a day typed in any time zone fits).
 * @param {unknown} value
 */
function dayOf(value) {
	const day = typeof value === 'string' ? value.trim() : '';
	const at = Date.parse(`${day}T00:00:00Z`);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(at) || new Date(at).toISOString().slice(0, 10) !== day) throw new AppError('bad_request', 'The day is a date like 2026-11-12.');
	if (at > Date.now() + 86400000) throw new AppError('bad_request', 'The day is in the future.');
	if (day < '2000-01-01') throw new AppError('bad_request', 'The day is before MyOrdbok existed.');
	return day;
}

/**
 * @param {Request} request
 * @param {Env} env
 * @param {number} donorId
 */
async function addDonation(request, env, donorId) {
	const data = /** @type {Record<string, unknown> | null} */ (await request.json().catch(() => null));
	if (!data || typeof data !== 'object') throw new AppError('bad_request', 'Send { day, amount, method, recurring }');
	const day = dayOf(data.day);
	const cents = centsOf(data.amount);
	if (!METHODS.includes(/** @type {any} */ (data.method))) throw new AppError('bad_request', `method must be one of ${METHODS.join(', ')}`);
	if (typeof data.recurring !== 'boolean') throw new AppError('bad_request', 'recurring must be true or false');
	if (!(await env.APP.prepare('SELECT 1 FROM donors WHERE id = ?1').bind(donorId).first())) throw new AppError('not_found', `There is no donor ${donorId}.`);
	await env.APP.prepare('INSERT INTO donations (donor_id, day, cents, method, recurring) VALUES (?1, ?2, ?3, ?4, ?5)').bind(donorId, day, cents, data.method, data.recurring ? 1 : 0).run();
	return donorDetail(env, donorId);
}

/**
 * @param {Env} env
 * @param {number} id
 */
async function removeDonation(env, id) {
	const row = await env.APP.prepare('DELETE FROM donations WHERE id = ?1 RETURNING donor_id').bind(id).first();
	if (!row) throw new AppError('not_found', `There is no donation ${id}.`);
	return donorDetail(env, Number(row.donor_id));
}
