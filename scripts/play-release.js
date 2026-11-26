#!/usr/bin/env node
// @ts-check
/**
 * Releases on Google Play's tracks, without building anything: what each
 * track holds, a tested build moved on to another track, a staged rollout
 * widened, halted or resumed. Through the Play Developer API
 * (scripts/lib/play.js), as the service account in GOOGLE_PLAY_ACCOUNT.
 *
 *   node scripts/play-release.js status
 *   node scripts/play-release.js promote --from alpha --to production [--code 1202] [--rollout 20] [--notes "…"] [--apply]
 *   node scripts/play-release.js rollout --track production --rollout 50 [--apply]
 *   node scripts/play-release.js halt|resume --track production [--apply]
 *
 *   status    every track: its releases, their version codes, state and
 *             share of users. Changes nothing.
 *   promote   the newest release on --from (or the one holding --code) put
 *             on --to: completed, or to --rollout per cent of users first.
 *             Its release notes go with it unless --notes gives others.
 *   rollout   the staged rollout on --track to --rollout per cent; 100
 *             completes it.
 *   halt      the staged rollout on --track stopped where it is (those who
 *             have it keep it); resume starts it again.
 *
 * Tracks: internal, alpha (closed testing), beta (open testing), production.
 * Every change is one edit, committed only with --apply; without it the
 * change is printed and the edit deleted. Play reviews a change as it does
 * one made in the Console.
 */
import { API, account, auth as signIn, call, fail as stop } from './lib/play.js';
import { result } from './lib/result.js';

const TRACKS = ['internal', 'alpha', 'beta', 'production'];

/** @param {string} message */
const fail = (message) => stop(`play-release: ${message}`);

/** @param {string} name @returns {string | undefined} */
function option(name) {
	const i = process.argv.indexOf(name);
	const value = i > -1 ? process.argv[i + 1] : undefined;
	return value === '' ? undefined : value;
}

/** @param {string} name */
function track(name) {
	const value = option(name);
	if (!value) fail(`${name} is needed: one of ${TRACKS.join(', ')}`);
	if (!TRACKS.includes(/** @type {string} */ (value))) fail(`${name} "${value}" is not a track: ${TRACKS.join(', ')}`);
	return /** @type {string} */ (value);
}

/** The share of users from --rollout, in per cent. */
function share() {
	const raw = option('--rollout') ?? '100';
	const n = Number(raw);
	if (!(n > 0 && n <= 100)) fail(`--rollout is a share of users in per cent, above 0 and at most 100, not "${raw}"`);
	return n;
}

/**
 * @typedef {{ name?: string, versionCodes?: string[], status: string, userFraction?: number, releaseNotes?: { language: string, text: string }[] }} Release
 */

/** @param {Release} r */
const describe = (r) =>
	`${(r.versionCodes ?? []).join(', ') || '(no build)'} ${r.name ? `"${r.name}" ` : ''}${r.status}${r.userFraction ? ` to ${Math.round(r.userFraction * 1000) / 10}%` : ''}`;

const [command] = process.argv.slice(2);
if (!['status', 'promote', 'rollout', 'halt', 'resume'].includes(command)) fail('usage: node scripts/play-release.js status | promote --from … --to … | rollout --track … --rollout … | halt|resume --track … [--apply]');
const apply = process.argv.includes('--apply');

const auth = await signIn(account());
const edit = await call('Opening an edit', `${API}/edits`, { method: 'POST', headers: auth });
const editUrl = `${API}/edits/${edit.id}`;

/** @param {string} name @returns {Promise<Release[]>} */
const releases = async (name) => (await call(`Reading ${name}`, `${editUrl}/tracks/${name}`, { headers: auth })).releases ?? [];

/**
 * The track given these releases, then the edit committed (with --apply).
 * @param {string} name
 * @param {Release[]} list
 */
async function put(name, list) {
	console.log(`${name} becomes:`);
	for (const r of list) console.log(`  ${describe(r)}`);
	if (!apply) {
		await call('Deleting the trial edit', editUrl, { method: 'DELETE', headers: auth });
		console.log('Dry run: nothing changed. Add --apply (the workflow\'s "apply") to make the change.');
		return;
	}
	await call(`Changing ${name}`, `${editUrl}/tracks/${name}`, { method: 'PUT', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ track: name, releases: list }) });
	await call('Committing the edit', `${editUrl}:commit`, { method: 'POST', headers: auth });
	console.log(`Committed: Play reviews the change to ${name}.`);
}

/** The releases of a track that stay as they are beside a changed one: drafts. */
const kept = (/** @type {Release[]} */ list) => list.filter((r) => r.status === 'draft');

if (command === 'status') {
	/** @type {Record<string, { codes: string[], status: string, share: number | null, name: string | null }[]>} */
	const tracks = {};
	for (const name of TRACKS) {
		const list = await releases(name);
		tracks[name] = list.map((r) => ({ codes: r.versionCodes ?? [], status: r.status, share: r.userFraction ?? null, name: r.name ?? null }));
		console.log(`${name}: ${list.length ? '' : 'nothing'}`);
		for (const r of list) {
			console.log(`  ${describe(r)}`);
			for (const n of r.releaseNotes ?? []) console.log(`    notes (${n.language}): ${n.text.replace(/\n/g, ' / ')}`);
		}
	}
	await call('Closing the edit', editUrl, { method: 'DELETE', headers: auth });
	result({ tracks });
} else if (command === 'promote') {
	const from = track('--from');
	const to = track('--to');
	if (from === to) fail('--from and --to are the same track');
	const code = option('--code');
	const list = (await releases(from)).filter((r) => r.versionCodes?.length && r.status !== 'draft');
	const source = code ? list.find((r) => r.versionCodes?.includes(code)) : list.sort((a, b) => Math.max(...(b.versionCodes ?? []).map(Number)) - Math.max(...(a.versionCodes ?? []).map(Number)))[0];
	if (!source) fail(code ? `${from} has no release with version code ${code}` : `${from} has no release to promote`);
	const rollout = share();
	const notes = option('--notes');
	/** @type {Release} */
	const release = {
		name: source.name,
		versionCodes: source.versionCodes,
		...(rollout < 100 ? { status: 'inProgress', userFraction: rollout / 100 } : { status: 'completed' }),
		...(notes ? { releaseNotes: [{ language: 'en-US', text: notes }] } : source.releaseNotes ? { releaseNotes: source.releaseNotes } : {}),
	};
	console.log(`from ${from}: ${describe(/** @type {Release} */ (source))}`);
	await put(to, [release, ...kept(await releases(to))]);
} else {
	const name = track('--track');
	const list = await releases(name);
	const staged = list.find((r) => r.status === (command === 'resume' ? 'halted' : 'inProgress') || (command === 'rollout' && r.status === 'halted'));
	if (!staged) fail(`${name} has no ${command === 'resume' ? 'halted' : 'staged'} rollout (its releases: ${list.map(describe).join('; ') || 'none'})`);
	const rollout = command === 'rollout' ? share() : (staged.userFraction ?? 0) * 100;
	/** @type {Release} */
	const changed =
		command === 'halt'
			? { ...staged, status: 'halted' }
			: rollout >= 100
				? { ...staged, status: 'completed', userFraction: undefined }
				: { ...staged, status: 'inProgress', userFraction: rollout / 100 };
	// Completing a rollout retires the release it was replacing.
	const rest = list.filter((r) => r !== staged && (changed.status !== 'completed' || r.status !== 'completed'));
	await put(name, [changed, ...rest]);
}
