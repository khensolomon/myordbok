// @ts-check
/**
 * The workspace's API. Roles are read from the database on every request
 * (worker/lib/session.js); a member sees only their own suggestions.
 *
 *   GET  /api/workspace/summary                  suggestion counts by status, the role, and
 *                                             for admins the Inbox's unread count
 *   GET  /api/workspace/edits?status=&mine=1&before=
 *                                             suggestions, newest first, 30 at a time;
 *                                             each with the sense as the dictionary has it now
 *   POST /api/workspace/edits/{id}/review        { decision: 'approve' | 'reject', note? }  editors
 *   GET  /api/workspace/studio?show=&q=&offset=  editors: the words that have edits, newest first,
 *                                                for the studio's list
 *   POST /api/workspace/edits/{id}/withdraw      the author, while it waits for review
 *   POST /api/workspace/edits/{id}/live          { live: true | false }  admins: show an approved
 *                                                edit to readers now, or take it off again
 *   GET  /api/workspace/searches[/word]          every word searched, for editors (searches.js)
 *   GET  /api/workspace/comments                 comments to moderate, for editors (comments.js)
 *   GET|POST /api/workspace/questions[/{id}]     Test yourself reports and often missed questions, for editors (quiz.js)
 *   GET  /api/workspace/overview                 figures for the home board: the whole
 *                                             site for editors and admins (offline use
 *                                             among them), the member's own for members
 *   POST /api/workspace/account/delete           { confirm }: the member's email (or
 *                                             DELETE without one); see deleteAccount
 *   GET  /api/workspace/ratings?scope=mine|site  the member's own ratings; editors also the
 *                                             site's most liked and disliked
 *   GET  /api/workspace/members[?q=&role=&status=], GET|POST /api/workspace/members/{id}
 *                                             admins and owners (routes/members.js)
 *   GET  /api/workspace/settings, POST /api/workspace/settings  { key, value }   admins
 *   GET  /api/workspace/messages, POST /api/workspace/messages/{id}
 *                                             the Inbox, admins (routes/messages.js)
 *   GET|POST /api/workspace/notices[/{id}[/delete]]
 *                                             site notices, admins (routes/notices.js)
 *
 * Only a waiting suggestion can be reviewed or withdrawn; what happens after
 * approval (export, merge) is make edits-export and the next release.
 */
import { AppError } from '../../shared/errors.js';
import { EDIT_TEXT_MAX } from '../../shared/limits.js';
import { atLeast, seesStatistics } from '../../shared/roles.js';
import { dictionary, explainDictError } from '../lib/dict.js';
import { json } from '../lib/http.js';
import { meaningHash } from '../lib/meaning.js';
import { liveLayer, requireLayerRoom, resetLayerCache } from '../lib/layer.js';
import { currentMember, endSession } from '../lib/session.js';
import { inbox, unseenAnswers } from './messages.js';
import { members } from './members.js';
import { manageNotices } from './notices.js';
import { searches } from './searches.js';
import { moderateComments } from './comments.js';
import { allSettings, getSetting, setSetting } from '../lib/settings.js';
import { BACKUP_INDEX } from '../../shared/backup.js';
import { manageSponsors } from './support.js';
import { questions } from './quiz.js';

/** @typedef {import('./auth.js').AuthEnv & import('../lib/dict.js').DictEnv & { STORAGE?: R2Bucket }} Env */
/** @typedef {import('../lib/session.js').Member} Member */

export const PAGE = 30;
const STATUSES = Object.freeze(['pending', 'approved', 'rejected', 'exported', 'merged', 'conflict']);
const NO_STORE = { headers: { 'cache-control': 'no-store' } };

/** Senses as the dictionary has them now, by id. */
const CURRENT = {
	emd: `SELECT s.id, w.word, s.wrte, t.name AS type, s.wrkd, k.name AS kind, s.sense, s.exam FROM emd_sense s
		JOIN eng_word w ON w.id = s.wrid JOIN type_word t ON t.id = s.wrte LEFT JOIN type_sense k ON k.id = s.wrkd
		WHERE s.id IN (SELECT value FROM json_each(?1))`,
	med: `SELECT s.id, w.word, s.wrte, t.name AS type, s.wrkd, k.name AS kind, s.sense, s.exam FROM med_sense s
		JOIN mya_word w ON w.id = s.wrid JOIN type_word t ON t.id = s.wrte LEFT JOIN type_sense k ON k.id = s.wrkd
		WHERE s.id IN (SELECT value FROM json_each(?1))`,
};

/** @param {Member} m */
const isEditor = (m) => atLeast(m.role, 'editor');

/**
 * @param {Request} request
 * @param {Env} env
 * @param {string[]} parts  Path parts after /api/.
 */
