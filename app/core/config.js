// @ts-check
/**
 * Deployment-wide settings that are safe to publish.
 */

/** Google Analytics. Loaded only on these hosts, and only after consent. */
export const ANALYTICS = Object.freeze({
	id: 'G-E74XPBN0S9',
	hosts: Object.freeze(['myordbok.com', 'beta.myordbok.com']),
});

/**
 * Where questions, data requests and reports go; shown on the Privacy and
 * Terms pages. Placeholder until the address is decided.
 */
export const CONTACT = '[contact email]';

/** The open-source repository: code, issues. */
export const REPOSITORY = 'https://github.com/khensolomon/myordbok';
