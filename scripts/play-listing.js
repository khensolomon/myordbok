#!/usr/bin/env node
// @ts-check
/**
 * The Play store listing from the repository: texts and graphics per
 * language in store/play/<language>/, sent through the Play Developer API
 * (scripts/lib/play.js), as the service account in GOOGLE_PLAY_ACCOUNT.
 *
 *   node scripts/play-listing.js [--only texts|screenshots|icon|feature] [--language en-US] [--apply]
 *
 *   store/play/<language>/          a Play language code: en-US, my-MM, …
 *     title.txt                     at most 30 characters
 *     short-description.txt         at most 80
 *     full-description.txt          at most 4000
 *     <imageType>/*.png|jpg         phoneScreenshots, sevenInchScreenshots,
 *                                   tenInchScreenshots (2–8 each),
 *                                   featureGraphic (1024×500), icon (512×512)
 *
 * Only what the folder holds is touched: a text file left out keeps Play's
 * text, an image folder left out keeps Play's images. An image folder
 * replaces all of that type, in file-name order, and only when its images
 * differ from Play's (by SHA-256).
 *
 * --only sends one part (the others stay as Play has them); --language one
 * language's folder.
 *
 * Without --apply: an edit is opened, Play's listing is printed (every
 * language, its texts in full and its image counts) beside what would
 * change, and the edit is deleted. With --apply the changes are sent in one
 * edit and committed; Play then reviews them, as it does a change made in
 * the Console.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { API, UPLOAD, account, auth as signIn, call, fail as stop } from './lib/play.js';

const ROOT = new URL('../store/play/', import.meta.url).pathname;
const TEXTS = /** @type {const} */ ({ title: ['title.txt', 30], shortDescription: ['short-description.txt', 80], fullDescription: ['full-description.txt', 4000] });
/** Each image type: how many, and the sizes Play takes. */
const IMAGES = /** @type {Record<string, { min: number, max: number, exact?: [number, number] }>} */ ({
	phoneScreenshots: { min: 2, max: 8 },
	sevenInchScreenshots: { min: 1, max: 8 },
	tenInchScreenshots: { min: 1, max: 8 },
	featureGraphic: { min: 1, max: 1, exact: [1024, 500] },
	icon: { min: 1, max: 1, exact: [512, 512] },
});

/** @param {string} message */
const fail = (message) => stop(`play-listing: ${message}`);
const apply = process.argv.includes('--apply');
/** @param {string} name */
const option = (name) => {
	const i = process.argv.indexOf(name);
	return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : undefined;
};
/** Each part --only can name, as the fields and image types it covers. */
const PARTS = {
	texts: ['title', 'shortDescription', 'fullDescription'],
	screenshots: ['phoneScreenshots', 'sevenInchScreenshots', 'tenInchScreenshots'],
	icon: ['icon'],
	feature: ['featureGraphic'],
};
const only = option('--only');
if (only && only !== 'all' && !(only in PARTS)) fail(`--only "${only}" is not a part: ${Object.keys(PARTS).join(', ')}`);
const parts = only && only !== 'all' ? PARTS[/** @type {keyof PARTS} */ (only)] : null;
const language = option('--language');

/**
 * A PNG's or JPEG's width and height, from its header.
 * @param {Buffer} b
 * @param {string} name
 * @returns {[number, number]}
 */
