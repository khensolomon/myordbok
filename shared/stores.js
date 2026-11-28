// @ts-check
/**
 * Where the MyOrdbok apps are in the stores: for the website's pointers to
 * them (Safari's Smart App Banner, scripts/build.js; the Android card and
 * More's "Get the app", app/core/get-app.js), and for the links of the
 * website that open in the app once installed (worker/routes/app-links.js;
 * src-tauri/tauri.conf.json, plugins.deep-link; app/platform/tauri/boot.js).
 */
export const APP_STORE_ID = '1570959654';
export const APP_STORE_URL = `https://apps.apple.com/app/id${APP_STORE_ID}`;
export const PLAY_ID = 'com.myordbok.app';
export const PLAY_URL = `https://play.google.com/store/apps/details?id=${PLAY_ID}`;

/** The bundle id of both apps, and the Apple developer team that signs the iOS app. */
export const APP_ID = 'com.myordbok.app';
export const APPLE_TEAM_ID = 'AY23P8UZ8P';

/** The website whose links open in the app. */
export const APP_LINK_HOST = 'myordbok.com';

/**
 * The website's pages that open in the app (and every address under each):
 * the reader's pages that read the same in both. Sign-in (/link), the
 * workspace, the account and the legal pages stay on the website: the app
 * opens those in the browser itself, which a link claimed here would turn
 * back into the app.
 */
export const APP_LINK_PATHS = Object.freeze(['/definition', '/grammar', '/myanmar-fonts', '/practice']);

/**
 * SHA-256 fingerprints of the certificate Google Play signs the Android app
 * with (Play Console: Test and release, App integrity, App signing key
 * certificate), as Play Console writes them: pairs of hex digits joined by
 * colons. Android opens the links in the app only for an app signed with
 * one of these. Public: every site's assetlinks.json lists its own.
 * @type {readonly string[]}
 */
export const PLAY_SIGNING_SHA256 = Object.freeze(['0A:37:47:F9:9A:6A:60:29:21:3A:72:EC:78:67:25:B4:F2:7B:67:27:5F:01:12:EE:64:F3:35:C1:E2:05:F4:9C']);

/**
 * The app's path for a website's link (its query and fragment kept), or
 * null for a link to another site or a page left to the website.
 * @param {string} href
 * @returns {string | null}
 */
export function appLinkPath(href) {
	let url;
	try {
		url = new URL(href);
	} catch {
		return null;
	}
	if (url.protocol !== 'https:' || url.hostname !== APP_LINK_HOST) return null;
	const path = url.pathname.replace(/\/+$/, '');
	if (!APP_LINK_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) return null;
	return `${path}${url.search}${url.hash}`;
}
