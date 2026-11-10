// @ts-check
/**
 * Site settings admins change in the workspace (table settings, migration
 * 0005). Each known key has a default and a check; a key not listed here is
 * refused, and a stored value that no longer passes its check is an error,
 * not a quiet return to the default.
 */
import { ACCESS } from '../../shared/packs.js';
import { AppError } from '../../shared/errors.js';

/** @type {Record<string, { fallback: unknown, valid: (v: unknown) => boolean, about: string }>} */
export const SETTINGS = {
	'offline.access': {
		fallback: 'members',
		valid: (v) => typeof v === 'string' && /** @type {readonly string[]} */ (ACCESS).includes(v),
		about: 'Who may download the offline definitions and related words: members or everyone. Word lists are open to all.',
	},
};

/**
 * @param {{ APP: D1Database }} env
 * @param {string} key
 */
export async function getSetting(env, key) {
	const known = SETTINGS[key];
	if (!known) throw new AppError('internal', `No setting ${key}`);
	const row = /** @type {{ value: string } | null} */ (await env.APP.prepare('SELECT value FROM settings WHERE key = ?1').bind(key).first());
	if (!row) return known.fallback;
	const value = JSON.parse(row.value);
	if (!known.valid(value)) throw new AppError('internal', `Setting ${key} holds ${row.value}, which is no longer allowed; set it again in the workspace.`);
	return value;
}

/**
 * Every setting with its value, for the workspace.
 * @param {{ APP: D1Database }} env
 */
export async function allSettings(env) {
	const { results } = await env.APP.prepare('SELECT key, value, updated_at, updated_by FROM settings').all();
	const stored = new Map(results.map((r) => [String(r.key), r]));
	return Object.entries(SETTINGS).map(([key, s]) => {
		const row = stored.get(key);
		return { key, value: row ? JSON.parse(String(row.value)) : s.fallback, about: s.about, updated_at: row ? Number(row.updated_at) : null };
	});
}

/**
 * @param {{ APP: D1Database }} env
 * @param {string} key
 * @param {unknown} value
 * @param {number} by  The admin's id.
 */
export async function setSetting(env, key, value, by) {
	const known = SETTINGS[key];
	if (!known) throw new AppError('bad_request', `No setting ${key}`);
	if (!known.valid(value)) throw new AppError('bad_request', `${JSON.stringify(value)} is not allowed for ${key}`);
	await env.APP.prepare(
		`INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?1, ?2, unixepoch(), ?3)
		 ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
	)
		.bind(key, JSON.stringify(value), by)
		.run();
}
