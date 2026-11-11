// @ts-check
/**
 * Membership levels and what each one may do. Each level includes the ones
 * below it: member < editor < admin < owner.
 *
 *   member   rates, suggests, comments
 *   editor   reviews suggestions; own changes are approved at once
 *   admin    the Inbox, site settings; makes members editors and back
 *   owner    everything; gives and takes every level, admin and owner too
 *
 * The Worker checks these on every write, reading the role from D1; the app
 * uses them only to decide what to show.
 *
 * Apart from the levels, a member may be shown the site's statistics
 * (users.insights): the Overview's figures, Searches and the whole site's
 * ratings, read only. Editors and above see them anyway.
 */
import { AppError } from './errors.js';

/** @typedef {'member' | 'editor' | 'admin' | 'owner'} Role */
/** @typedef {'react' | 'comment' | 'suggest' | 'edit' | 'review' | 'manage_members' | 'manage_admins'} Action */

/** @type {readonly Role[]} */
export const ROLES = Object.freeze(['member', 'editor', 'admin', 'owner']);

/** @type {Record<Action, Role>} */
const REQUIRED = Object.freeze({
	react: 'member',
	comment: 'member',
	suggest: 'member',
	edit: 'editor',
	review: 'editor',
	manage_members: 'admin',
	manage_admins: 'owner',
});

/**
 * @param {unknown} value
 * @returns {value is Role}
 */
export function isRole(value) {
	return typeof value === 'string' && /** @type {readonly string[]} */ (ROLES).includes(value);
}

/**
 * Whether `role` is `least` or above.
 * @param {string} role
 * @param {Role} least
 */
export function atLeast(role, least) {
	if (!isRole(role)) throw new AppError('internal', `Unknown role: ${String(role)}`);
	return ROLES.indexOf(role) >= ROLES.indexOf(least);
}

/**
 * Whether a member sees the site's statistics.
 * @param {{ role: string, insights?: number | boolean | null }} m
 */
export function seesStatistics(m) {
	return atLeast(m.role, 'editor') || m.insights === 1 || m.insights === true;
}

/**
 * @param {Role} role
 * @param {Action} action
 */
export function can(role, action) {
	if (!isRole(role)) throw new AppError('internal', `Unknown role: ${String(role)}`);
	const required = REQUIRED[action];
	if (!required) throw new AppError('internal', `Unknown action: ${String(action)}`);
	return ROLES.indexOf(role) >= ROLES.indexOf(required);
}

/**
 * @param {Role} role
 * @param {Action} action
 */
export function assertCan(role, action) {
	if (!can(role, action)) {
		throw new AppError('forbidden', `Role "${role}" may not ${action.replace('_', ' ')}`);
	}
}

/**
 * The levels `actor` may give to someone who is now `current`: an owner any
 * level to anyone; an admin member or editor, to members and editors only.
 * Nobody changes their own level here (an owner leaving the role hands it on
 * first). Whether the site keeps an owner is the caller's check.
 * @param {Role} actor
 * @param {Role} current
 * @param {boolean} self
 * @returns {Role[]}
 */
export function assignable(actor, current, self) {
	if (self) return [];
	if (actor === 'owner') return [...ROLES];
	if (actor === 'admin' && (current === 'member' || current === 'editor')) return ['member', 'editor'];
	return [];
}
