// @ts-check
/**
 * Web adapter: HTTP. The Tauri adapter exports the same functions.
 * Server errors arrive as `{ error: { code, message } }` and are rethrown as
 * AppError; a failed connection becomes `unavailable`.
 */
import { AppError } from '#shared/errors.js';

/**
 * @param {string} path  Same-origin API path, e.g. "/api/search?q=love".
 * @returns {Promise<any>}
 */
export async function getJSON(path) {
	let res;
	try {
		res = await fetch(path, { headers: { accept: 'application/json' }, credentials: 'same-origin' });
	} catch {
		throw new AppError('unavailable', 'Could not reach MyOrdbok. Check the connection.');
	}
	const body = await res.json().catch(() => null);
	if (!res.ok) {
		const err = body?.error;
		if (err?.code && err?.message) throw new AppError(err.code, err.message);
		throw new AppError('internal', `Request to ${path} failed with status ${res.status}`);
	}
	if (body === null) throw new AppError('internal', `Response from ${path} was not JSON`);
	return body;
}
