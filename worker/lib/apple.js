// @ts-check
/**
 * Sign in with Apple, kept apart so it can be switched off or removed
 * without touching Google or GitHub (worker/routes/auth.js uses it).
 *
 * Configuration: APPLE_SIGNIN_SERVICE_ID (the Services ID, "com.myordbok.web"),
 * APPLE_SIGNIN_KEY_ID and APPLE_TEAM_ID in wrangler.toml; APPLE_SIGNIN_KEY,
 * the .p8 private key, a secret. Without all four Apple is not offered.
 * The setting signin.apple turns it on, to existing accounts only, or off.
 *
 * Apple differs from the others in three ways:
 * - Its client secret is a token signed each time with the .p8 key (ES256),
 *   valid five minutes; nothing to renew.
 * - Asked for name and email, it answers with a form POST to the callback
 *   (response_mode=form_post). That POST comes from appleid.apple.com, so it
 *   carries none of this site's cookies (SameSite=Lax); the callback answers
 *   it with a 303 to the same address as a GET, a top-level navigation that
 *   does carry them, and the sign-in finishes there like the others.
 * - The member's name comes only once, on the first sign-in (the form's
 *   `user` field); the identity token carries the id and email.
 *
 * The identity token comes straight from Apple's token endpoint over TLS, as
 * Google's and GitHub's profiles do, so its claims are checked (issuer,
 * audience, expiry) and its signature is not fetched and verified again.
 * An email Apple relays ("Hide My Email", @privaterelay.appleid.com) is
 * neither stored nor matched: it belongs to no other provider account.
 */

export const APPLE = Object.freeze({
	authorize: 'https://appleid.apple.com/auth/authorize',
	token: 'https://appleid.apple.com/auth/token',
	issuer: 'https://appleid.apple.com',
});

/**
 * @typedef {object} AppleEnv
 * @property {string} [APPLE_SIGNIN_SERVICE_ID]
 * @property {string} [APPLE_SIGNIN_KEY_ID]
 * @property {string} [APPLE_TEAM_ID]
 * @property {string} [APPLE_SIGNIN_KEY]
 */

/** The configuration names, in the order a missing one is reported. */
export const APPLE_SETTINGS = /** @type {const} */ (['APPLE_SIGNIN_SERVICE_ID', 'APPLE_SIGNIN_KEY_ID', 'APPLE_TEAM_ID', 'APPLE_SIGNIN_KEY']);

/**
 * The first configuration value missing, or null when Apple can be offered.
 * @param {AppleEnv} env
 */
export function appleMissing(env) {
	return APPLE_SETTINGS.find((name) => !env[name]) ?? null;
}

/**
 * The client secret Apple asks for: a JWT signed with the .p8 key.
 * @param {AppleEnv} env
 * @param {number} [now]  Seconds; for tests.
 */
export async function appleClientSecret(env, now = Math.floor(Date.now() / 1000)) {
	const key = await crypto.subtle.importKey('pkcs8', pemBytes(/** @type {string} */ (env.APPLE_SIGNIN_KEY)), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
	const head = b64url(JSON.stringify({ alg: 'ES256', kid: env.APPLE_SIGNIN_KEY_ID }));
	const body = b64url(JSON.stringify({ iss: env.APPLE_TEAM_ID, iat: now, exp: now + 300, aud: APPLE.issuer, sub: env.APPLE_SIGNIN_SERVICE_ID }));
	// WebCrypto signs ECDSA as r‖s (IEEE P1363), the form JWS ES256 uses.
	const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${head}.${body}`));
	return `${head}.${body}.${b64url(new Uint8Array(signature))}`;
}

/**
 * The member's Apple account from the identity token and, on a first
 * sign-in, the form's `user` field.
 * @param {string} idToken
 * @param {string} audience  The Services ID.
 * @param {string | null} user  The `user` field, JSON, or null.
 * @param {number} [now]  Seconds; for tests.
 * @returns {{ id: string, name: string, email: string | null, avatar: null }}
 */
export function appleProfile(idToken, audience, user, now = Math.floor(Date.now() / 1000)) {
	const parts = idToken.split('.');
	if (parts.length !== 3) throw new Error('identity token is not a JWT');
	const claims = JSON.parse(new TextDecoder().decode(fromB64url(parts[1])));
	if (claims.iss !== APPLE.issuer) throw new Error(`identity token issuer ${claims.iss}`);
	if (claims.aud !== audience) throw new Error(`identity token audience ${claims.aud}`);
	if (typeof claims.exp !== 'number' || claims.exp < now) throw new Error('identity token expired');
	if (typeof claims.sub !== 'string' || !claims.sub) throw new Error('identity token without a subject');
	const verified = claims.email_verified === true || claims.email_verified === 'true';
	const relayed = claims.is_private_email === true || claims.is_private_email === 'true' || /@privaterelay\.appleid\.com$/i.test(claims.email ?? '');
	const email = typeof claims.email === 'string' && verified && !relayed ? claims.email.toLowerCase() : null;
	/** @type {{ name?: { firstName?: string, lastName?: string } } | null} */
	let given = null;
	try {
		given = user ? JSON.parse(user) : null;
	} catch {
		given = null; // a malformed name is no reason to refuse the sign-in
	}
	const name = [given?.name?.firstName, given?.name?.lastName].filter((x) => typeof x === 'string' && x.trim()).join(' ').trim();
	return { id: claims.sub, name: name || (email ? email.split('@')[0] : 'Member'), email, avatar: null };
}

/** @param {string} pem */
function pemBytes(pem) {
	const body = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
	return Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
}

/** @param {string | Uint8Array} data */
function b64url(data) {
	const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
	let text = '';
	for (const b of bytes) text += String.fromCharCode(b);
	return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** @param {string} text */
function fromB64url(text) {
	const plain = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4));
	return Uint8Array.from(plain, (c) => c.charCodeAt(0));
}
