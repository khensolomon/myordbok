// Service worker for the web build only (Tauri WebViews do not support it).
// scripts/build.js fills VERSION and PRECACHE; the source values are inert.
//
// - App shell (hashed files): cache first, so the app opens offline.
// - Navigations: network first, falling back to the cached index.html, so
//   deep links such as /definition?q=love still open offline.
// - /api: always network. Offline dictionary data comes from packs stored
//   by the app, not from this cache.
//
// A release brings a new worker, which takes over open pages at once. The
// shell of the release before stays cached beside the new one: a page opened
// before the release goes on asking for its own files, which the server no
// longer has. Older shells are deleted.

const VERSION = 'dev';
/** @type {string[]} */
const PRECACHE = [];
const CACHE = `shell-${VERSION}`;
/** Shells kept: this release's and the one before. */
const KEEP = 2;

/**
 * Whether a response is the file asked for: a success, and not a page
 * standing in for a file (the server's single-page fallback).
 * @param {string} url
 * @param {Response} res
 */
function isFile(url, res) {
	if (!res.ok) return false;
	const { pathname } = new URL(url, location.origin);
	const page = pathname === '/' || pathname.endsWith('.html');
	return page || !(res.headers.get('content-type') ?? '').startsWith('text/html');
}

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE).then((cache) =>
			Promise.all(
				['/', ...PRECACHE].map(async (url) => {
					// Past the browser's HTTP cache: an earlier answer for the same name may be stale.
					const res = await fetch(new Request(url, { cache: 'no-cache' }));
					if (!isFile(url, res)) throw new Error(`Precache: ${url} answered ${res.status} ${res.headers.get('content-type') ?? ''}`);
					await cache.put(url, res);
				}),
			),
		).catch(async (err) => {
			// A shell missing a file is no shell: the next check tries again.
			await caches.delete(CACHE);
			throw err;
		}),
	);
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys()
			.then((keys) => {
				// Oldest first: the newest of the others is the release before.
				const others = keys.filter((k) => k.startsWith('shell-') && k !== CACHE);
				return Promise.all(others.slice(0, Math.max(0, others.length - (KEEP - 1))).map((k) => caches.delete(k)));
			})
			.then(() => self.clients.claim()),
	);
});

/**
 * A cached copy: this release's shell first, then the one before.
 * @param {Request} request
 */
async function cached(request) {
	const keys = (await caches.keys()).filter((k) => k.startsWith('shell-') && k !== CACHE).reverse();
	for (const name of [CACHE, ...keys]) {
		const hit = await caches.match(request, { cacheName: name });
		if (hit && isFile(request.url, hit)) return hit;
	}
	return undefined;
}

self.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);
	if (request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;

	if (request.mode === 'navigate') {
		event.respondWith(fetch(request).catch(() => caches.match('/', { cacheName: CACHE }).then((r) => r ?? Response.error())));
		return;
	}
	event.respondWith(cached(request).then((hit) => hit ?? fetch(request)));
});
