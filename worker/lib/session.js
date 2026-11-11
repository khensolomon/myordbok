// @ts-check
/**
 * Sessions: a random token in an HttpOnly cookie, stored only as its
 * SHA-256 in the sessions table, so a copy of the database cannot be used
 * to sign in and deleting the row signs that device out at once.
 *
 * Cookies use the __Host- prefix (Secure, Path=/, no Domain): only this
 * exact site can set or read them, not another subdomain of myordbok.com.
 * SameSite=Lax keeps them off requests started by other sites, except the
 * top-level navigation back from Google or GitHub.
 */

export const SESSION_COOKIE = '__Host-mo_session';
export const SESSION_DAYS = 30;

/**
 * @typedef {object} Member
 * @property {number} id
 * @property {string} name
 * @property {string | null} email
 * @property {string | null} avatar_url
 * @property {import('../../shared/roles.js').Role} role
 * @property {0 | 1} insights  Shown the site's statistics (shared/roles.js seesStatistics).
 */

/** @param {number} [bytes] */
export function randomToken(bytes = 32) {
	return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** @param {Uint8Array} data */
export function base64url(data) {
	let text = '';
	for (const b of data) text += String.fromCharCode(b);
	return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** @param {string} text */
export async function sha256(text) {
	return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

/** @param {string} text */
async function sha256hex(text) {
	return [...(await sha256(text))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * @param {Request} request
 * @param {string} name
 */
export function readCookie(request, name) {
	for (const part of (request.headers.get('cookie') ?? '').split(';')) {
		const [key, ...rest] = part.trim().split('=');
		if (key === name) return rest.join('=');
	}
	return null;
}

/**
 * A Set-Cookie value. maxAge 0 deletes it.
 * @param {string} name
 * @param {string} value
 * @param {number} maxAge  Seconds.
 */
export function setCookie(name, value, maxAge) {
	return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

/**
 * The signed-in member, or null: no cookie, an unknown or expired session,
 * or a suspended member.
 * @param {Request} request
 * @param {{ APP: D1Database }} env
 * @returns {Promise<Member | null>}
 */
export async function currentMember(request, env) {
	const token = readCookie(request, SESSION_COOKIE);
	if (!token) return null;
	const row = await env.APP.prepare(
		`SELECT u.id, u.name, u.email, u.avatar_url, u.role, u.insights FROM sessions s JOIN users u ON u.id = s.user_id
		 WHERE s.id_hash = ?1 AND s.expires_at > unixepoch() AND u.status = 'active'`,
	)
		.bind(await sha256hex(token))
		.first();
	return /** @type {Member | null} */ (row);
}

/**
 * Starts a session; returns the cookie to set.
 * @param {{ APP: D1Database }} env
 * @param {number} userId
 */
export async function startSession(env, userId) {
	const token = randomToken();
	const seconds = SESSION_DAYS * 86400;
	await env.APP.batch([
		env.APP.prepare('INSERT INTO sessions (id_hash, user_id, expires_at) VALUES (?1, ?2, unixepoch() + ?3)').bind(await sha256hex(token), userId, seconds),
		env.APP.prepare('UPDATE users SET seen_at = unixepoch() WHERE id = ?1').bind(userId),
		// Expired sessions of this member are cleared as they sign in again.
		env.APP.prepare('DELETE FROM sessions WHERE user_id = ?1 AND expires_at <= unixepoch()').bind(userId),
	]);
	return setCookie(SESSION_COOKIE, token, seconds);
}

/**
 * Ends the session of this request; returns the cookie that deletes it.
 * @param {Request} request
 * @param {{ APP: D1Database }} env
 */
export async function endSession(request, env) {
	const token = readCookie(request, SESSION_COOKIE);
	if (token) await env.APP.prepare('DELETE FROM sessions WHERE id_hash = ?1').bind(await sha256hex(token)).run();
	return setCookie(SESSION_COOKIE, '', 0);
}
