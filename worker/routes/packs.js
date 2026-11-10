// @ts-check
/**
 * Offline packs of the build this site reads, from R2 (scripts/packs.js
 * makes and uploads them; nothing here touches D1 beyond reading the build).
 *
 *   GET /api/packs        the build, who may download what, and each pack's
 *                         size and rows; per visitor, never cached
 *   GET /api/packs/{id}   one pack's gzip file; word lists for everyone, the
 *                         others by the offline.access setting
 */
import { AppError } from '../../shared/errors.js';
import { buildKey, OPEN_KINDS, PACK_IDS } from '../../shared/packs.js';
import { dictionary, explainDictError } from '../lib/dict.js';
import { json } from '../lib/http.js';
import { currentMember } from '../lib/session.js';
import { getSetting } from '../lib/settings.js';

/**
 * @typedef {import('../lib/dict.js').DictEnv & { APP: D1Database, PACKS?: R2Bucket }} Env
 * @typedef {{ id: string, kind: string, lang: string, file: string, rows: number, bytes: number, sha256: string }} Pack
 */

/**
 * @param {Request} request
 * @param {Env} env
 * @param {string[]} parts
 */
export async function packs(request, env, parts) {
	if (!env.PACKS) throw new AppError('internal', 'The R2 binding PACKS is missing; it is declared in wrangler.toml for each environment.');
	const { build, manifest } = await currentManifest(env);
	const [member, access] = await Promise.all([currentMember(request, env), getSetting(env, 'offline.access')]);
	/** @param {Pack} p */
	const allowed = (p) => OPEN_KINDS.includes(p.kind) || access === 'everyone' || member !== null;

	if (parts.length === 1) {
		return json(
			{ build, access, signedIn: member !== null, packs: manifest.packs.map((p) => ({ id: p.id, kind: p.kind, lang: p.lang, rows: p.rows, bytes: p.bytes, allowed: allowed(p) })) },
			{ headers: { 'cache-control': 'no-store' } },
		);
	}
	const id = parts[1];
	const pack = parts.length === 2 && PACK_IDS.includes(id) ? manifest.packs.find((p) => p.id === id) : undefined;
	if (!pack) throw new AppError('not_found', `No offline pack ${parts.slice(1).join('/')}`);
	if (!allowed(pack)) throw new AppError('unauthorized', 'Sign in to download the definitions for offline use.');
	const object = await env.PACKS.get(`${buildKey(build)}/${pack.file}`);
	if (!object) throw new AppError('unavailable', `The pack ${pack.id} of build ${build} is listed but missing from storage; upload the packs again (make data-packs).`);
	return new Response(object.body, {
		headers: {
			'content-type': 'application/gzip',
			'content-length': String(object.size),
			// The same build always has the same file; a new build has a new manifest.
			'cache-control': OPEN_KINDS.includes(pack.kind) || access === 'everyone' ? 'public, max-age=86400' : 'private, max-age=86400',
			'x-pack-build': build,
			'x-pack-sha256': pack.sha256,
		},
	});
}

/**
 * The build the site reads, and its packs' manifest.
 * @param {Env} env
 * @returns {Promise<{ build: string, manifest: { build: string, packs: Pack[] } }>}
 */
async function currentManifest(env) {
	const { dict, db } = await dictionary(env);
	const row = /** @type {{ value: string } | null} */ (
		await db
			.prepare("SELECT value FROM meta WHERE key = 'built'")
			.first()
			.catch((err) => {
				throw explainDictError(err, dict, env);
			})
	);
	if (!row) throw new AppError('unavailable', 'The dictionary has no build information.');
	const object = await /** @type {R2Bucket} */ (env.PACKS).get(`${buildKey(row.value)}/manifest.json`);
	if (!object) throw new AppError('not_found', `No offline packs for build ${row.value} yet.`);
	const manifest = /** @type {{ build: string, packs: Pack[] }} */ (await object.json());
	if (manifest.build !== row.value) throw new AppError('internal', `The packs under ${buildKey(row.value)} say build ${manifest.build}.`);
	return { build: row.value, manifest };
}
