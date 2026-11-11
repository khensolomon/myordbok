// @ts-check
/**
 * Site notices: when one is in effect, who sees it, and what a valid one is.
 * Shared by the Worker (which serves the notices in effect) and the
 * workspace (which shows each notice's state while it is edited).
 *
 * Times are Unix seconds. starts_at and ends_at are what the notice is about
 * (a maintenance window, a day); it shows from announce_at, or from starts_at
 * without one, until ends_at. A yearly notice repeats every year on the same
 * calendar days (UTC); a date on 29 February falls on 1 March in other years.
 */
import { AppError } from './errors.js';
import { atLeast } from './roles.js';

/** @typedef {'maintenance' | 'info' | 'celebration'} NoticeKind */
/** @typedef {'everyone' | 'member' | 'editor'} Audience */
/**
 * @typedef {object} NoticeTimes
 * @property {number | null} [announce_at]
 * @property {number} starts_at
 * @property {number} ends_at
 * @property {0 | 1 | boolean} yearly
 */

/** @type {readonly NoticeKind[]} */
export const KINDS = Object.freeze(['maintenance', 'info', 'celebration']);
/** @type {readonly Audience[]} */
export const AUDIENCES = Object.freeze(['everyone', 'member', 'editor']);
export const TEXT_MAX = 280;
export const LINK_MAX = 300;
/** A yearly window may not be longer than this, or it would overlap itself. */
const YEAR_SECONDS = 365 * 86400;

/**
 * The notice's window moved by whole years.
 * @param {number} at
 * @param {number} years
 */
function shift(at, years) {
	if (!years) return at;
	const d = new Date(at * 1000);
	d.setUTCFullYear(d.getUTCFullYear() + years);
	return Math.floor(d.getTime() / 1000);
}

/**
 * @typedef {object} Showing
 * @property {number} shows   From when it shows.
 * @property {number} starts  What it is about, from…
 * @property {number} ends    …until; it shows until then too.
 */

/**
 * The occurrence showing at `now`, or the next one; null once a one-off
 * notice has ended.
 * @param {NoticeTimes} n
 * @param {number} now
 * @returns {Showing | null}
 */
export function nextShowing(n, now) {
	const at = (/** @type {number} */ k) => ({ shows: shift(n.announce_at ?? n.starts_at, k), starts: shift(n.starts_at, k), ends: shift(n.ends_at, k) });
	if (!n.yearly) return n.ends_at > now ? at(0) : null;
	const first = new Date((n.announce_at ?? n.starts_at) * 1000).getUTCFullYear();
	const year = new Date(now * 1000).getUTCFullYear();
	// The occurrence of last year may still run (30 Dec – 2 Jan).
	for (let k = Math.max(0, year - first - 1); k <= year - first + 1; k++) {
		const o = at(k);
		if (o.ends > now) return o;
	}
	return null;
}

/**
 * The occurrence showing at `now`, or null.
 * @param {NoticeTimes} n
 * @param {number} now
 */
export function showingNow(n, now) {
	const o = nextShowing(n, now);
	return o && o.shows <= now ? o : null;
}

/**
 * Whether a visitor with this role sees a notice for this audience.
 * @param {Audience} audience
 * @param {import('./roles.js').Role | null} role  null when not signed in.
 */
export function seenBy(audience, role) {
	if (audience === 'everyone') return true;
	if (!role) return false;
	return audience === 'member' || atLeast(role, 'editor');
}

/**
 * A notice as sent by the workspace, checked and tidied; throws bad_request
 * with the reason.
 * @param {unknown} input
 * @returns {{ kind: NoticeKind, text_en: string | null, text_my: string | null, link: string | null, audience: Audience, announce_at: number | null, starts_at: number, ends_at: number, yearly: 0 | 1 }}
 */
export function checkNotice(input) {
	if (!input || typeof input !== 'object') throw new AppError('bad_request', 'Send the notice as an object');
	const o = /** @type {Record<string, unknown>} */ (input);
	const kind = /** @type {NoticeKind} */ (o.kind);
	if (!KINDS.includes(kind)) throw new AppError('bad_request', `kind must be one of ${KINDS.join(', ')}`);
	const audience = /** @type {Audience} */ (o.audience ?? 'everyone');
	if (!AUDIENCES.includes(audience)) throw new AppError('bad_request', `audience must be one of ${AUDIENCES.join(', ')}`);
	const text_en = text(o.text_en, 'text_en');
	const text_my = text(o.text_my, 'text_my');
	if (!text_en && !text_my) throw new AppError('bad_request', 'Write the notice in English, Myanmar or both');
	let link = null;
	if (o.link !== undefined && o.link !== null && String(o.link).trim() !== '') {
		link = String(o.link).trim();
		if (link.length > LINK_MAX) throw new AppError('bad_request', `link is longer than ${LINK_MAX} characters`);
		if (!/^https:\/\/[^\s]+$/.test(link) && !/^\/(?!\/)[^\s]*$/.test(link)) throw new AppError('bad_request', 'link must start with https:// or be a path on this site such as /about');
	}
	const starts_at = Number(o.starts_at);
	const ends_at = Number(o.ends_at);
	if (!Number.isInteger(starts_at) || !Number.isInteger(ends_at) || starts_at <= 0) throw new AppError('bad_request', 'starts_at and ends_at must be Unix seconds');
	if (ends_at <= starts_at) throw new AppError('bad_request', 'The notice must end after it starts');
	let announce_at = null;
	if (o.announce_at !== undefined && o.announce_at !== null && o.announce_at !== '') {
		announce_at = Number(o.announce_at);
		if (!Number.isInteger(announce_at) || announce_at <= 0) throw new AppError('bad_request', 'announce_at must be Unix seconds');
		if (announce_at > starts_at) throw new AppError('bad_request', 'A notice is announced before it starts, not after');
		if (announce_at === starts_at) announce_at = null;
	}
	const yearly = o.yearly === true || o.yearly === 1 ? 1 : 0;
	if (yearly && ends_at - (announce_at ?? starts_at) >= YEAR_SECONDS) throw new AppError('bad_request', 'A yearly notice must last less than a year, announcement included');
	return { kind, text_en, text_my, link, audience, announce_at, starts_at, ends_at, yearly };
}

/**
 * @param {unknown} value
 * @param {string} name
 */
function text(value, name) {
	if (value === undefined || value === null) return null;
	if (typeof value !== 'string') throw new AppError('bad_request', `${name} must be text`);
	const s = value.trim().replace(/\s+/g, ' ');
	if (!s) return null;
	if (s.length > TEXT_MAX) throw new AppError('bad_request', `${name} is longer than ${TEXT_MAX} characters`);
	return s;
}