export async function workspace(request, env, parts) {
	const member = await currentMember(request, env);
	if (!member) throw new AppError('unauthorized', 'Sign in to open the workspace.');
	const [, what, id, action] = parts;
	if (request.method === 'GET' && what === 'summary' && parts.length === 2) return summary(env, member);
	if (request.method === 'GET' && what === 'edits' && parts.length === 2) return list(request, env, member);
	if (request.method === 'GET' && what === 'overview' && parts.length === 2) return overview(env, member);
	if (request.method === 'GET' && what === 'studio' && parts.length === 2) return studioWords(request, env, member);
	if (what === 'messages' && parts.length <= 3) return inbox(request, env, member, id);
	if (what === 'settings' && parts.length === 2) return settings(request, env, member);
	if (what === 'members' && parts.length <= 3) return members(request, env, member, id);
	if (what === 'notices' && parts.length <= 4) return manageNotices(request, env, member, id, action);
	if (what === 'searches' && parts.length <= 3) return searches(request, env, member, id);
	if (what === 'comments' && parts.length <= 3) return moderateComments(request, env, member, id);
	if (what === 'questions' && parts.length <= 3) return questions(request, env, member, id);
	if ((what === 'sponsors' || what === 'donations') && parts.length <= 5) return manageSponsors(request, env, member, parts);
	if (request.method === 'GET' && what === 'ratings' && parts.length === 2) return ratings(request, env, member);
	if (request.method === 'POST' && what === 'account' && id === 'delete' && parts.length === 3) return deleteAccount(request, env, member);
	if (request.method === 'POST' && what === 'edits' && parts.length === 4 && /^\d+$/.test(id)) {
		if (action === 'review') return review(request, env, member, Number(id));
		if (action === 'withdraw') return withdraw(env, member, Number(id));
		if (action === 'live') return makeLive(request, env, member, Number(id));
	}
	throw new AppError('not_found', `No API route for ${request.method} ${new URL(request.url).pathname}`);
}

const STUDIO_PAGE = 50;
/** The studio's lists: every edited word, those with edits no release holds yet, those with live edits. */
const STUDIO_SHOWS = /** @type {Record<string, string>} */ ({
	edited: '1',
	waiting: "status IN ('pending', 'approved', 'exported')",
	live: "live_at IS NOT NULL AND status IN ('approved', 'exported')",
});

/**
 * Words that have edits, newest edit first, each with how its edits stand.
 * @param {Request} request
 * @param {Env} env
 * @param {Member} member
 */
