// @ts-check
/**
 * The files by which Android and iOS confirm that the website's links may
 * open in the MyOrdbok app (shared/stores.js): Android's
 * /.well-known/assetlinks.json (Digital Asset Links) and Apple's
 * /.well-known/apple-app-site-association. Both are read by the systems
 * (Google's verifier, Apple's CDN) over https, without redirects, as JSON.
 */
import { APP_ID, APP_LINK_PATHS, APPLE_TEAM_ID, PLAY_SIGNING_SHA256 } from '../../shared/stores.js';

const HEADERS = { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' };

/** Which paths the iOS app answers: each page, and every address under it. */
export function appSiteAssociation() {
	const components = APP_LINK_PATHS.flatMap((p) => [{ '/': p }, { '/': `${p}/*` }]);
	return { applinks: { details: [{ appIDs: [`${APPLE_TEAM_ID}.${APP_ID}`], components }] } };
}

/** The Android app, by the certificates Google Play signs it with. */
export function assetLinks() {
	return [
		{
			relation: ['delegate_permission/common.handle_all_urls'],
			target: { namespace: 'android_app', package_name: APP_ID, sha256_cert_fingerprints: [...PLAY_SIGNING_SHA256] },
		},
	];
}

/**
 * The response for one of the two addresses, or null for any other.
 * Android's is not served until a fingerprint is given: without one it
 * would confirm no app.
 * @param {string} pathname
 */
export function appLinkFile(pathname) {
	if (pathname === '/.well-known/apple-app-site-association') return Response.json(appSiteAssociation(), { headers: HEADERS });
	if (pathname === '/.well-known/assetlinks.json') {
		if (!PLAY_SIGNING_SHA256.length) return new Response('No Android app is confirmed yet (shared/stores.js, PLAY_SIGNING_SHA256).\n', { status: 404, headers: { 'content-type': 'text/plain' } });
		return Response.json(assetLinks(), { headers: HEADERS });
	}
	return null;
}
