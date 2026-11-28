// @ts-check
/**
 * The guide on the device: the docs the release shipped (/guide/, served
 * to editors and up: worker/routes/guide.js), kept in the browser's cache
 * by their content hash, and indexed here (shared/guide/) in a moment.
 * The workspace's Guide (workspace/guide.js) and the search box's guide
 * rows (reader/search-box.js) read the same index; a reader below editor
 * never loads this module.
 *
 * Nothing leaves the device: questions are read and answered here.
 */
import { atLeast } from '#shared/roles.js';
import { build } from '#shared/guide/index.js';
import { getJSON } from '#platform/http.js';

/** The browser cache the files live in, apart from the app shell's. */
const CACHE = 'mo-guide';
export const GUIDE_ROLE = 'editor';

/**
 * @typedef {object} Manifest
 * @property {string} release
 * @property {{ path: string, url: string, hash: string, words: number }[]} files
 */
/**
 * @typedef {object} Guide
 * @property {import('#shared/guide/index.js').GuideIndex} index
 * @property {Manifest} manifest
 * @property {number} indexedAt  ms
 * @property {number} fetched  Files fetched this time (the rest came from the device's copy).
 */

/** @type {Promise<Guide> | null} */
let loading = null;
/** @type {Guide | null} */
let current = null;

/** Whether a member may read the guide. @param {{ role: string } | null | undefined} m */
export function readsGuide(m) {
	return Boolean(m && atLeast(/** @type {any} */ (m.role), GUIDE_ROLE));
}

/** The guide as last indexed on this visit, if it is. */
export function guideNow() {
	return current;
}

/**
 * The guide, indexed: the manifest is asked of the server each time (it is
 * small and says what changed); each file comes from the device's copy
 * when its hash is the manifest's, else from the server, and the copy is
 * replaced. One load at a time; `fresh` forgets the copies first.
 * @param {{ fresh?: boolean }} [options]
 * @returns {Promise<Guide>}
 */
export function loadGuide(options = {}) {
	if (loading && !options.fresh) return loading;
	loading = load(Boolean(options.fresh)).then(
		(g) => (current = g),
		(err) => {
			loading = null;
			throw err;
		},
	);
	return loading;
}

/** @param {boolean} fresh */
async function load(fresh) {
	/** @type {Manifest} */
	const manifest = await getJSON('/guide/manifest.json');
	if (!Array.isArray(manifest?.files) || !manifest.release) throw new Error('The guide\'s manifest is not as expected (scripts/build.js, guideFiles).');
	const cache = await openCache();
	if (fresh && cache) for (const req of await cache.keys()) await cache.delete(req);
	let fetched = 0;
	const files = await Promise.all(
		manifest.files.map(async (f) => {
			const key = `${f.url}?h=${f.hash}`;
			const kept = cache ? await cache.match(key) : undefined;
			if (kept) return { file: f.path, text: await kept.text() };
			const res = await fetch(f.url, { credentials: 'same-origin', cache: 'no-cache' });
			if (!res.ok) throw new Error(`The guide's ${f.path} answered ${res.status}: sign in as an editor, or the file is missing from the release.`);
			const text = await res.text();
			fetched++;
			if (cache) {
				// Older copies of the same file go; the new one is kept by its hash.
				for (const req of await cache.keys()) if (new URL(req.url).pathname === f.url) await cache.delete(req);
				await cache.put(key, new Response(text, { headers: { 'content-type': 'text/markdown; charset=utf-8' } }));
			}
			return { file: f.path, text };
		}),
	);
	const index = build(files);
	return { index, manifest, indexedAt: Date.now(), fetched };
}

/** The guide's cache, or null where the browser has none (a private window may throw). */
async function openCache() {
	try {
		return 'caches' in globalThis ? await caches.open(CACHE) : null;
	} catch {
		return null;
	}
}

/** Forgets the device's copies (signing out, or a member no longer an editor). */
export async function forgetGuide() {
	current = null;
	loading = null;
	try {
		if ('caches' in globalThis) await caches.delete(CACHE);
	} catch {
		/* nothing kept */
	}
}

// Signed out, or no longer an editor: the copies go with the right to them.
document.addEventListener('mo:member', (ev) => {
	const m = /** @type {CustomEvent} */ (ev).detail;
	if (!readsGuide(m) && (current || loading)) forgetGuide().catch(() => {});
});