async function studioWords(request, env, member) {
	if (!isEditor(member)) throw new AppError('forbidden', 'The studio is for editors.');
	const p = new URL(request.url).searchParams;
	const show = p.get('show') ?? 'edited';
	if (!Object.hasOwn(STUDIO_SHOWS, show)) throw new AppError('bad_request', `show must be one of ${Object.keys(STUDIO_SHOWS).join(', ')}`);
	const q = (p.get('q') ?? '').normalize('NFC').trim();
	const offset = Number(p.get('offset') ?? 0);
	if (!Number.isInteger(offset) || offset < 0) throw new AppError('bad_request', 'offset must be a whole number, 0 or more');
	const live = "live_at IS NOT NULL AND status IN ('approved', 'exported')";
	const [{ results }, counts] = await Promise.all([
		env.APP.prepare(
			`SELECT dict, min(word) AS word, count(*) AS edits, max(created_at) AS at,
			        coalesce(sum(status = 'pending'), 0) AS pending, coalesce(sum(${live}), 0) AS live,
			        coalesce(sum(status IN ('approved', 'exported') AND live_at IS NULL), 0) AS waiting
			 FROM dict_edits WHERE ${STUDIO_SHOWS[show]} AND (?1 = '' OR word LIKE ?2 ESCAPE '\\')
			 GROUP BY dict, lower(word) ORDER BY at DESC, word LIMIT ?3 OFFSET ?4`,
		)
			.bind(q, `${likeEscape(q)}%`, STUDIO_PAGE + 1, offset)
			.all(),
		env.APP.prepare(
			`SELECT count(DISTINCT dict || ':' || lower(word)) AS edited,
			        count(DISTINCT CASE WHEN ${STUDIO_SHOWS.waiting} THEN dict || ':' || lower(word) END) AS waiting,
			        count(DISTINCT CASE WHEN ${live} THEN dict || ':' || lower(word) END) AS live
			 FROM dict_edits`,
		).first(),
	]);
	return json(
		{
			words: results.slice(0, STUDIO_PAGE).map((r) => ({ lang: r.dict === 'emd' ? 'en' : 'my', word: r.word, edits: Number(r.edits), at: Number(r.at), pending: Number(r.pending), live: Number(r.live), waiting: Number(r.waiting) })),
			more: results.length > STUDIO_PAGE,
			counts: { edited: Number(counts?.edited ?? 0), waiting: Number(counts?.waiting ?? 0), live: Number(counts?.live ?? 0) },
		},
		NO_STORE,
	);
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
	const unread = atLeast(member.role, 'admin') ? /** @type {{ n: number }} */ (await env.APP.prepare("SELECT count(*) AS n FROM messages WHERE status = 'new'").first()).n : null;
	return json(
		{ role: member.role, mine: Object.fromEntries(own.results.map((r) => [String(r.status), Number(r.n)])), waiting: waiting === null ? null : Number(waiting), ...(unread === null ? {} : { unread: Number(unread) }), answers: await unseenAnswers(env, member.id) },
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
	// One word's edits, for its history in the studio: ?word= with ?lang=.
	const word = (url.searchParams.get('word') ?? '').normalize('NFC').trim();
	const wordDict = url.searchParams.get('lang') === 'my' ? 'med' : 'emd';

	const { results } = await env.APP.prepare(
		`SELECT e.id, e.dict, e.action, e.sense_id, e.field, e.old_value, e.new_value, e.word, e.data, e.source,
		        e.status, e.note, e.review_note, e.created_at, e.reviewed_at, e.user_id, e.live_at,
		        u.name AS author, r.name AS reviewer, l.name AS live_by
		 FROM dict_edits e JOIN users u ON u.id = e.user_id LEFT JOIN users r ON r.id = e.reviewed_by LEFT JOIN users l ON l.id = e.live_by
		 WHERE (?1 = 'all' OR e.status = ?1) AND (?2 = 0 OR e.user_id = ?3) AND (?4 = 0 OR e.id < ?4)
		   AND (?6 = '' OR (e.dict = ?7 AND e.word = ?6 COLLATE NOCASE))
		 ORDER BY e.id DESC LIMIT ?5`,
	)
		.bind(status, mine ? 1 : 0, member.id, before, PAGE + 1, word, wordDict)
		.all();
	const page = results.slice(0, PAGE);

	// Each sense as it is now, so a reviewer sees whether the dictionary moved
	// on: as readers see it (the build with the live edits over it), or, for
	// an edit that is live itself, as the build holds it.
	/** @type {Record<string, Record<string, unknown>>} */
	const current = {};
	/** @type {Record<string, Record<string, unknown>>} */
	const built = {};
	const ids = { emd: new Set(), med: new Set() };
	for (const e of page) if (e.sense_id !== null) ids[/** @type {'emd' | 'med'} */ (e.dict)].add(Number(e.sense_id));
	// Part of speech and status travel as ids; the list names them.
	const classed = page.some((e) => e.field === 'wrte' || e.field === 'wrkd');
	const layer = ids.emd.size || ids.med.size || classed ? await liveLayer(env) : null;
	const named = (/** @type {Record<string, unknown>} */ e, /** @type {unknown} */ value) =>
		!layer || value === null || (e.field !== 'wrte' && e.field !== 'wrkd') ? null : ((e.field === 'wrte' ? layer.typeName(Number(value)) : layer.kindName(Number(value))) ?? null);
	if (layer && (ids.emd.size || ids.med.size)) {
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
			const pick = (/** @type {Record<string, unknown>} */ r) => ({ word: r.word, type: r.type, kind: r.kind, wrte: r.wrte, wrkd: r.wrkd, sense: r.sense, exam: r.exam });
			for (const r of rows) built[`${name}:${r.id}`] = pick(r);
			for (const r of layer.senses(name, /** @type {any[]} */ (rows))) current[`${name}:${r.id}`] = pick(r);
		}
	}

	/**
	 * Whether readers see a live edit: false when the meaning changed first
	 * (the release will find a conflict); null when not live, or an addition.
	 * @param {Record<string, unknown>} e
	 */
	const showing = (e) => {
		if (e.live_at === null || e.sense_id === null || (e.status !== 'approved' && e.status !== 'exported')) return null;
		const now = current[`${e.dict}:${e.sense_id}`];
		if (e.action === 'delete') return now === undefined;
		return now !== undefined && String(now[String(e.field)] ?? '') === (e.new_value ?? '');
	};
	const edits = page.map((e) => ({
		...e,
		data: e.data ? JSON.parse(String(e.data)) : null,
		own: e.user_id === member.id,
		old_name: named(e, e.old_value),
		new_name: named(e, e.new_value),
		live: e.live_at !== null,
		showing: showing(e),
		current: e.sense_id === null ? null : ((e.live_at !== null ? built : current)[`${e.dict}:${e.sense_id}`] ?? null),
	}));
	return json({ edits, more: results.length > PAGE, role: member.role, live_on: (await getSetting(env, 'edits.live')) === 'on' }, NO_STORE);
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
	const note = typeof data?.note === 'string' ? data.note.replace(/[\t\r\n]+/g, ' ').trim().slice(0, EDIT_TEXT_MAX) || null : null;
	// An admin's or owner's approval makes it live; an editor's leaves it for the release.
	const live = decision === 'approve' && atLeast(member.role, 'admin');
	if (live) await requireLayerRoom(env);
	const row = /** @type {{ id: number, status: string, live: number } | null} */ (
		await env.APP.prepare(
			`UPDATE dict_edits SET status = ?2, reviewed_by = ?3, reviewed_at = unixepoch(), review_note = ?4,
			        live_by = CASE WHEN ?5 = 1 THEN ?3 END, live_at = CASE WHEN ?5 = 1 THEN unixepoch() END
			 WHERE id = ?1 AND status = 'pending' RETURNING id, status, live_at IS NOT NULL AS live`,
		)
			.bind(id, decision === 'approve' ? 'approved' : 'rejected', member.id, note, live ? 1 : 0)
			.first()
	);
	if (!row) await notWaiting(env, id);
	if (live) resetLayerCache();
	return json({ edit: { ...row, live: Boolean(row?.live) } }, NO_STORE);
}

