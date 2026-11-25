#!/usr/bin/env node
// @ts-check
/**
 * The App Store side of MyOrdbok through the App Store Connect API, as the
 * API key of the iOS build (secrets APPLE_API_ISSUER, APPLE_API_KEY,
 * APPLE_API_KEY_P8; the key needs the App Manager or Admin role for the
 * listing and the review). Standard library only.
 *
 *   node scripts/app-store.js status
 *   node scripts/app-store.js listing [--only texts|screenshots] [--apply]
 *   node scripts/app-store.js build [--build 1206] [--apply]
 *   node scripts/app-store.js submit [--release manual|after-approval] [--apply]
 *   node scripts/app-store.js release [--apply]
 *
 *   status    the app's versions and their state, the newest builds and
 *             their processing, the in-app purchases and their state.
 *             Changes nothing.
 *   listing   the version being prepared given the texts and screenshots of
 *             store/app-store/en-US/ (below); a version is made for the
 *             newest build's version number when none is being prepared.
 *             Only what differs is sent: a screenshot set is replaced
 *             whole, in file-name order, when its pictures differ (MD5).
 *   build     the newest processed build (or --build, its build number)
 *             chosen for the version being prepared.
 *   submit    the version being prepared sent for review, to be released
 *             by hand once approved (manual, the default) or as soon as it
 *             is (after-approval). A first in-app purchase goes for review
 *             only with a version, chosen on the version's page; while one
 *             waits, this stops and says so.
 *   release   the approved version (waiting for its developer) released.
 *
 *   store/app-store/en-US/
 *     name.txt               at most 30 characters   (the app's information)
 *     subtitle.txt           at most 30              (the app's information)
 *     privacy-url.txt                                (the app's information)
 *     description.txt        at most 4000
 *     keywords.txt           at most 100, commas between
 *     promotional-text.txt   at most 170 (changeable at any time)
 *     support-url.txt, marketing-url.txt
 *     whats-new.txt          at most 4000 (not for a first version)
 *     iphone-6.9/*.png       1320×2868 (or 1290×2796), up to 10
 *     ipad-13/*.png          2064×2752 (or 2048×2732), up to 10
 *   A file left out leaves that field as App Store Connect has it.
 *
 * Without --apply each command prints what it would change and changes
 * nothing.
 */
import { createHash, sign } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const BUNDLE = 'com.myordbok.app';
const API = 'https://api.appstoreconnect.apple.com/v1';
const ROOT = new URL('../store/app-store/', import.meta.url).pathname;
const LOCALE = 'en-US';
/** The versions that can still be changed. */
const EDITABLE = ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY'];
/** Texts of the version's localization: file, field, longest. */
const VERSION_TEXTS = /** @type {const} */ ([
	['description.txt', 'description', 4000],
	['keywords.txt', 'keywords', 100],
	['promotional-text.txt', 'promotionalText', 170],
	['support-url.txt', 'supportUrl', 255],
	['marketing-url.txt', 'marketingUrl', 255],
	['whats-new.txt', 'whatsNew', 4000],
]);
/** Texts of the app's information localization. */
const INFO_TEXTS = /** @type {const} */ ([
	['name.txt', 'name', 30],
	['subtitle.txt', 'subtitle', 30],
	['privacy-url.txt', 'privacyPolicyUrl', 255],
]);
/** Screenshot folders: App Store Connect's display type, the sizes it takes. */
const SHOTS = {
	'iphone-6.9': { type: 'APP_IPHONE_67', sizes: ['1320x2868', '1290x2796'] },
	'ipad-13': { type: 'APP_IPAD_PRO_3GEN_129', sizes: ['2064x2752', '2048x2732'] },
};

const args = process.argv.slice(2);
const [command] = args;
const apply = args.includes('--apply');
/** @param {string} name */
const option = (name) => {
	const i = args.indexOf(name);
	return i > -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : undefined;
};

/** @param {string} message @returns {never} */
function fail(message) {
	console.error(`app-store: ${message}`);
	process.exit(1);
}

if (!['status', 'listing', 'build', 'submit', 'release'].includes(command)) fail('usage: node scripts/app-store.js status | listing [--only texts|screenshots] | build [--build N] | submit [--release manual|after-approval] | release [--apply]');

