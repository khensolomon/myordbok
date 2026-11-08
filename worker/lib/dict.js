// @ts-check
/**
 * Which dictionary database a request reads.
 *
 * The dictionary lives in two slots, DICT_A and DICT_B. A data release is
 * imported into the slot that no site reads, checked, then switched to by
 * writing dict_release in the app database (scripts/data.js). DICT_SLOT, when
 * set, overrides dict_release; local development sets it to "a".
 *
 * The slot is cached for a short time per isolate, so a switch reaches every
 * visitor within SLOT_TTL_MS without a D1 read on every lookup.
 */
import { AppError } from '../../shared/errors.js';

export const SLOT_TTL_MS = 30_000;

/** @type {{ key: string, slot: 'a' | 'b', at: number } | null} */
let cached = null;

/** Forget the cached slot (tests). */
export function resetSlotCache() {
	cached = null;
}

/**
 * @typedef {object} DictEnv
 * @property {D1Database} DB
 * @property {D1Database} [DICT_A]
 * @property {D1Database} [DICT_B]
 * @property {string} [DICT_SLOT]  "a" or "b" to pin a slot; empty to use dict_release.
 * @property {string} [ENV_NAME]   "beta" or "production".
 */

/**
 * @param {DictEnv} env
 * @param {number} [now]
 * @returns {Promise<'a' | 'b'>}
 */
export async function activeSlot(env, now = Date.now()) {
	const pinned = env.DICT_SLOT;
	if (pinned) {
		if (pinned !== 'a' && pinned !== 'b') throw new AppError('internal', `DICT_SLOT is "${pinned}", expected "a" or "b"`);
		return pinned;
	}
	const name = env.ENV_NAME;
	if (!name) throw new AppError('internal', 'Neither DICT_SLOT nor ENV_NAME is set; see wrangler.toml');
	if (cached && cached.key === name && now - cached.at < SLOT_TTL_MS) return cached.slot;

	const row = await env.DB.prepare('SELECT slot FROM dict_release WHERE env = ?1').bind(name).first();
	if (!row) throw new AppError('unavailable', `No dictionary has been published for ${name}; run make data-publish`);
	const slot = row.slot === 'b' ? 'b' : 'a';
	cached = { key: name, slot, at: now };
	return slot;
}

/**
 * @param {DictEnv} env
 * @returns {Promise<{ slot: 'a' | 'b', db: D1Database }>}
 */
export async function dictionary(env) {
	const slot = await activeSlot(env);
	const db = slot === 'a' ? env.DICT_A : env.DICT_B;
	if (!db) throw new AppError('internal', `The DICT_${slot.toUpperCase()} binding is missing; see wrangler.toml`);
	return { slot, db };
}
