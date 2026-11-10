// @ts-check
/**
 * Web adapter: HTTP. The Tauri adapter exports the same functions.
 * Server errors arrive as `{ error: { code, message } }` and are rethrown as
 * AppError; a failed connection becomes `unavailable`.
 */
import { AppError } from '#shared/errors.js';
import { errorText } from '../../i18n/index.js';

/**
 * @param {string} path  Same-origin API path, e.g. "/api/lookup?q=love".
 * @returns {Promise<any>}
 */
export async function getJSON(path) {
	let res;
	try {
		res = await fetch(path, { headers: { accept: 'application/json' }, credentials: 'same-origin' });
	} catch {
		throw new AppError('unavailable', errorText('unavailable', 'Could not reach MyOrdbok. Check the connection.'));
	}
	const body = await res.json().catch(() => null);
	if (!res.ok) {
		const err = body?.error;
		if (err?.code && err?.message) throw new AppError(err.code, errorText(err.code, err.message));
		throw new AppError('internal', `Request to ${path} failed with status ${res.status}`);
	}
	if (body === null) throw new AppError('internal', `Response from ${path} was not JSON`);
	return body;
}

/**
 * A same-origin POST with an optional JSON body; the answer as getJSON gives it.
 * @param {string} path
 * @param {unknown} [data]
 * @returns {Promise<any>}
 */
export async function postJSON(path, data) {
	let res;
	try {
		res = await fetch(path, {
			method: 'POST',
			headers: { accept: 'application/json', ...(data === undefined ? {} : { 'content-type': 'application/json' }) },
			body: data === undefined ? undefined : JSON.stringify(data),
			credentials: 'same-origin',
		});
	} catch {
		throw new AppError('unavailable', errorText('unavailable', 'Could not reach MyOrdbok. Check the connection.'));
	}
	const body = await res.json().catch(() => null);
	if (!res.ok) {
		const err = body?.error;
		if (err?.code && err?.message) throw new AppError(err.code, errorText(err.code, err.message));
		throw new AppError('internal', `Request to ${path} failed with status ${res.status}`);
	}
	return body;
}