/**
 * Shows an approved edit to readers now, or takes it off again; it reaches
 * the dataset with the next release either way.
 * @param {Request} request
 * @param {Env} env
 * @param {Member} member
 * @param {number} id
 */
async function makeLive(request, env, member, id) {
	if (!atLeast(member.role, 'admin')) throw new AppError('forbidden', 'Only admins and owners make an edit live.');
	const data = /** @type {Record<string, unknown> | null} */ (await request.json().catch(() => null));
	if (typeof data?.live !== 'boolean') throw new AppError('bad_request', 'live must be true or false');
	if (data.live) await requireLayerRoom(env);
	const row = /** @type {{ id: number, status: string, live: number } | null} */ (
		await env.APP.prepare(
			`UPDATE dict_edits SET live_by = CASE WHEN ?2 = 1 THEN ?3 END, live_at = CASE WHEN ?2 = 1 THEN unixepoch() END
			 WHERE id = ?1 AND status IN ('approved', 'exported') RETURNING id, status, live_at IS NOT NULL AS live`,
		)
			.bind(id, data.live ? 1 : 0, member.id)
			.first()
	);
	if (!row) {
		const now = /** @type {{ status: string } | null} */ (await env.APP.prepare('SELECT status FROM dict_edits WHERE id = ?1').bind(id).first());
		if (!now) throw new AppError('not_found', `There is no suggestion ${id}.`);
		throw new AppError('conflict', `Suggestion ${id} is ${now.status}; only an approved one that no release holds yet can be made live or taken off.`);
	}
	resetLayerCache();
	return json({ edit: { ...row, live: Boolean(row.live) } }, NO_STORE);
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

/** Days the overview looks back over. */
export const OVERVIEW_DAYS = 30;

/** @param {number} daysAgo */
function dayKey(daysAgo) {
	return new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
}

/**
 * @param {D1Database} db
 * @param {string} sql
 * @param {unknown[]} args
 */
async function rows(db, sql, ...args) {
	return (await db.prepare(sql).bind(...args).all()).results;
}

/**
 * The home board's figures.
 * @param {Env} env
 * @param {Member} member
 */
async function overview(env, member) {
	const db = env.APP;
	const [mine, rated, shared] = await Promise.all([
		rows(db, 'SELECT status, count(*) AS n FROM dict_edits WHERE user_id = ?1 GROUP BY status', member.id),
		db.prepare('SELECT (SELECT count(*) FROM reactions WHERE user_id = ?1) AS entries, (SELECT count(*) FROM sense_reactions WHERE user_id = ?1) AS senses').bind(member.id).first(),
		sharedFigures(env),
	]);
	const r = /** @type {{ entries: number, senses: number }} */ (rated);
	const own = { suggestions: Object.fromEntries(mine.map((x) => [String(x.status), Number(x.n)])), ratings: Number(r.entries) + Number(r.senses), rated: { entries: Number(r.entries), senses: Number(r.senses) } };
	const base = { role: member.role, insights: seesStatistics(member), own, answers: await unseenAnswers(env, member.id), days: OVERVIEW_DAYS, ...shared };
	if (!seesStatistics(member)) return json(base, NO_STORE);
	// The site's statistics: editors and above, and members shown them.
	const [usage, ratedDown] = await Promise.all([
		// Offline use (usage_counts): two weeks, for the last seven days against the seven before.
		rows(db, "SELECT day, name, n FROM usage_counts WHERE day >= ?1 AND (name LIKE 'offline.%' OR name LIKE 'download.%') ORDER BY day", dayKey(13)),
		rows(db, 'SELECT dict, sense_id, text_hash, sum(value = -1) AS down, sum(value = 1) AS up FROM sense_reactions GROUP BY dict, sense_id, text_hash HAVING down > 0 ORDER BY down DESC, up LIMIT 20'),
	]);
	const statistics = { usage: usage.map((u) => ({ day: String(u.day), name: String(u.name), n: Number(u.n) })), disliked: (await currentSenses(env, ratedDown)).slice(0, 5) };
	if (!isEditor(member)) return json({ ...base, ...statistics }, NO_STORE);

	const [edits, members, joined, sites] = await Promise.all([
		rows(db, 'SELECT status, count(*) AS n FROM dict_edits GROUP BY status'),
		rows(db, "SELECT role, count(*) AS n FROM users WHERE id > 0 AND status = 'active' GROUP BY role"),
		db.prepare('SELECT count(*) AS n FROM users WHERE id > 0 AND created_at >= unixepoch() - 7 * 86400').first(),
		// The build each site reads (scripts/data.js): beta ahead of live means a release waits for its promotion.
		rows(db, 'SELECT env, build FROM dict_release'),
	]);
	// Unread messages and the backups: admins only.
	const admin = atLeast(member.role, 'admin');
	const [unread, backup] = admin ? await Promise.all([db.prepare("SELECT count(*) AS n FROM messages WHERE status = 'new'").first().then((r) => Number(/** @type {{ n: number }} */ (r).n)), lastBackup(env)]) : [null, null];
	return json(
		{
			...base,
			...(admin ? { unread, backup } : {}),
			suggestions: Object.fromEntries(edits.map((x) => [String(x.status), Number(x.n)])),
			members: { roles: Object.fromEntries(members.map((x) => [String(x.role), Number(x.n)])), joinedWeek: Number(/** @type {{ n: number }} */ (joined).n) },
			builds: Object.fromEntries(sites.map((x) => [String(x.env), String(x.build)])),
			...statistics,
		},
		NO_STORE,
	);
}

/**
 * The newest backup of myordbok-app (backup/worker.js keeps the index), or
 * null when none has been made. A bucket that cannot be read says so on the
 * Overview instead of passing for "no backup", without taking the rest of
 * the Overview down with it.
 * @param {Env} env
 * @returns {Promise<{ at: string, name: string, bytes: number, kept: number } | { error: string } | null>}
 */
async function lastBackup(env) {
	if (!env.STORAGE) return { error: 'The R2 binding STORAGE is missing; it is declared in wrangler.toml for each environment.' };
	try {
		const object = await env.STORAGE.get(BACKUP_INDEX);
		if (!object) return null;
		const index = /** @type {import('../../shared/backup.js').BackupIndex} */ (await object.json());
		const newest = index.backups[0];
		return newest ? { at: newest.at, name: newest.name, bytes: newest.bytes, kept: index.backups.length } : null;
	} catch (err) {
		return { error: `The backup index could not be read: ${err instanceof Error ? err.message : err}` };
	}
}

/** How long the figures every member sees are kept at the edge (seconds). */
const SHARED_TTL = 600;

/**
 * What every member sees on the Overview: the dictionary's statistics (one
 * row, kept per build by make data-publish), searches over the last days,
 * and the community's totals. The same for everyone, so kept at the edge for
 * a few minutes rather than read again on each visit.
 * @param {Env} env
 */
async function sharedFigures(env) {
	const { dict, db: dictDb } = await dictionary(env);
	const built = /** @type {{ value: string } | null} */ (
		await dictDb
			.prepare("SELECT value FROM meta WHERE key = 'built'")
			.first()
			.catch((err) => {
				throw explainDictError(err, dict, env);
			})
	)?.value;
	const cache = typeof caches === 'undefined' ? null : /** @type {Cache} */ (/** @type {any} */ (caches).default);
	const key = new Request(`https://workspace.internal/overview/${encodeURIComponent(built ?? 'none')}/${dayKey(0)}`);
	const hit = await cache?.match(key);
	if (hit) return hit.json();

	const db = env.APP;
	const since = dayKey(OVERVIEW_DAYS - 1);
	const [daily, top, wanted, stats, totals] = await Promise.all([
		rows(db, 'SELECT day, sum(hits) AS hits, sum(found = 0) AS missed FROM search_counts WHERE day >= ?1 GROUP BY day ORDER BY day', since),
		rows(db, 'SELECT lang, term, sum(hits) AS hits FROM search_counts WHERE day >= ?1 GROUP BY lang, term HAVING max(found) = 1 ORDER BY hits DESC, term LIMIT 10', since),
		rows(db, 'SELECT lang, term, sum(hits) AS hits FROM search_counts WHERE day >= ?1 GROUP BY lang, term HAVING max(found) = 0 ORDER BY hits DESC, term LIMIT 10', since),
		built
			? rows(db, 'SELECT build, stats FROM build_stats WHERE created_at <= coalesce((SELECT created_at FROM build_stats WHERE build = ?1), 0) ORDER BY created_at DESC LIMIT 2', built)
			: Promise.resolve([]),
		db
			.prepare(
				`SELECT (SELECT count(*) FROM users WHERE id > 0 AND status = 'active') AS members,
				        (SELECT count(*) FROM dict_edits WHERE status IN ('approved', 'exported', 'merged')) AS accepted,
				        (SELECT count(*) FROM dict_edits WHERE status = 'merged') AS merged,
				        (SELECT count(*) FROM reactions) + (SELECT count(*) FROM sense_reactions) AS ratings`,
			)
			.first(),
	]);
	const sumHits = (/** @type {number} */ days) => daily.filter((d) => String(d.day) >= dayKey(days - 1)).reduce((a, d) => a + Number(d.hits), 0);
	const current = stats.find((x) => x.build === built);
	const previous = stats.find((x) => x.build !== built);
	const t = /** @type {Record<string, number>} */ (totals);
	const figures = {
		dictionary: {
			build: built ?? null,
			stats: current ? JSON.parse(String(current.stats)) : null,
			previous: previous ? JSON.parse(String(previous.stats)) : null,
		},
		searches: {
			today: sumHits(1),
			week: sumHits(7),
			month: sumHits(OVERVIEW_DAYS),
			daily: daily.map((d) => ({ day: d.day, hits: Number(d.hits), missed: Number(d.missed) })),
			top: top.map((x) => ({ lang: x.lang, term: x.term, hits: Number(x.hits) })),
			wanted: wanted.map((x) => ({ lang: x.lang, term: x.term, hits: Number(x.hits) })),
		},
		community: { members: Number(t.members), accepted: Number(t.accepted), merged: Number(t.merged), ratings: Number(t.ratings) },
	};
	await cache?.put(key, new Response(JSON.stringify(figures), { headers: { 'content-type': 'application/json', 'cache-control': `max-age=${SHARED_TTL}` } }));
	return figures;
}

/**
 * Rated-down meanings that still read as they did when rated
 * (sense_reactions.text_hash), with their word, part of speech and text.
 * @param {Env} env
 * @param {Array<Record<string, unknown>>} rated  Rows with dict, sense_id, text_hash, down, up.
 */
async function currentSenses(env, rated) {
	/** @type {Array<Record<string, unknown>>} */
	const out = [];
	if (!rated.length) return out;
	const { dict, db: dictDb } = await dictionary(env);
	for (const name of /** @type {Array<'emd' | 'med'>} */ (['emd', 'med'])) {
		const ids = rated.filter((r) => r.dict === name).map((r) => Number(r.sense_id));
		if (!ids.length) continue;
		const now = await dictDb
			.prepare(CURRENT[name])
			.bind(JSON.stringify(ids))
			.all()
			.catch((err) => {
				throw explainDictError(err, dict, env);
			});
		for (const s of now.results) {
			const hash = await meaningHash(String(s.sense ?? ''));
			for (const r of rated.filter((d) => d.dict === name && Number(d.sense_id) === Number(s.id) && d.text_hash === hash)) {
				out.push({ dict: name, sense_id: s.id, word: s.word, type: s.type, sense: s.sense, down: Number(r.down), up: Number(r.up), ...(r.value === undefined ? {} : { value: Number(r.value) }), ...(r.at === undefined ? {} : { at: Number(r.at) }) });
			}
		}
	}
	out.sort((a, b) => Number(b.down) - Number(a.down) || Number(a.up) - Number(b.up));
	return out;
}

/**
 * Deletes the signed-in member's account. Their sign-ins, sessions, ratings,
 * comments, role history and waiting suggestions go; their reviewed
 * suggestions stay in the dataset's history under "Former member" (user 0).
 * The only active owner cannot be deleted.
 * @param {Request} request
 * @param {Env} env
 * @param {Member} member
 */
async function deleteAccount(request, env, member) {
	const data = /** @type {Record<string, unknown> | null} */ (await request.json().catch(() => null));
	const expected = member.email ?? 'DELETE';
	if (typeof data?.confirm !== 'string' || data.confirm.trim().toLowerCase() !== expected.toLowerCase()) {
		throw new AppError('bad_request', member.email ? 'Type the email address of the account to confirm.' : 'Type DELETE to confirm.');
	}
	if (member.role === 'owner') {
		const owners = /** @type {{ n: number }} */ (await env.APP.prepare("SELECT count(*) AS n FROM users WHERE role = 'owner' AND status = 'active' AND id > 0").first());
		if (Number(owners.n) <= 1) throw new AppError('conflict', 'The only owner cannot be deleted. Make another member owner first.');
	}
	const db = env.APP;
	const id = member.id;
	await db.batch([
		db.prepare("DELETE FROM dict_edits WHERE user_id = ?1 AND status = 'pending'").bind(id),
		db.prepare('UPDATE dict_edits SET user_id = 0 WHERE user_id = ?1').bind(id),
		db.prepare('UPDATE dict_edits SET reviewed_by = 0 WHERE reviewed_by = ?1').bind(id),
		db.prepare('UPDATE dict_edits SET live_by = 0 WHERE live_by = ?1').bind(id),
		db.prepare('UPDATE role_grants SET granted_by = 0 WHERE granted_by = ?1').bind(id),
		db.prepare('DELETE FROM role_grants WHERE user_id = ?1').bind(id),
		db.prepare('DELETE FROM reactions WHERE user_id = ?1').bind(id),
		db.prepare('DELETE FROM sense_reactions WHERE user_id = ?1').bind(id),
		db.prepare('DELETE FROM comments WHERE user_id = ?1').bind(id),
		db.prepare('DELETE FROM messages WHERE user_id = ?1').bind(id),
		// A report is about the dictionary, not the member: it stays, unsigned.
		db.prepare('UPDATE quiz_reports SET user_id = NULL WHERE user_id = ?1').bind(id),
		db.prepare('UPDATE settings SET updated_by = 0 WHERE updated_by = ?1').bind(id),
		db.prepare('UPDATE messages SET handled_by = 0 WHERE handled_by = ?1').bind(id),
		db.prepare('UPDATE notices SET updated_by = 0 WHERE updated_by = ?1').bind(id),
		db.prepare('DELETE FROM sessions WHERE user_id = ?1').bind(id),
		db.prepare('DELETE FROM identities WHERE user_id = ?1').bind(id),
		db.prepare('DELETE FROM users WHERE id = ?1').bind(id),
	]);
	const cookie = await endSession(request, env);
	return json({ ok: true }, { headers: { 'set-cookie': cookie, 'cache-control': 'no-store' } });
}

/**
 * Site settings, for admins (worker/lib/settings.js).
 * @param {Request} request
 * @param {Env} env
 * @param {Member} member
 */
async function settings(request, env, member) {
	if (!atLeast(member.role, 'admin')) throw new AppError('forbidden', 'Only admins change site settings.');
	if (request.method === 'POST') {
		const data = /** @type {{ key?: unknown, value?: unknown } | null} */ (await request.json().catch(() => null));
		if (!data || typeof data.key !== 'string') throw new AppError('bad_request', 'Send { key, value }');
		await setSetting(env, data.key, data.value, member.id);
	}
	return json({ settings: await allSettings(env) }, NO_STORE);
}

/** Ratings one page shows. */
const RATINGS_PAGE = 50;
/** Most meanings a word search looks among. */
const RATED_WORD_SENSES = 5000;

/**
 * Ratings, a page at a time. The member's own (scope=mine), newest first,
 * filtered by value=up|down; or for editors the site's (scope=site), each
 * meaning or entry with its counts, by order=down (not helpful most, the
 * default), up, or new (rated most recently). Both by kind=senses|entries
 * and ?q= (the word starts with), ?offset=. A meaning whose text changed
 * since it was rated shows as changed in the member's own list; in the
 * site's, only ratings of the text as it reads now count.
 * @param {Request} request
 * @param {Env} env
 * @param {Member} member
 */
async function ratings(request, env, member) {
	const p = new URL(request.url).searchParams;
	const scope = p.get('scope') ?? 'mine';
	if (scope !== 'mine' && scope !== 'site') throw new AppError('bad_request', 'scope must be mine or site');
	if (scope === 'site' && !seesStatistics(member)) throw new AppError('forbidden', 'The site’s ratings are for editors and members shown the statistics.');
	const kind = p.get('kind') ?? 'senses';
	if (kind !== 'senses' && kind !== 'entries') throw new AppError('bad_request', 'kind must be senses or entries');
	const value = p.get('value') ?? 'all';
	if (!['all', 'up', 'down'].includes(value)) throw new AppError('bad_request', 'value must be all, up or down');
	const order = p.get('order') ?? 'down';
	if (!['down', 'up', 'new'].includes(order)) throw new AppError('bad_request', 'order must be down, up or new');
	const offset = Number(p.get('offset') ?? 0);
	if (!Number.isInteger(offset) || offset < 0) throw new AppError('bad_request', 'offset must be a whole number');
	const q = (p.get('q') ?? '').normalize('NFC').trim();
	if (q.length > 60) throw new AppError('bad_request', 'q is longer than 60 characters');
	const db = env.APP;
	const mine = scope === 'mine';
	const who = mine ? 'user_id = ?1' : '?1 = ?1';

	// The counts above the list, for the scope, before any filter.
	const counts = /** @type {Record<string, number>} */ (
		await db
			.prepare(
				mine
					? `SELECT (SELECT count(*) FROM sense_reactions WHERE ${who}) AS senses, (SELECT count(*) FROM reactions WHERE ${who}) AS entries,
					          (SELECT count(*) FROM sense_reactions WHERE ${who} AND value = 1) + (SELECT count(*) FROM reactions WHERE ${who} AND value = 1) AS up,
					          (SELECT count(*) FROM sense_reactions WHERE ${who} AND value = -1) + (SELECT count(*) FROM reactions WHERE ${who} AND value = -1) AS down`
					: `SELECT (SELECT count(*) FROM (SELECT 1 FROM sense_reactions GROUP BY dict, sense_id)) AS senses, (SELECT count(*) FROM (SELECT 1 FROM reactions GROUP BY lang, word)) AS entries,
					          (SELECT count(*) FROM sense_reactions WHERE value = 1) + (SELECT count(*) FROM reactions WHERE value = 1) AS up,
					          (SELECT count(*) FROM sense_reactions WHERE value = -1) + (SELECT count(*) FROM reactions WHERE value = -1) AS down
					   WHERE ?1 = ?1`,
			)
			.bind(member.id)
			.first()
	);
	const base = { scope, kind, counts: { senses: Number(counts.senses), entries: Number(counts.entries), up: Number(counts.up), down: Number(counts.down) } };

	/** @type {string[]} */
	const where = [who];
	/** @type {unknown[]} */
	const args = [member.id];
	if (kind === 'entries') {
		if (q) where.push(`word LIKE ?${args.push(`${likeEscape(q)}%`)} ESCAPE '\\'`);
		if (mine && value !== 'all') where.push(`value = ${value === 'up' ? 1 : -1}`);
		const sql = mine
			? `SELECT lang, word, value, created_at AS at FROM reactions WHERE ${where.join(' AND ')} ORDER BY created_at DESC, word LIMIT ${RATINGS_PAGE + 1} OFFSET ${offset}`
			: `SELECT lang, word, sum(value = 1) AS up, sum(value = -1) AS down, max(created_at) AS at FROM reactions WHERE ${where.join(' AND ')} GROUP BY lang, word
			   ${order === 'up' ? 'HAVING up > 0 ORDER BY up DESC, down' : order === 'down' ? 'HAVING down > 0 ORDER BY down DESC, up' : 'ORDER BY at DESC'}, word LIMIT ${RATINGS_PAGE + 1} OFFSET ${offset}`;
		const got = await rows(db, sql, ...args);
		const items = got.slice(0, RATINGS_PAGE).map((r) => (mine ? { lang: r.lang, word: r.word, value: Number(r.value), at: Number(r.at) } : { lang: r.lang, word: r.word, up: Number(r.up), down: Number(r.down), at: Number(r.at) }));
		return json({ ...base, items, more: got.length > RATINGS_PAGE }, NO_STORE);
	}

	if (q) {
		const ids = await sensesOfWords(env, q);
		where.push(`((dict = 'emd' AND sense_id IN (SELECT value FROM json_each(?${args.push(JSON.stringify(ids.emd))}))) OR (dict = 'med' AND sense_id IN (SELECT value FROM json_each(?${args.push(JSON.stringify(ids.med))}))))`);
	}
	if (mine) {
		if (value !== 'all') where.push(`value = ${value === 'up' ? 1 : -1}`);
		const got = await rows(db, `SELECT dict, sense_id, text_hash, value, created_at AS at FROM sense_reactions WHERE ${where.join(' AND ')} ORDER BY created_at DESC, sense_id LIMIT ${RATINGS_PAGE + 1} OFFSET ${offset}`, ...args);
		const page = got.slice(0, RATINGS_PAGE);
		const now = await sensesNow(env, page);
		const items = await Promise.all(
			page.map(async (r) => {
				const s = now.get(`${r.dict}:${r.sense_id}`);
				return { dict: r.dict, sense_id: Number(r.sense_id), value: Number(r.value), at: Number(r.at), word: s?.word ?? null, type: s?.type ?? null, sense: s?.sense ?? null, state: !s ? 'gone' : (await meaningHash(String(s.sense ?? ''))) === r.text_hash ? 'current' : 'changed' };
			}),
		);
		return json({ ...base, items, more: got.length > RATINGS_PAGE }, NO_STORE);
	}
	const got = await rows(
		db,
		`SELECT dict, sense_id, text_hash, sum(value = -1) AS down, sum(value = 1) AS up, max(created_at) AS at FROM sense_reactions WHERE ${where.join(' AND ')}
		 GROUP BY dict, sense_id, text_hash ${order === 'up' ? 'HAVING up > 0 ORDER BY up DESC, down' : order === 'down' ? 'HAVING down > 0 ORDER BY down DESC, up' : 'ORDER BY at DESC'}, sense_id
		 LIMIT ${RATINGS_PAGE + 1} OFFSET ${offset}`,
		...args,
	);
	// Only ratings of the meaning as it reads now count: older texts drop out.
	const items = await currentSenses(env, got.slice(0, RATINGS_PAGE));
	const rank = order === 'up' ? (/** @type {any} */ a, /** @type {any} */ b) => b.up - a.up || a.down - b.down : order === 'down' ? (/** @type {any} */ a, /** @type {any} */ b) => b.down - a.down || a.up - b.up : (/** @type {any} */ a, /** @type {any} */ b) => b.at - a.at;
	items.sort(rank);
	return json({ ...base, items, more: got.length > RATINGS_PAGE }, NO_STORE);
}

/** @param {string} s  Text for LIKE, with its wildcards taken literally. */
const likeEscape = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * The meanings of the words starting with q, by dictionary.
 * @param {Env} env
 * @param {string} q
 */
async function sensesOfWords(env, q) {
	const { dict, db } = await dictionary(env);
	const like = `${likeEscape(q)}%`;
	const [emd, med] = await Promise.all(
		[
			`SELECT s.id FROM emd_sense s JOIN eng_word w ON w.id = s.wrid WHERE w.word LIKE ?1 ESCAPE '\\' LIMIT ${RATED_WORD_SENSES}`,
			`SELECT s.id FROM med_sense s JOIN mya_word w ON w.id = s.wrid WHERE w.word LIKE ?1 ESCAPE '\\' LIMIT ${RATED_WORD_SENSES}`,
		].map((sql) =>
			db
				.prepare(sql)
				.bind(like)
				.all()
				.then((r) => r.results.map((x) => Number(x.id)))
				.catch((err) => {
					throw explainDictError(err, dict, env);
				}),
		),
	);
	return { emd, med };
}

/**
 * The meanings of the given rows as they read now, by "dict:id".
 * @param {Env} env
 * @param {Array<Record<string, unknown>>} list  Rows with dict and sense_id.
 */
async function sensesNow(env, list) {
	/** @type {Map<string, Record<string, unknown>>} */
	const out = new Map();
	if (!list.length) return out;
	const { dict, db: dictDb } = await dictionary(env);
	for (const name of /** @type {Array<'emd' | 'med'>} */ (['emd', 'med'])) {
		const ids = list.filter((r) => r.dict === name).map((r) => Number(r.sense_id));
		if (!ids.length) continue;
		const now = await dictDb
			.prepare(CURRENT[name])
			.bind(JSON.stringify(ids))
			.all()
			.catch((err) => {
				throw explainDictError(err, dict, env);
			});
		for (const s of now.results) out.set(`${name}:${s.id}`, s);
	}
	return out;
}
