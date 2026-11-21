// @ts-check
/**
 * Reading an API answer, the same for every platform adapter
 * (app/platform/*\/http.js): a body of JSON, or the server's error
 * `{ error: { code, message } }` rethrown as AppError in the reader's
 * language.
 */
import { AppError } from '#shared/errors.js';
import { errorText } from '../i18n/index.js';

/** The error a request that never reached the server becomes. */
export function unreachable() {
	return new AppError('unavailable', errorText('unavailable', 'Could not reach MyOrdbok. Check the connection.'));
}

/**
 * The JSON body of a successful answer; the server's error otherwise.
 * @param {Response} res
 * @param {string} path  For the message when the answer is no JSON.
 * @param {{ empty?: boolean }} [options]  `empty`: a success without a body is null, not an error.
 * @returns {Promise<any>}
 */
export async function answerOf(res, path, { empty = false } = {}) {
	const body = await res.json().catch(() => null);
	if (!res.ok) throw failure(res, path, body);
	if (body === null && !empty) throw new AppError('internal', `Response from ${path} was not JSON`);
	return body;
}

/**
 * The server's error for an answer that is not a success.
 * @param {Response} res
 * @param {string} path
 * @param {any} [body]  The answer already read as JSON, when it was.
 */
export function failure(res, path, body = null) {
	const err = body?.error;
	if (err?.code && err?.message) return new AppError(err.code, errorText(err.code, err.message));
	return new AppError('internal', `Request to ${path} failed with status ${res.status}`);
}
