// @ts-check
/**
 * Searches made on this device, newest first, for the home page. Kept only
 * in this browser (mo:recent) and never sent anywhere; cleared from the home
 * page. Storage may be blocked: then nothing is kept, and the home page shows
 * no recent searches.
 */

const KEY = 'mo:recent';
const MAX = 12;

/** @returns {string[]} */
export function recentSearches() {
	try {
		const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
		return Array.isArray(list) ? list.filter((x) => typeof x === 'string').slice(0, MAX) : [];
	} catch {
		return [];
	}
}

/**
 * Puts a search first, once (case does not make two).
 * @param {string} q
 */
export function addRecent(q) {
	const text = q.trim().replace(/\s+/g, ' ');
	if (!text || text.length > 60) return;
	const list = [text, ...recentSearches().filter((x) => x.toLowerCase() !== text.toLowerCase())].slice(0, MAX);
	try {
		localStorage.setItem(KEY, JSON.stringify(list));
	} catch {
		// storage blocked: nothing kept
	}
}

export function clearRecent() {
	try {
		localStorage.removeItem(KEY);
	} catch {
		// storage blocked: nothing was kept
	}
}
