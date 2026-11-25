// @ts-check
/**
 * The Google Play Developer API (Android Publisher v3), signed in as the
 * service account in GOOGLE_PLAY_ACCOUNT: the access token and one call.
 * Standard library only; shared by scripts/play-upload.js and
 * scripts/play-listing.js.
 */
import { createSign } from 'node:crypto';

export const PACKAGE = 'com.myordbok.app';
export const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}`;
export const UPLOAD = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PACKAGE}`;

/** @param {string} message @returns {never} */
export function fail(message) {
	console.error(message);
	process.exit(1);
}

/** @param {string | Buffer} data */
const b64url = (data) => Buffer.from(data).toString('base64url');

/**
 * The service account from GOOGLE_PLAY_ACCOUNT, checked.
 * @returns {{ client_email: string, private_key: string, token_uri?: string }}
 */
export function account() {
	const raw = process.env.GOOGLE_PLAY_ACCOUNT;
	if (!raw) fail('GOOGLE_PLAY_ACCOUNT is not set: the service account\'s JSON key, as a GitHub Actions secret');
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		fail('GOOGLE_PLAY_ACCOUNT is not JSON: paste the whole key file the service account gave');
	}
	if (!parsed.client_email || !parsed.private_key) fail('GOOGLE_PLAY_ACCOUNT has no client_email or private_key: is it a service account key?');
	return parsed;
}

/**
 * The authorization header for the API, from a JWT the account signs (RS256).
 * @param {{ client_email: string, private_key: string, token_uri?: string }} acc
 * @returns {Promise<{ authorization: string }>}
 */
export async function auth(acc) {
	const now = Math.floor(Date.now() / 1000);
	const aud = acc.token_uri ?? 'https://oauth2.googleapis.com/token';
	const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
	const claims = b64url(JSON.stringify({ iss: acc.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud, iat: now, exp: now + 3600 }));
	const signer = createSign('RSA-SHA256');
	signer.update(`${head}.${claims}`);
	const jwt = `${head}.${claims}.${b64url(signer.sign(acc.private_key))}`;
	const res = await fetch(aud, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
	});
	const body = await res.json().catch(() => ({}));
	if (!res.ok || !body.access_token) fail(`Google gave no access token (${res.status}): ${JSON.stringify(body)}`);
	return { authorization: `Bearer ${body.access_token}` };
}

/**
 * One call to the API; a failure stops the run with Google's own answer.
 * @param {string} what  For the message.
 * @param {string} url
 * @param {RequestInit} init
 */
export async function call(what, url, init) {
	const res = await fetch(url, init);
	const text = await res.text();
	if (!res.ok) {
		const hint = res.status === 403 ? ' (the service account needs permission for this app in the Play Console, Users and permissions; a new account can take up to a day to be known)' : '';
		fail(`${what}: ${res.status}${hint}\n${text}`);
	}
	return text ? JSON.parse(text) : {};
}
