// @ts-check
/**
 * The offline definitions are kept sealed (offline.js): each answer is
 * encrypted with AES-GCM under a key this browser makes on this device and
 * keeps as non-extractable, so it can be used but not read out. In the
 * browser's storage tools the answers are random bytes; only this site,
 * running here, opens them.
 *
 * What it is not: protection from the owner of the device, who can run the
 * site's own code. It keeps the dictionary from being read or lifted at a
 * glance; downloads per member are held to a few a day (worker/routes/
 * packs.js), and marker entries in the data show a copy for what it is.
 *
 * Sealed value: 12 bytes of IV, then the ciphertext of the answer's JSON.
 */

const IV_BYTES = 12;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** A new key: AES-GCM, 256 bits, never exportable. */
export function newSealKey() {
	return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/**
 * @param {CryptoKey} key
 * @param {unknown} value  Anything JSON holds.
 * @returns {Promise<Uint8Array>}
 */
export async function seal(key, value) {
	const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
	const body = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(value))));
	const out = new Uint8Array(IV_BYTES + body.length);
	out.set(iv);
	out.set(body, IV_BYTES);
	return out;
}

/**
 * The value back; a value kept before sealing began (plain) passes through.
 * Throws when the bytes were not sealed with this key.
 * @param {CryptoKey} key
 * @param {unknown} stored
 */
export async function unseal(key, stored) {
	if (!(stored instanceof Uint8Array) && !(stored instanceof ArrayBuffer)) return stored;
	const bytes = stored instanceof Uint8Array ? stored : new Uint8Array(stored);
	const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, IV_BYTES) }, key, bytes.slice(IV_BYTES));
	return JSON.parse(decoder.decode(plain));
}
