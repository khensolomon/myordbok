// @ts-check
/**
 * Usage counters (assets/db/migrations/0009_usage_counts.sql): numbers per
 * day and name, never who. Written by the offline check-in and by pack
 * downloads; read by the workspace Overview.
 */
import { AppError } from '../../shared/errors.js';
import { PACK_IDS } from '../../shared/packs.js';
import { json } from './http.js';

/** Packs a check-in may name: those holding definitions, not the word lists. */
const KEPT = PACK_IDS.filter((id) => !id.startsWith('words-'));
/** Most offline lookups one check-in may report (a day or more of use). */
export const LOOKUPS_MAX = 5000;

/**
 * Adds to counters of today, in one batch.
 * @param {{ APP: D1Database }} env
 * @param {Record<string, number>} counts  name → amount; zero amounts are skipped
 */
export async function addUsage(env, counts) {
	const day = new Date().toISOString().slice(0, 10);
	const sql = 'INSERT INTO usage_counts (day, name, n) VALUES (?1, ?2, ?3) ON CONFLICT (day, name) DO UPDATE SET n = n + excluded.n';
	const rows = Object.entries(counts).filter(([, n]) => n > 0);
	if (rows.length) await env.APP.batch(rows.map(([name, n]) => env.APP.prepare(sql).bind(day, name, n)));
}

/**
 * POST /api/usage: a device's daily check-in. Body { packs, lookups }: the
 * definition packs it keeps, and how many words it answered offline since
 * its last check-in. Nothing identifies the device.
 * @param {Request} request
 * @param {{ APP: D1Database }} env
 */
export async function reportUsage(request, env) {
	const body = /** @type {{ packs?: unknown, lookups?: unknown } | null} */ (await request.json().catch(() => null));
	if (!body || typeof body !== 'object') throw new AppError('bad_request', 'Send the check-in as an object');
	const packs = body.packs ?? [];
	if (!Array.isArray(packs) || packs.some((p) => !KEPT.includes(p)) || new Set(packs).size !== packs.length) {
		throw new AppError('bad_request', `packs must list each of ${KEPT.join(', ')} at most once`);
	}
	const lookups = body.lookups ?? 0;
	if (!Number.isInteger(lookups) || /** @type {number} */ (lookups) < 0 || /** @type {number} */ (lookups) > LOOKUPS_MAX) {
		throw new AppError('bad_request', `lookups must be a whole number from 0 to ${LOOKUPS_MAX}`);
	}
	/** @type {Record<string, number>} */
	const counts = { 'offline.lookups': /** @type {number} */ (lookups) };
	if (packs.length) counts['offline.devices'] = 1;
	for (const p of packs) counts[`offline.devices.${p}`] = 1;
	await addUsage(env, counts);
	return json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
}