function size(b, name) {
	if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return [b.readUInt32BE(16), b.readUInt32BE(20)];
	if (b[0] === 0xff && b[1] === 0xd8) {
		for (let i = 2; i < b.length - 9; ) {
			if (b[i] !== 0xff) break;
			const marker = b[i + 1];
			if (marker >= 0xc0 && marker <= 0xc3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
			i += 2 + b.readUInt16BE(i + 2);
		}
	}
	return fail(`${name} is not a PNG or JPEG whose size can be read`);
}

/**
 * What the folder holds for one language, checked against Play's limits.
 * @param {string} lang
 */
async function local(lang) {
	const dir = join(ROOT, lang);
	const names = await readdir(dir);
	/** @type {Record<string, string>} */
	const texts = {};
	for (const [field, [file, max]] of Object.entries(TEXTS)) {
		if (!names.includes(file)) continue;
		const text = (await readFile(join(dir, file), 'utf8')).trim();
		if (!text) fail(`${lang}/${file} is empty`);
		if ([...text].length > max) fail(`${lang}/${file} has ${[...text].length} characters; Play takes at most ${max}`);
		texts[field] = text;
	}
	/** @type {Record<string, { name: string, data: Buffer, sha256: string }[]>} */
	const images = {};
	for (const type of names.filter((n) => n in IMAGES)) {
		const rule = IMAGES[type];
		const files = (await readdir(join(dir, type))).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort();
		if (files.length < rule.min || files.length > rule.max) fail(`${lang}/${type} holds ${files.length} images; Play takes ${rule.min}–${rule.max}`);
		images[type] = [];
		for (const f of files) {
			const data = await readFile(join(dir, type, f));
			const name = `${lang}/${type}/${f}`;
			if (data.length > 8 * 1024 * 1024) fail(`${name} is over 8 MB`);
			const [w, h] = size(data, name);
			if (rule.exact && (w !== rule.exact[0] || h !== rule.exact[1])) fail(`${name} is ${w}×${h}; Play takes ${rule.exact.join('×')}`);
			if (!rule.exact && (Math.min(w, h) < 320 || Math.max(w, h) > 3840 || Math.max(w, h) > 2 * Math.min(w, h))) fail(`${name} is ${w}×${h}; Play takes sides of 320–3840 px, the long one at most twice the short`);
			images[type].push({ name, data, sha256: createHash('sha256').update(data).digest('hex') });
		}
	}
	return { texts, images };
}

const langs = await readdir(ROOT, { withFileTypes: true })
	.then((all) => all.filter((d) => d.isDirectory() && (!language || language === 'all' || d.name === language)).map((d) => d.name).sort())
	.catch(() => /** @type {string[]} */ ([]));
if (language && language !== 'all' && !langs.length) fail(`store/play/ has no folder for ${language}`);
const wanted = Object.fromEntries(await Promise.all(langs.map(async (l) => [l, await local(l)])));

const acc = account();
const auth = await signIn(acc);
const edit = await call('Opening an edit', `${API}/edits`, { method: 'POST', headers: auth });
const editUrl = `${API}/edits/${edit.id}`;

/** @type {{ language: string, title: string, shortDescription: string, fullDescription: string }[]} */
const listings = (await call('Reading the listings', `${editUrl}/listings`, { headers: auth })).listings ?? [];
for (const l of listings) {
	console.log(`\n=== Play's listing, ${l.language}${langs.includes(l.language) ? '' : ' (no folder: left as it is)'}`);
	console.log(`title (${[...l.title].length}): ${l.title}`);
	console.log(`short description (${[...(l.shortDescription ?? '')].length}): ${l.shortDescription}`);
	console.log(`full description (${[...(l.fullDescription ?? '')].length}):\n${l.fullDescription}\n---`);
	for (const type of Object.keys(IMAGES)) {
		const got = (await call(`Reading ${l.language} ${type}`, `${editUrl}/listings/${l.language}/${type}`, { headers: auth })).images ?? [];
		console.log(`${type}: ${got.length}`);
	}
}

/** What changes, as [language, what, how] for the log and the apply. */
const changes = [];
for (const [lang, { texts, images }] of Object.entries(wanted)) {
	const now = listings.find((l) => l.language === lang);
	for (const [field, text] of Object.entries(texts)) {
		if (parts && !parts.includes(field)) continue;
		if (now?.[/** @type {'title'} */ (field)] !== text) changes.push({ lang, kind: 'text', field, text });
	}
	for (const [type, list] of Object.entries(images)) {
		if (parts && !parts.includes(type)) continue;
		const got = now ? (await call(`Reading ${lang} ${type}`, `${editUrl}/listings/${lang}/${type}`, { headers: auth })).images ?? [] : [];
		const same = got.length === list.length && got.every((/** @type {{ sha256: string }} */ g, /** @type {number} */ i) => g.sha256 === list[i].sha256);
		if (!same) changes.push({ lang, kind: 'images', field: type, list });
	}
}

console.log(`\n=== Changes (${changes.length})`);
for (const c of changes) console.log(c.kind === 'text' ? `${c.lang} ${c.field}: "${c.text.length > 70 ? `${c.text.slice(0, 70)}…` : c.text}"` : `${c.lang} ${c.field}: ${c.list.length} images (${c.list.map((i) => i.name.split('/').pop()).join(', ')})`);

if (!apply || !changes.length) {
	await call('Deleting the trial edit', editUrl, { method: 'DELETE', headers: auth });
	console.log(apply ? 'Nothing to change.' : 'Dry run: nothing sent. Add --apply to send the changes.');
	process.exit(0);
}

for (const lang of new Set(changes.filter((c) => c.kind === 'text').map((c) => c.lang))) {
	const body = Object.fromEntries(changes.filter((c) => c.lang === lang && c.kind === 'text').map((c) => [c.field, c.text]));
	await call(`Updating the ${lang} texts`, `${editUrl}/listings/${lang}`, { method: 'PATCH', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ language: lang, ...body }) });
	console.log(`${lang}: texts updated`);
}
for (const c of changes.filter((c) => c.kind === 'images')) {
	await call(`Clearing ${c.lang} ${c.field}`, `${editUrl}/listings/${c.lang}/${c.field}`, { method: 'DELETE', headers: auth });
	for (const img of c.list) {
		const type = img.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
		await call(`Uploading ${img.name}`, `${UPLOAD}/edits/${edit.id}/listings/${c.lang}/${c.field}?uploadType=media`, { method: 'POST', headers: { ...auth, 'content-type': type }, body: img.data });
	}
	console.log(`${c.lang} ${c.field}: ${c.list.length} images`);
}
await call('Committing the edit', `${editUrl}:commit`, { method: 'POST', headers: auth });
console.log('Committed: Play reviews the listing changes.');
