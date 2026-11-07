// @ts-check
/**
 * Version scheme: yy.mm.dd+changes, e.g. 26.11.7+1.
 * The date part is the day of the change; `changes` is a counter that never
 * resets and grows by one with every change. The counter sits in semver build
 * metadata so npm accepts the version.
 */

const PATTERN = /^(\d{1,2})\.(\d{1,2})\.(\d{1,2})(?:\+(\d+))?$/;

/**
 * @typedef {object} Version
 * @property {number} yy
 * @property {number} mm
 * @property {number} dd
 * @property {number} changes
 */

/**
 * @param {string} text
 * @returns {Version}
 */
export function parseVersion(text) {
	const m = PATTERN.exec(text);
	if (!m) throw new Error(`Version "${text}" does not match yy.mm.dd+changes`);
	return { yy: Number(m[1]), mm: Number(m[2]), dd: Number(m[3]), changes: Number(m[4] ?? 0) };
}

/**
 * @param {Version} v
 */
export function formatVersion(v) {
	return `${v.yy}.${v.mm}.${v.dd}+${v.changes}`;
}

/**
 * The version that follows `previous` for a change made on `date` (UTC day).
 * @param {string} previous
 * @param {Date} date
 */
export function nextVersion(previous, date) {
	const prev = parseVersion(previous);
	return formatVersion({
		yy: date.getUTCFullYear() % 100,
		mm: date.getUTCMonth() + 1,
		dd: date.getUTCDate(),
		changes: prev.changes + 1,
	});
}
