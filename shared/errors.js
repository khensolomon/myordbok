// @ts-check
/**
 * Errors shared by the app and the worker.
 * Every failure carries a stable `code` so clients can react to it without
 * parsing messages. No error is ever swallowed silently.
 */

/** @typedef {'bad_request' | 'unauthorized' | 'forbidden' | 'not_found' | 'conflict' | 'rate_limited' | 'not_implemented' | 'unavailable' | 'internal'} ErrorCode */

/** @type {Record<ErrorCode, number>} */
export const STATUS = Object.freeze({
	bad_request: 400,
	unauthorized: 401,
	forbidden: 403,
	not_found: 404,
	conflict: 409,
	rate_limited: 429,
	not_implemented: 501,
	unavailable: 503,
	internal: 500,
});

export class AppError extends Error {
	/**
	 * @param {ErrorCode} code
	 * @param {string} message
	 */
	constructor(code, message) {
		super(message);
		this.name = 'AppError';
		/** @type {ErrorCode} */
		this.code = code;
		this.status = STATUS[code];
	}

	toJSON() {
		return { error: { code: this.code, message: this.message } };
	}
}
