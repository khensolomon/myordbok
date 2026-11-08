// @ts-check
/**
 * Deployment-wide settings that are safe to publish.
 */

/** Google Analytics. Loaded only on these hosts, and only after consent. */
export const ANALYTICS = Object.freeze({
	id: 'G-E74XPBN0S9',
	hosts: Object.freeze(['myordbok.com', 'beta.myordbok.com']),
});