/** A token for the API: a JWT the key signs (ES256), good for 20 minutes. */
function token() {
	const { APPLE_API_ISSUER: issuer, APPLE_API_KEY: kid, APPLE_API_KEY_P8: p8 } = process.env;
	if (!issuer || !kid || !p8) fail('APPLE_API_ISSUER, APPLE_API_KEY and APPLE_API_KEY_P8 are needed (the App Store Connect API key, as GitHub Actions secrets)');
	const b64 = (/** @type {object} */ o) => Buffer.from(JSON.stringify(o)).toString('base64url');
	const now = Math.floor(Date.now() / 1000);
	const body = `${b64({ alg: 'ES256', kid, typ: 'JWT' })}.${b64({ iss: issuer, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' })}`;
	return `${body}.${sign('sha256', Buffer.from(body), { key: p8, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}
const AUTH = { authorization: `Bearer ${token()}` };

/**
 * One call; a failure stops the run with Apple's own answer.
 * @param {string} what
 * @param {string} path  Under /v1, or a full address.
 * @param {{ method?: string, body?: object }} [init]
 */
async function call(what, path, init = {}) {
	const res = await fetch(path.startsWith('https:') ? path : `${API}${path}`, {
		method: init.method ?? 'GET',
		headers: { ...AUTH, ...(init.body ? { 'content-type': 'application/json' } : {}) },
		body: init.body ? JSON.stringify(init.body) : undefined,
	});
	const text = await res.text();
	if (!res.ok) {
		const hint = res.status === 403 ? ' (the API key needs the App Manager or Admin role in App Store Connect, Users and Access, Integrations)' : '';
		fail(`${what}: ${res.status}${hint}\n${text}`);
	}
	return text ? JSON.parse(text) : {};
}

/** @param {string} type @param {string} id @param {object} attributes */
const patch = (type, id, attributes) => ({ data: { type, id, attributes } });

const app = (await call('Finding the app', `/apps?filter[bundleId]=${BUNDLE}`)).data?.[0];
if (!app) fail(`App Store Connect has no app ${BUNDLE} the key can see`);
console.log(`${app.attributes.name} (${BUNDLE}, ${app.id})`);

/** The app's versions for iOS, newest first. */
async function versions() {
	return (await call('Reading the versions', `/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=10`)).data ?? [];
}
/** The newest builds, newest first. */
async function builds() {
	return (await call('Reading the builds', `/builds?filter[app]=${app.id}&sort=-uploadedDate&limit=10&include=preReleaseVersion`)).data ?? [];
}
/** @param {any} b */
const buildVersion = async (b) => (await call('Reading a build\'s version', `/builds/${b.id}/preReleaseVersion`)).data?.attributes?.version;
const state = (/** @type {any} */ v) => v.attributes.appVersionState ?? v.attributes.appStoreState;
/** The version being prepared, or none. */
const editable = async () => (await versions()).find((/** @type {any} */ v) => EDITABLE.includes(state(v)));

if (command === 'status') {
	console.log('\nVersions:');
	for (const v of await versions()) console.log(`  ${v.attributes.versionString}  ${state(v)}  ${v.attributes.releaseType ?? ''}  ${v.attributes.createdDate?.slice(0, 10) ?? ''}`);
	console.log('\nBuilds (newest first):');
	for (const b of await builds()) console.log(`  ${await buildVersion(b)} (${b.attributes.version})  ${b.attributes.processingState}  uploaded ${b.attributes.uploadedDate?.slice(0, 16).replace('T', ' ')}${b.attributes.expired ? '  expired' : ''}`);
	console.log('\nIn-app purchases:');
	const iaps = (await call('Reading the in-app purchases', `/apps/${app.id}/inAppPurchasesV2?limit=50`)).data ?? [];
	for (const p of iaps) console.log(`  ${p.attributes.productId}  ${p.attributes.inAppPurchaseType}  ${p.attributes.state}`);
	const v = await editable();
	if (v) {
		const build = (await call('Reading the version\'s build', `/appStoreVersions/${v.id}/build`)).data;
		console.log(`\nBeing prepared: ${v.attributes.versionString}, build ${build ? build.attributes.version : 'not chosen yet'}`);
		const locs = (await call('Reading the version\'s languages', `/appStoreVersions/${v.id}/appStoreVersionLocalizations`)).data ?? [];
		for (const loc of locs) {
			const sets = (await call('Reading the screenshot sets', `/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?limit=50`)).data ?? [];
			for (const set of sets) {
				const shots = (await call('Reading the screenshots', `/appScreenshotSets/${set.id}/appScreenshots?limit=10`)).data ?? [];
				const states = shots.map((/** @type {any} */ x) => x.attributes.assetDeliveryState?.state ?? '?');
				console.log(`  ${loc.attributes.locale} ${set.attributes.screenshotDisplayType}: ${shots.length} (${[...new Set(states)].map((st) => `${states.filter((x) => x === st).length} ${st}`).join(', ')})`);
				for (const x of shots) for (const e of x.attributes.assetDeliveryState?.errors ?? []) console.log(`    ${x.attributes.fileName}: ${e.code} ${e.description ?? ''}`);
			}
		}
	}
	process.exit(0);
}

/** The version being prepared; for listing, made when there is none. */
async function prepared(/** @type {boolean} */ make) {
	const v = await editable();
	if (v || !make) return v;
	const newest = (await builds()).find((/** @type {any} */ b) => b.attributes.processingState === 'VALID');
	if (!newest) fail('No version is being prepared, and no processed build gives a version number for one');
	const versionString = await buildVersion(newest);
	console.log(`${apply ? 'Making' : 'Would make'} version ${versionString} (the newest build's)`);
	if (!apply) return null;
	const made = await call('Making the version', '/appStoreVersions', {
		method: 'POST',
		body: { data: { type: 'appStoreVersions', attributes: { platform: 'IOS', versionString, releaseType: 'MANUAL' }, relationships: { app: { data: { type: 'apps', id: app.id } } } } },
	});
	return made.data;
}

if (command === 'listing') {
	const only = option('--only');
	if (only && !['texts', 'screenshots', 'all'].includes(only)) fail(`--only "${only}": texts or screenshots`);
	const dir = join(ROOT, LOCALE);
	const files = await readdir(dir).catch(() => fail(`no folder ${dir}`));
	/** @param {string} file @param {number} max */
	const text = async (file, max) => {
		if (!files.includes(file)) return undefined;
		const t = (await readFile(join(dir, file), 'utf8')).trim();
		if (!t) fail(`${LOCALE}/${file} is empty`);
		if ([...t].length > max) fail(`${LOCALE}/${file} has ${[...t].length} characters; the App Store takes at most ${max}`);
		return t;
	};
	const version = await prepared(true);
	let changes = 0;

	if (only !== 'screenshots') {
		// The app's information: name, subtitle, privacy policy.
		const infos = (await call('Reading the app information', `/apps/${app.id}/appInfos`)).data ?? [];
		const info = infos.find((/** @type {any} */ i) => !['READY_FOR_DISTRIBUTION', 'REPLACED_WITH_NEW_INFO'].includes(i.attributes.state ?? i.attributes.appStoreState)) ?? infos[0];
		const infoLoc = (await call('Reading its languages', `/appInfos/${info.id}/appInfoLocalizations`)).data.find((/** @type {any} */ l) => l.attributes.locale === LOCALE);
		/** @type {Record<string, string>} */
		const infoChange = {};
		for (const [file, field, max] of INFO_TEXTS) {
			const t = await text(file, max);
			if (t !== undefined && infoLoc?.attributes[field] !== t) infoChange[field] = t;
		}
		if (Object.keys(infoChange).length) {
			changes++;
			console.log(`app information (${LOCALE}): ${Object.keys(infoChange).join(', ')}`);
			if (apply) {
				if (!infoLoc) fail(`the app information has no ${LOCALE} language to change`);
				await call('Changing the app information', `/appInfoLocalizations/${infoLoc.id}`, { method: 'PATCH', body: patch('appInfoLocalizations', infoLoc.id, infoChange) });
			}
		}
	}

	if (!version) {
		console.log(`Dry run: ${changes} change(s) to the app information; the version's texts and screenshots follow once it exists. Add --apply.`);
		process.exit(0);
	}
	console.log(`version ${version.attributes.versionString} (${state(version)})`);
	const locs = (await call('Reading the version\'s languages', `/appStoreVersions/${version.id}/appStoreVersionLocalizations`)).data ?? [];
	let loc = locs.find((/** @type {any} */ l) => l.attributes.locale === LOCALE);

	if (only !== 'screenshots') {
		/** @type {Record<string, string>} */
		const change = {};
		const first = (await versions()).length === 1;
		for (const [file, field, max] of VERSION_TEXTS) {
			if (field === 'whatsNew' && first) continue;
			const t = await text(file, max);
			if (t !== undefined && loc?.attributes[field] !== t) change[field] = t;
		}
		if (Object.keys(change).length) {
			changes++;
			console.log(`version texts (${LOCALE}): ${Object.keys(change).join(', ')}`);
			if (apply) {
				if (loc) await call('Changing the version texts', `/appStoreVersionLocalizations/${loc.id}`, { method: 'PATCH', body: patch('appStoreVersionLocalizations', loc.id, change) });
				else
					loc = (
						await call('Adding the version language', '/appStoreVersionLocalizations', {
							method: 'POST',
							body: { data: { type: 'appStoreVersionLocalizations', attributes: { locale: LOCALE, ...change }, relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } } } } },
						})
					).data;
			}
		}
	}

	if (only !== 'texts') {
		if (!loc) fail(`version ${version.attributes.versionString} has no ${LOCALE} language for screenshots yet: send the texts first`);
		const sets = (await call('Reading the screenshot sets', `/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?include=appScreenshots&limit=50`)).data ?? [];
		for (const [folder, { type, sizes }] of Object.entries(SHOTS)) {
			if (!files.includes(folder)) continue;
			const names = (await readdir(join(dir, folder))).filter((f) => /\.png$/i.test(f)).sort();
			if (!names.length || names.length > 10) fail(`${LOCALE}/${folder} holds ${names.length} pictures; the App Store takes 1–10`);
			const pictures = await Promise.all(
				names.map(async (name) => {
					const data = await readFile(join(dir, folder, name));
					const size = `${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`;
					if (!sizes.includes(size)) fail(`${LOCALE}/${folder}/${name} is ${size}; ${type} takes ${sizes.join(' or ')}`);
					return { name, data, md5: createHash('md5').update(data).digest('hex') };
				}),
			);
			let set = sets.find((/** @type {any} */ s) => s.attributes.screenshotDisplayType === type);
			const now = set ? ((await call('Reading the screenshots', `/appScreenshotSets/${set.id}/appScreenshots?limit=10`)).data ?? []) : [];
			const same = now.length === pictures.length && now.every((/** @type {any} */ s, /** @type {number} */ i) => s.attributes.sourceFileChecksum === pictures[i].md5);
			if (same) continue;
			changes++;
			console.log(`${folder}: ${pictures.length} screenshots (now ${now.length})`);
			if (!apply) continue;
			if (!set)
				set = (
					await call(`Making the ${type} set`, '/appScreenshotSets', {
						method: 'POST',
						body: { data: { type: 'appScreenshotSets', attributes: { screenshotDisplayType: type }, relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: loc.id } } } } },
					})
				).data;
			for (const s of now) await call('Removing a screenshot', `/appScreenshots/${s.id}`, { method: 'DELETE' });
			for (const p of pictures) {
				const made = (
					await call(`Reserving ${p.name}`, '/appScreenshots', {
						method: 'POST',
						body: { data: { type: 'appScreenshots', attributes: { fileName: p.name, fileSize: p.data.length }, relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } } } },
					})
				).data;
				for (const op of made.attributes.uploadOperations) {
					const res = await fetch(op.url, {
						method: op.method,
						headers: Object.fromEntries(op.requestHeaders.map((/** @type {{ name: string, value: string }} */ h) => [h.name, h.value])),
						body: p.data.subarray(op.offset, op.offset + op.length),
					});
					if (!res.ok) fail(`Uploading ${p.name}: ${res.status} ${await res.text()}`);
				}
				await call(`Finishing ${p.name}`, `/appScreenshots/${made.id}`, { method: 'PATCH', body: patch('appScreenshots', made.id, { uploaded: true, sourceFileChecksum: p.md5 }) });
			}
			console.log(`${folder}: sent; Apple processes them in a few minutes`);
		}
	}
	console.log(apply ? `Done: ${changes} change(s).` : `Dry run: ${changes} change(s); nothing sent. Add --apply.`);
	process.exit(0);
}

