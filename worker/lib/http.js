// @ts-check
/**
 * Response helpers. Every error leaves as JSON with a stable code;
 * unexpected errors are logged and reported as `internal`.
 */
import { AppError } from '../../shared/errors.js';

/**
 * @param {unknown} data
 * @param {ResponseInit & { cache?: number }} [init]  `cache` is a public max-age in seconds.
 */
export function json(data, init = {}) {
	const { cache, ...rest } = init;
	const headers = new Headers(rest.headers);
	headers.set('content-type', 'application/json; charset=utf-8');
	if (cache !== undefined) headers.set('cache-control', `public, max-age=${cache}`);
	return new Response(JSON.stringify(data), { ...rest, headers });
}

/**
 * @param {unknown} err
 */
export function errorResponse(err) {
	if (err instanceof AppError) return json(err.toJSON(), { status: err.status });
	console.error(err);
	return json(new AppError('internal', 'Something went wrong on the server').toJSON(), { status: 500 });
}
