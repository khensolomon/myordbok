// @ts-check
/**
 * Linking the MyOrdbok app to a member's account. The app signs in nowhere
 * itself: the website does (Google, GitHub, Apple), and the app is handed a
 * session of its own once the member approves it there.
 *
 *   POST /api/link/start              the app (its header): a new code
 *        → { device_code, user_code: "ABCD-EFGH", url, expires_in, interval }
 *   POST /api/link/poll               the app: { device_code }
 *        → { status: 'pending' | 'denied' | 'expired' } or { status: 'approved', token }
 *   GET  /api/link/code/ABCD-EFGH     the website, signed in: the device asking
 *   POST /api/link/code/ABCD-EFGH     the website, signed in: { approve: true | false }
 *   GET  /api/devices                 the member's linked apps
 *   POST /api/devices/{id}/remove     signs one out; id from the list
 *
 * The app opens `url` (myordbok.com/link?code=…) in the system browser; the
 * member, signed in there, sees which kind of device asks and approves it.
 * The app asks after its code every few seconds with device_code, a secret
 * only it holds (stored as its SHA-256); the user_code alone cannot collect
 * the session. An approved code gives one token, once, and is deleted.
 * Codes last ten minutes; expired ones are cleared as new ones are made.
 *
 * The token is a session like a browser's (worker/lib/session.js), sent as
 * `Authorization: Bearer …`, kept a year; removing the device on the
 * Account page, or signing out in the app, ends it.
 */
import { AppError } from '../../shared/errors.js';
import { appOf } from '../lib/guard.js';
import { json } from '../lib/http.js';
import { currentMember, randomToken, sha256hex, startDeviceSession } from '../lib/session.js';

/** Seconds a code waits for approval. */
export const LINK_SECONDS = 600;
/** Seconds the app waits between asks. */
export const LINK_INTERVAL = 4;
/** Letters a user code is made of: no 0/O, 1/I/L, 5/S, 2/Z, 8/B to mistake. */
const ALPHABET = 'ACDEFGHJKMNPQRTUVWXY34679';

const NO_STORE = { headers: { 'cache-control': 'no-store' } };

/** @typedef {'ios' | 'android' | 'desktop'} Device */
/** @typedef {{ APP: D1Database }} LinkEnv */

/**
 * /api/link/…
 * @param {Request} request
 * @param {LinkEnv} env
 * @param {string[]} parts
 */
export async function link(request, env, parts) {
	if (parts.length === 2 && parts[1] === 'start' && request.method === 'POST') return start(request, env);
	if (parts.length === 2 && parts[1] === 'poll' && request.method === 'POST') return poll(request, env);
	if (parts.length === 3 && parts[1] === 'code') {
		const code = userCode(parts[2]);
		if (request.method === 'GET') return describe(request, env, code);
		if (request.method === 'POST') return decide(request, env, code);
	}
	throw new AppError('not_found', `No API route for ${new URL(request.url).pathname}`);
}

/**
 * /api/devices…
 * @param {Request} request
 * @param {LinkEnv} env
 * @param {string[]} parts
 */
export async function devices(request, env, parts) {
	const member = await requireMember(request, env);
	if (parts.length === 1 && request.method === 'GET') {
		const { results } = await env.APP.prepare(
			`SELECT substr(id_hash, 1, 16) AS id, device, created_at, expires_at FROM sessions
			 WHERE user_id = ?1 AND device IS NOT NULL AND expires_at > unixepoch() ORDER BY created_at DESC`,
		)
			.bind(member.id)
			.all();
		return json({ devices: results }, NO_STORE);
	}
	if (parts.length === 3 && parts[2] === 'remove' && request.method === 'POST') {
		if (!/^[0-9a-f]{16}$/.test(parts[1])) throw new AppError('bad_request', 'Not a device id');
		const res = await env.APP.prepare("DELETE FROM sessions WHERE user_id = ?1 AND device IS NOT NULL AND substr(id_hash, 1, 16) = ?2").bind(member.id, parts[1]).run();
		if (!res.meta.changes) throw new AppError('not_found', 'No such linked device');
		return json({ ok: true }, NO_STORE);
	}
	throw new AppError('not_found', `No API route for ${new URL(request.url).pathname}`);
}

/**
 * @param {Request} request
 * @param {LinkEnv} env
 */
async function start(request, env) {
	const app = appOf(request);
	if (!app) throw new AppError('forbidden', 'Only the MyOrdbok app links itself.');
	const device = /** @type {Device} */ (app.split('/')[0]);
	const deviceCode = randomToken();
	await env.APP.prepare('DELETE FROM device_links WHERE expires_at <= unixepoch()').run();
	// A clash of two waiting codes is one in hundreds of billions; tried again once.
	for (let tries = 0; ; tries++) {
		const code = newUserCode();
		try {
			await env.APP.prepare('INSERT INTO device_links (user_code, device_hash, device, expires_at) VALUES (?1, ?2, ?3, unixepoch() + ?4)')
				.bind(code, await sha256hex(deviceCode), device, LINK_SECONDS)
				.run();
		} catch (err) {
			if (tries < 1 && /UNIQUE|PRIMARY/i.test(String(err))) continue;
			throw err;
		}
		const shown = `${code.slice(0, 4)}-${code.slice(4)}`;
		const url = `${new URL(request.url).origin}/link?code=${shown}`;
		return json({ device_code: deviceCode, user_code: shown, url, expires_in: LINK_SECONDS, interval: LINK_INTERVAL }, NO_STORE);
	}
}

