#!/usr/bin/env node
// @ts-check
/**
 * Puts an Android App Bundle on a Google Play track, as Transporter puts an
 * iOS build on TestFlight: the Google Play Developer API (Android Publisher
 * v3), signed in as a Google service account. Standard library only.
 *
 *   GOOGLE_PLAY_ACCOUNT='<the service account's JSON key>' \
 *     node scripts/play-upload.js <bundle.aab> [--track internal] [--notes "…"] [--apply]
 *
 * The steps, all in one edit (nothing shows in Play until it is committed):
 *   1. an access token, from a JWT the service account signs (RS256);
 *   2. an edit opened for the app (com.myordbok.app);
 *   3. the bundle uploaded: Play answers with its version code;
 *   4. the track given a release of that version code, completed, with the
 *      release notes (en-US);
 *   5. the edit committed.
 *
 * Without --apply: the bundle and the key are checked, a token is asked
 * for and the edit opened, then the edit is deleted; nothing is uploaded.
 *
 * The service account needs, in the Play Console (Users and permissions),
 * for this app: Release apps to testing tracks. Google can take up to a day
 * to know a new account; until then every call answers 403.
 */
import { createSign } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';

const PACKAGE = 'com.myordbok.app';
const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}`;
const UPLOAD = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PACKAGE}`;
const TRACKS = ['internal', 'alpha', 'beta', 'production'];

/** @param {string} message */
function fail(message) {
	console.error(`play-upload: ${message}`);
	process.exit(1);
}

/** @param {string} name @returns {string | undefined} */
function option(name) {
	const i = process.argv.indexOf(name);
	return i > -1 ? process.argv[i + 1] : undefined;
}

/** @param {string | Buffer} data */
const b64url = (data) => Buffer.from(data).toString('base64url');

/**
 * An access token for the Android Publisher API.
 * @param {{ client_email: string, private_key: string, token_uri?: string }} account
 */
async function token(account) {
	const now = Math.floor(Date.now() / 1000);
	const aud = account.token_uri ?? 'https://oauth2.googleapis.com/token';
	const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
	const claims = b64url(JSON.stringify({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud, iat: now, exp: now + 3600 }));
	const signer = createSign('RSA-SHA256');
	signer.update(`${head}.${claims}`);
	const jwt = `${head}.${claims}.${b64url(signer.sign(account.private_key))}`;
	const res = await fetch(aud, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
	});
	const body = await res.json().catch(() => ({}));
	if (!res.ok || !body.access_token) fail(`Google gave no access token (${res.status}): ${JSON.stringify(body)}`);
	return /** @type {string} */ (body.access_token);
}

/**
 * One call to the API; a failure stops the run with Google's own answer.
 * @param {string} what  For the message.
 * @param {string} url
 * @param {RequestInit} init
 */
async function call(what, url, init) {
	const res = await fetch(url, init);
	const text = await res.text();
	if (!res.ok) {
		const hint = res.status === 403 ? ' (the service account needs "Release apps to testing tracks" for this app in the Play Console; a new account can take up to a day to be known)' : '';
		fail(`${what}: ${res.status}${hint}\n${text}`);
	}
	return text ? JSON.parse(text) : {};
}

const [bundle] = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && !['--track', '--notes'].includes(all[i - 1]));
const track = option('--track') ?? 'internal';
const notes = option('--notes') ?? '';
const apply = process.argv.includes('--apply');

if (!bundle || !bundle.endsWith('.aab')) fail('usage: node scripts/play-upload.js <bundle.aab> [--track internal] [--notes "…"] [--apply]');
if (!TRACKS.includes(track)) fail(`unknown track "${track}" (expected ${TRACKS.join(', ')})`);
if (notes.length > 500) fail(`the release notes are ${notes.length} characters; Play takes at most 500`);
const size = await stat(bundle).then((s) => s.size).catch(() => fail(`no bundle at ${bundle}`));
const raw = process.env.GOOGLE_PLAY_ACCOUNT;
if (!raw) fail('GOOGLE_PLAY_ACCOUNT is not set: the service account\'s JSON key, as a GitHub Actions secret');
/** @type {{ client_email: string, private_key: string, token_uri?: string }} */
let account;
try {
	account = JSON.parse(/** @type {string} */ (raw));
} catch {
	fail('GOOGLE_PLAY_ACCOUNT is not JSON: paste the whole key file the service account gave');
}
if (!account.client_email || !account.private_key) fail('GOOGLE_PLAY_ACCOUNT has no client_email or private_key: is it a service account key?');

console.log(`${bundle} (${(Number(size) / 1048576).toFixed(1)} MB) → ${PACKAGE}, track ${track}, as ${account.client_email}`);
const auth = { authorization: `Bearer ${await token(account)}` };
const edit = await call('Opening an edit', `${API}/edits`, { method: 'POST', headers: auth });
const editUrl = `${API}/edits/${edit.id}`;

if (!apply) {
	await call('Deleting the trial edit', editUrl, { method: 'DELETE', headers: auth });
	console.log('Dry run: signed in and opened an edit (deleted again); nothing uploaded. Add --apply to upload.');
	process.exit(0);
}

const uploaded = await call('Uploading the bundle', `${UPLOAD}/edits/${edit.id}/bundles?uploadType=media`, {
	method: 'POST',
	headers: { ...auth, 'content-type': 'application/octet-stream' },
	body: await readFile(bundle),
});
const code = String(uploaded.versionCode);
console.log(`uploaded: version code ${code}`);
await call(`Releasing on ${track}`, `${editUrl}/tracks/${track}`, {
	method: 'PUT',
	headers: { ...auth, 'content-type': 'application/json' },
	body: JSON.stringify({ track, releases: [{ versionCodes: [code], status: 'completed', ...(notes ? { releaseNotes: [{ language: 'en-US', text: notes }] } : {}) }] }),
});
await call('Committing the edit', `${editUrl}:commit`, { method: 'POST', headers: auth });
console.log(`on ${track}: version code ${code}`);
