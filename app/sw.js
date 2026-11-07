// Service worker for the web build only (Tauri WebViews do not support it).
// scripts/build.js fills VERSION and PRECACHE; the source values are inert.
//
// - App shell (hashed files): cache first, so the app opens offline.
// - Navigations: network first, falling back to the cached index.html, so
//   deep links such as /definition?q=love still open offline.
// - /api: always network. Offline dictionary data comes from packs stored
//   by the app, not from this cache.

const VERSION = 'dev';
/** @type {string[]} */
const PRECACHE = [];
const CACHE = `shell-${VERSION}`;

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['/', ...PRECACHE])));
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys()
			.then((keys) => Promise.all(keys.filter((k) => k.startsWith('shell-') && k !== CACHE).map((k) => caches.delete(k))))
			.then(() => self.clients.claim()),
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);
	if (request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;

	if (request.mode === 'navigate') {
		event.respondWith(fetch(request).catch(() => caches.match('/', { cacheName: CACHE }).then((r) => r ?? Response.error())));
		return;
	}
	event.respondWith(caches.match(request, { cacheName: CACHE }).then((hit) => hit ?? fetch(request)));
});