if (command === 'build') {
	const version = await prepared(false);
	if (!version) fail('No version is being prepared: run listing first');
	const wanted = option('--build');
	const list = (await builds()).filter((/** @type {any} */ b) => b.attributes.processingState === 'VALID' && !b.attributes.expired);
	const build = wanted ? list.find((/** @type {any} */ b) => b.attributes.version === wanted) : list[0];
	if (!build) fail(wanted ? `no processed build ${wanted}` : 'no processed build yet (a build takes 10–30 minutes after upload)');
	const bv = await buildVersion(build);
	if (bv !== version.attributes.versionString) fail(`build ${build.attributes.version} is version ${bv}; the version being prepared is ${version.attributes.versionString}`);
	console.log(`${apply ? 'Choosing' : 'Would choose'} build ${build.attributes.version} for version ${bv}`);
	if (apply) await call('Choosing the build', `/appStoreVersions/${version.id}/relationships/build`, { method: 'PATCH', body: { data: { type: 'builds', id: build.id } } });
	process.exit(0);
}

if (command === 'submit') {
	const version = await prepared(false);
	if (!version) fail('No version is being prepared');
	const build = (await call('Reading the version\'s build', `/appStoreVersions/${version.id}/build`)).data;
	if (!build) fail(`version ${version.attributes.versionString} has no build: run build first`);
	const iaps = (await call('Reading the in-app purchases', `/apps/${app.id}/inAppPurchasesV2?limit=50`)).data ?? [];
	const waiting = iaps.filter((/** @type {any} */ p) => ['READY_TO_SUBMIT', 'MISSING_METADATA'].includes(p.attributes.state));
	const approvedBefore = (await versions()).some((/** @type {any} */ v) => ['READY_FOR_SALE', 'READY_FOR_DISTRIBUTION', 'REPLACED_WITH_NEW_VERSION', 'REMOVED_FROM_SALE'].includes(state(v)));
	if (waiting.length && !approvedBefore)
		fail(`in-app purchases wait for their first review (${waiting.map((/** @type {any} */ p) => p.attributes.productId).join(', ')}): they go only with this version, chosen on its page in App Store Connect ("In-App Purchases and Subscriptions"), so this first submission is made there`);
	const release = option('--release') ?? 'manual';
	if (!['manual', 'after-approval'].includes(release)) fail(`--release "${release}": manual or after-approval`);
	const releaseType = release === 'manual' ? 'MANUAL' : 'AFTER_APPROVAL';
	console.log(`${apply ? 'Submitting' : 'Would submit'} version ${version.attributes.versionString} (build ${build.attributes.version}), released ${release === 'manual' ? 'by hand once approved' : 'as soon as approved'}`);
	if (!apply) process.exit(0);
	if (version.attributes.releaseType !== releaseType) await call('Setting the release', `/appStoreVersions/${version.id}`, { method: 'PATCH', body: patch('appStoreVersions', version.id, { releaseType }) });
	const submission = (
		await call('Opening a review submission', '/reviewSubmissions', { method: 'POST', body: { data: { type: 'reviewSubmissions', attributes: { platform: 'IOS' }, relationships: { app: { data: { type: 'apps', id: app.id } } } } } })
	).data;
	await call('Adding the version', '/reviewSubmissionItems', {
		method: 'POST',
		body: { data: { type: 'reviewSubmissionItems', relationships: { reviewSubmission: { data: { type: 'reviewSubmissions', id: submission.id } }, appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } } } } },
	});
	await call('Submitting', `/reviewSubmissions/${submission.id}`, { method: 'PATCH', body: patch('reviewSubmissions', submission.id, { submitted: true }) });
	console.log('Submitted for review.');
	process.exit(0);
}

if (command === 'release') {
	const v = (await versions()).find((/** @type {any} */ x) => state(x) === 'PENDING_DEVELOPER_RELEASE');
	if (!v) fail('No version is approved and waiting to be released');
	console.log(`${apply ? 'Releasing' : 'Would release'} version ${v.attributes.versionString}`);
	if (apply) {
		await call('Releasing', '/appStoreVersionReleaseRequests', { method: 'POST', body: { data: { type: 'appStoreVersionReleaseRequests', relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: v.id } } } } } });
		console.log('Released: on the App Store within a few hours.');
	}
}
