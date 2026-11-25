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
 *   4. the track given a release of that version code, with the release
 *      notes (en-US): completed, or, with --rollout below 100, offered to
 *      that share of users first (a staged rollout; scripts/play-release.js
 *      widens it);
 *   5. the edit committed.
 *
 * Without --apply: the bundle and the key are checked, a token is asked
 * for and the edit opened, then the edit is deleted; nothing is uploaded.
 *
 * The service account needs, in the Play Console (Users and permissions),
 * for this app: Release apps to testing tracks. Google can take up to a day
 * to know a new account; until then every call answers 403.
 */
import { readFile, stat } from 'node:fs/promises';
import { API, PACKAGE, UPLOAD, account, auth as signIn, call, fail as stop } from './lib/play.js';

const TRACKS = ['internal', 'alpha', 'beta', 'production'];

/** @param {string} message */
const fail = (message) => stop(`play-upload: ${message}`);

/** @param {string} name @returns {string | undefined} */
function option(name) {
	const i = process.argv.indexOf(name);
	return i > -1 ? process.argv[i + 1] : undefined;
}

const [bundle] = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && !['--track', '--notes', '--rollout'].includes(all[i - 1]));
const rollout = Number(option('--rollout') ?? 100);
const track = option('--track') ?? 'internal';
const notes = option('--notes') ?? '';
const apply = process.argv.includes('--apply');

if (!bundle || !bundle.endsWith('.aab')) fail('usage: node scripts/play-upload.js <bundle.aab> [--track internal] [--notes "…"] [--apply]');
if (!TRACKS.includes(track)) fail(`unknown track "${track}" (expected ${TRACKS.join(', ')})`);
if (!(rollout > 0 && rollout <= 100)) fail(`--rollout is a share of users in per cent, above 0 and at most 100, not "${option('--rollout')}"`);
if (notes.length > 500) fail(`the release notes are ${notes.length} characters; Play takes at most 500`);
const size = await stat(bundle).then((s) => s.size).catch(() => fail(`no bundle at ${bundle}`));
const acc = account();

console.log(`${bundle} (${(Number(size) / 1048576).toFixed(1)} MB) → ${PACKAGE}, track ${track}, as ${acc.client_email}`);
const auth = await signIn(acc);
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
	body: JSON.stringify({ track, releases: [{ versionCodes: [code], ...(rollout < 100 ? { status: 'inProgress', userFraction: rollout / 100 } : { status: 'completed' }), ...(notes ? { releaseNotes: [{ language: 'en-US', text: notes }] } : {}) }] }),
});
await call('Committing the edit', `${editUrl}:commit`, { method: 'POST', headers: auth });
console.log(`on ${track}: version code ${code}${rollout < 100 ? `, to ${rollout}% of users` : ''}`);
