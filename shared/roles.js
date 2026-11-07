// @ts-check
/**
 * Membership levels and what each one may do.
 * The worker checks these on every write, reading the role from D1;
 * the app uses them only to decide what to show.
 */
import { AppError } from './errors.js';

/** @typedef {'member' | 'editor' | 'admin'} Role */
/** @typedef {'react' | 'comment' | 'suggest' | 'edit' | 'review' | 'manage_members'} Action */

/** @type {readonly Role[]} */
export const ROLES = Object.freeze(['member', 'editor', 'admin']);

/** @type {Record<Action, Role>} */
const REQUIRED = Object.freeze({
	react: 'member',
	comment: 'member',
	suggest: 'member',
	edit: 'editor',
	review: 'editor',
	manage_members: 'admin',
});

/**
 * @param {unknown} value
 * @returns {value is Role}
 */
export function isRole(value) {
	return typeof value === 'string' && /** @type {readonly string[]} */ (ROLES).includes(value);
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
