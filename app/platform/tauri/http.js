// @ts-check
/**
 * Tauri adapter: HTTP. The app's pages are files inside the app, so a path
 * under /api/ goes to the server named at build time (<meta name="mo-api">),
 * through the HTTP plugin (tauri-plugin-http, made by Rust, so no CORS), with
 * the header that lets the server tell the app from a script
 * (worker/lib/guard.js). Any other path is a file of the app.
 *
 * The app sends no session cookie: it is used signed out, and signing in
 * opens the website (platform/tauri/boot.js).
 */
import { answerOf, unreachable } from '../../core/answer.js';
import { AppError } from '#shared/errors.js';

/** The server, "https://myordbok.com"; written by the build (scripts/build.js --api). */
const API = globalThis.document?.querySelector('meta[name="mo-api"]')?.getAttribute('content') ?? '';
/** The app's version, "26.11.21+161"; written by the build. */
const VERSION = globalThis.document?.querySelector('meta[name="mo-version"]')?.getAttribute('content') ?? '';
/** What the app names itself as to the server: "android/26.11.21+161". */
const APP = `${platformOf(globalThis.navigator?.userAgent ?? '')}/${VERSION}`;

/**
 * The platform the app runs on, from the web view's user agent.
 * @param {string} agent
 * @returns {'ios' | 'android' | 'desktop'}
 */
function platformOf(agent) {
	return /iPhone|iPad|iPod/.test(agent) ? 'ios' : /Android/.test(agent) ? 'android' : 'desktop';
}

/** The plugin's fetch; a build without it cannot reach the server at all. */
function nativeFetch() {
	/** @type {typeof fetch | undefined} */
	const f = /** @type {any} */ (window).__TAURI__?.http?.fetch;
	if (!API || !VERSION) throw new AppError('internal', 'The app was built without its server or version (scripts/build.js --target tauri --api …).');
	if (!f) throw new AppError('internal', 'The HTTP plugin is missing: tauri-plugin-http, with app.withGlobalTauri in tauri.conf.json.');
	return f;
}

/**
 * A request as it is answered, for what is not JSON (an offline pack); a
 * connection that fails becomes `unavailable`.
 * @param {string} path  "/api/…" for the server, anything else for a file of the app.
 * @param {RequestInit} [init]
 * @returns {Promise<Response>}
 */
export async function request(path, init = {}) {
	if (!path.startsWith('/api/')) return fetch(path, init);
	const send = nativeFetch();
	try {
		return await send(`${API}${path}`, { ...init, headers: { ...Object.fromEntries(new Headers(init.headers).entries()), 'x-myordbok-app': APP } });
	} catch {
		throw unreachable();
	}
}

/**
 * @param {string} path
 * @returns {Promise<any>}
 */
export async function getJSON(path) {
	return answerOf(await request(path, { headers: { accept: 'application/json' } }), path);
}

/**
 * A POST with an optional JSON body; the answer as getJSON gives it, or null
 * when it has no body.
 * @param {string} path
 * @param {unknown} [data]
 * @returns {Promise<any>}
 */
export async function postJSON(path, data) {
	const res = await request(path, {
		method: 'POST',
		headers: { accept: 'application/json', ...(data === undefined ? {} : { 'content-type': 'application/json' }) },
		body: data === undefined ? undefined : JSON.stringify(data),
	});
	return answerOf(res, path, { empty: true });
}

/** Sounds already fetched, by path: a word heard again plays at once. */
const media = new Map();
/** Sounds kept at most; the oldest is let go. */
const MEDIA_KEPT = 40;

/**
 * An address an <audio> element can play: the sound fetched with the app's
 * header (an <audio> element cannot send one) and kept as a blob.
 * @param {string} path
 * @returns {Promise<string>}
 */
export async function mediaUrl(path) {
	const kept = media.get(path);
	if (kept) return kept;
	const res = await request(path);
	if (!res.ok) throw await answerOf(res, path).catch((err) => err);
	const url = URL.createObjectURL(await res.blob());
	media.set(path, url);
	if (media.size > MEDIA_KEPT) {
		const [oldest, old] = /** @type {[string, string]} */ (media.entries().next().value);
		media.delete(oldest);
		URL.revokeObjectURL(old);
	}
	return url;
}