/**
 * @param {Request} request
 * @param {LinkEnv} env
 */
async function poll(request, env) {
	if (!appOf(request)) throw new AppError('forbidden', 'Only the MyOrdbok app links itself.');
	const data = await request.json().catch(() => null);
	const deviceCode = data && typeof data === 'object' ? /** @type {Record<string, unknown>} */ (data).device_code : null;
	if (typeof deviceCode !== 'string' || !/^[A-Za-z0-9_-]{20,100}$/.test(deviceCode)) throw new AppError('bad_request', 'device_code is required');
	const hash = await sha256hex(deviceCode);
	const row = /** @type {{ status: string, user_id: number | null, device: Device, expired: number } | null} */ (
		await env.APP.prepare('SELECT status, user_id, device, expires_at <= unixepoch() AS expired FROM device_links WHERE device_hash = ?1').bind(hash).first()
	);
	if (!row || row.expired) return json({ status: 'expired' }, NO_STORE);
	if (row.status === 'pending') return json({ status: 'pending' }, NO_STORE);
	// Taken once: whatever the answer, the code is spent.
	const taken = await env.APP.prepare('DELETE FROM device_links WHERE device_hash = ?1').bind(hash).run();
	if (!taken.meta.changes) return json({ status: 'expired' }, NO_STORE);
	if (row.status === 'denied' || row.user_id === null) return json({ status: 'denied' }, NO_STORE);
	const token = await startDeviceSession(env, row.user_id, row.device);
	return json({ status: 'approved', token }, NO_STORE);
}

/**
 * @param {Request} request
 * @param {LinkEnv} env
 * @param {string} code
 */
async function describe(request, env, code) {
	await requireMember(request, env);
	const row = await waiting(env, code);
	return json({ code: `${code.slice(0, 4)}-${code.slice(4)}`, device: row.device, created_at: row.created_at, expires_at: row.expires_at }, NO_STORE);
}

/**
 * @param {Request} request
 * @param {LinkEnv} env
 * @param {string} code
 */
async function decide(request, env, code) {
	// Approving is for this site's own pages only, not the app (index.js lets
	// its header through for other writes).
	if (request.headers.get('origin') !== new URL(request.url).origin) throw new AppError('forbidden', 'Approve the device on myordbok.com.');
	const member = await requireMember(request, env);
	const data = await request.json().catch(() => null);
	const approve = data && typeof data === 'object' ? /** @type {Record<string, unknown>} */ (data).approve : undefined;
	if (typeof approve !== 'boolean') throw new AppError('bad_request', 'approve must be true or false');
	await waiting(env, code);
	const res = await env.APP.prepare("UPDATE device_links SET status = ?2, user_id = ?3 WHERE user_code = ?1 AND status = 'pending' AND expires_at > unixepoch()")
		.bind(code, approve ? 'approved' : 'denied', approve ? member.id : null)
		.run();
	if (!res.meta.changes) throw new AppError('not_found', 'This code has expired or was already used. Start again in the app.');
	return json({ ok: true, approved: approve }, NO_STORE);
}

/**
 * A code still waiting for an answer.
 * @param {LinkEnv} env
 * @param {string} code
 */
async function waiting(env, code) {
	const row = /** @type {{ device: Device, created_at: number, expires_at: number } | null} */ (
		await env.APP.prepare("SELECT device, created_at, expires_at FROM device_links WHERE user_code = ?1 AND status = 'pending' AND expires_at > unixepoch()").bind(code).first()
	);
	if (!row) throw new AppError('not_found', 'This code has expired or was already used. Start again in the app.');
	return row;
}

/**
 * The code as stored: eight letters, no dash, upper case.
 * @param {string} text
 */
export function userCode(text) {
	const code = decodeURIComponent(text).replace(/[\s-]/g, '').toUpperCase();
	if (code.length !== 8 || [...code].some((c) => !ALPHABET.includes(c))) throw new AppError('bad_request', 'A code is eight letters and numbers, like ABCD-EFGH.');
	return code;
}

/** Eight characters from ALPHABET, evenly. */
export function newUserCode() {
	const out = [];
	while (out.length < 8) {
		const [b] = crypto.getRandomValues(new Uint8Array(1));
		if (b < 250) out.push(ALPHABET[b % 25]); // 250 = 10 × 25: no bias
	}
	return out.join('');
}

/**
 * @param {Request} request
 * @param {LinkEnv} env
 */
async function requireMember(request, env) {
	const member = await currentMember(request, env);
	if (!member) throw new AppError('unauthorized', 'Sign in to do this.');
	return member;
}
