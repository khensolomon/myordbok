// @ts-check
/**
 * Offline packs, as the pack script (scripts/packs.js), the Worker
 * (worker/routes/packs.js) and the app (app/data/offline.js) name them.
 */

/** Pack ids, in the order they are offered. */
export const PACK_IDS = Object.freeze(['words-en', 'words-my', 'senses-en', 'senses-my', 'related-en']);

/** Kinds every reader may download; the others follow the site's offline access setting. */
export const OPEN_KINDS = Object.freeze(['words']);

/** Who may download the senses and related packs (setting offline.access). */
export const ACCESS = Object.freeze(['members', 'everyone']);

/**
 * A build's folder in R2: its "built" value with anything but letters,
 * digits and hyphens made a hyphen ("2026-11-09 19:07 UTC" → "2026-11-09-19-07-UTC").
 * @param {string} built
 */
export function buildKey(built) {
	return built.trim().replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-|-$/g, '');
}
