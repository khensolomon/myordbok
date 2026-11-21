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
 * Where questions, data requests and reports go: the site's own contact
 * form (MyOrdbok has no email address of its own).
 */
export const CONTACT = '/contact';

/** Where readers give (the Support page, app/reader/support.js). */
export const GIVE = Object.freeze({
	paypal: 'https://www.paypal.com/donate/?hosted_button_id=C9PDG3T47WJ26',
	github: 'https://github.com/sponsors/khensolomon',
});

/** The app in the stores, by platform (platform/tauri/boot.js: an update asked for). */
export const STORES = Object.freeze({
	android: 'https://play.google.com/store/apps/details?id=com.myordbok.app',
	ios: 'https://apps.apple.com/app/id1570959654',
});

/** The open-source repository: code, issues. */
export const REPOSITORY = 'https://github.com/khensolomon/myordbok';
