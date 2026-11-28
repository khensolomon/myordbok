// @ts-check
/**
 * The guide: the repository's docs/, shipped with the web build under
 * /guide/ (scripts/build.js, guideFiles) and read by the workspace's Guide
 * (app/workspace/guide.js), which indexes and answers on the device
 * (shared/guide/). The files are for editors and up: anyone else gets the
 * same 404 as for a file that is not there.
 */
import { atLeast } from '../../shared/roles.js';
import { currentMember } from '../lib/session.js';

/** The role the guide is written for. */
export const GUIDE_ROLE = 'editor';

/**
 * @param {Request} request
 * @param {{ APP: D1Database, ASSETS: Fetcher }} env
 */
export async function guideFile(request, env) {
	const member = await currentMember(request, env);
	if (!member || !atLeast(member.role, GUIDE_ROLE)) return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
	const res = await env.ASSETS.fetch(request);
	// A member's copy is theirs alone: no shared cache keeps it.
	const headers = new Headers(res.headers);
	headers.set('cache-control', 'private, no-cache');
	headers.set('vary', 'Cookie');
	return new Response(res.body, { status: res.status, headers });
}
