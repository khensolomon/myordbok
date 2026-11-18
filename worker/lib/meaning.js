// @ts-check
/**
 * What a rating of a sense is given for (sense_reactions.text_hash): the
 * sense's glosses. Its notes (labels, cross-references, origin), the sense
 * explained in English and how the items are separated are not the meaning,
 * so a change to them keeps the ratings; a changed gloss starts with none.
 *
 * The glosses are joined with "; ", as they were before the dataset parted
 * items with " | " (and before labels and origin of a Myanmar sense moved
 * into it as notes), so a meaning whose glosses did not change keeps the
 * ratings given before.
 */
import { glossesOf } from '../../shared/markup.js';

/**
 * @param {string | null | undefined} sense  As readers see it: the build with the live edits over it.
 * @returns {Promise<string>}  SHA-256, hex.
 */
export async function meaningHash(sense) {
	const meaning = glossesOf(sense).join('; ').normalize('NFC');
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(meaning));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
