// @ts-check
/**
 * Site settings admins change in the workspace (table settings, migration
 * 0005). Each known key has a default and a check; a key not listed here is
 * refused, and a stored value that no longer passes its check is an error,
 * not a quiet return to the default.
 */
import { ACCESS } from '../../shared/packs.js';
import { AppError } from '../../shared/errors.js';

const onOff = (/** @type {unknown} */ v) => v === 'on' || v === 'off';
/** @param {number} min @param {number} max */
const whole = (min, max) => (/** @type {unknown} */ v) => Number.isInteger(v) && /** @type {number} */ (v) >= min && /** @type {number} */ (v) <= max;

/**
 * Every setting: its default, its check, and what it does. Start, stop and
 * pause switches, and a few numbers, all read when they are used, so a
 * change takes effect at once, without a release.
 * @type {Record<string, { fallback: unknown, valid: (v: unknown) => boolean, about: string }>}
 */
export const SETTINGS = {
	'site.readonly': {
		fallback: 'off',
		valid: onOff,
		about: 'Read-only: every write but signing in and this setting is refused (ratings, suggestions, comments, messages, reviews); reading and searching go on.',
	},
	'signup.open': { fallback: 'on', valid: onOff, about: 'Whether a sign-in may create a new account. Members who have one still sign in.' },
	'comments.open': { fallback: 'on', valid: (v) => v === 'on' || v === 'off' || v === 'hidden', about: 'Comments on entries: on, closed to new ones (off), or hidden from entries altogether (hidden).' },
	'comments.daily': { fallback: 30, valid: whole(1, 500), about: 'Most comments one member posts in a day.' },
	'comments.newcomer': { fallback: 3, valid: whole(0, 100), about: 'Most comments an account posts on its first day; 0: none until a day has passed.' },
	'suggestions.open': { fallback: 'on', valid: onOff, about: 'Whether members may suggest changes to entries.' },
	'ratings.open': { fallback: 'on', valid: onOff, about: 'Whether readers may rate entries and meanings; off hides the thumbs.' },
	'contact.open': { fallback: 'on', valid: onOff, about: 'Whether the contact form takes messages.' },
	'searches.count': { fallback: 'on', valid: onOff, about: 'Whether search pages are counted (search_counts).' },
	'searches.keep_days': { fallback: 0, valid: (v) => v === 0 || whole(30, 36500)(v), about: 'Search counts older than this many days are deleted as new ones come in; 0 keeps them all.' },
	'home.popular': { fallback: 'on', valid: onOff, about: 'Whether the home page lists the words searched most this week.' },
	'home.popular_min': { fallback: 3, valid: whole(1, 1000), about: 'Searches a word needs in a week before the home page lists it.' },
	'offline.access': {
		fallback: 'members',
		valid: (v) => typeof v === 'string' && /** @type {readonly string[]} */ (ACCESS).includes(v),
		about: 'Who may download the offline definitions and related words: members or everyone. Word lists are open to all.',
	},
	'offline.daily': { fallback: 6, valid: whole(1, 100), about: 'Most downloads of the offline definitions one member makes in a day.' },
	'support.ask': { fallback: 'on', valid: onOff, about: 'Whether pages invite readers to support MyOrdbok (a line on the home page). The Support page and its link stay either way; members who support it never see an invitation.' },
	'offline.words_auto': { fallback: 'on', valid: onOff, about: 'Whether the word lists download by themselves after a first visit.' },
};

/**
 * Several settings in one read.
 * @template {string} K
 * @param {{ APP: D1Database }} env
 * @param {readonly K[]} keys
 * @returns {Promise<Record<K, any>>}
 */
export async function getSettings(env, keys) {
	for (const k of keys) if (!SETTINGS[k]) throw new AppError('internal', `No setting ${k}`);
	const { results } = await env.APP.prepare('SELECT key, value FROM settings WHERE key IN (SELECT value FROM json_each(?1))').bind(JSON.stringify(keys)).all();
	const stored = new Map(results.map((r) => [String(r.key), String(r.value)]));
	/** @type {Record<string, unknown>} */
	const out = {};
	for (const k of keys) {
		const raw = stored.get(k);
		if (raw === undefined) {
			out[k] = SETTINGS[k].fallback;
			continue;
		}
		const value = JSON.parse(raw);
		if (!SETTINGS[k].valid(value)) throw new AppError('internal', `Setting ${k} holds ${raw}, which is no longer allowed; set it again in the workspace.`);
		out[k] = value;
	}
	return /** @type {Record<K, any>} */ (out);
}

/**
 * Refuses a write while a switch is off.
 * @param {{ APP: D1Database }} env
 * @param {string} key  An on/off setting.
 * @param {string} message  Said when it is off.
 */
export async function requireOn(env, key, message) {
	if ((await getSetting(env, key)) !== 'on') throw new AppError('forbidden', message);
}

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
		return { key, value: row ? JSON.parse(String(row.value)) : s.fallback, fallback: s.fallback, about: s.about, updated_at: row ? Number(row.updated_at) : null };
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
