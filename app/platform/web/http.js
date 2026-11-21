// @ts-check
/**
 * Web adapter: HTTP. The page and the API share one origin, so every path is
 * fetched as it is, with the session cookie. The Tauri adapter exports the
 * same functions.
 */
import { answerOf, unreachable } from '../../core/answer.js';

/**
 * A request as it is answered, for what is not JSON (an offline pack, a
 * CSV); a connection that fails becomes `unavailable`.
 * @param {string} path  A same-origin path, e.g. "/api/packs/en-1".
 * @param {RequestInit} [init]
 * @returns {Promise<Response>}
 */
export async function request(path, init = {}) {
	try {
		return await fetch(path, { credentials: 'same-origin', ...init });
	} catch {
		throw unreachable();
	}
}

/**
 * @param {string} path  Same-origin API path, e.g. "/api/lookup?q=love".
 * @returns {Promise<any>}
 */
export async function getJSON(path) {
	return answerOf(await request(path, { headers: { accept: 'application/json' } }), path);
}

/**
 * A same-origin POST with an optional JSON body; the answer as getJSON gives
 * it, or null when it has no body.
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

/**
 * An address an <audio> element can play: on the web the path itself, which
 * the browser streams.
 * @param {string} path
 * @returns {Promise<string>}
 */
export async function mediaUrl(path) {
	return path;
}
