// @ts-check
/**
 * The dictionary on this device: offline packs (scripts/packs.js) kept in
 * IndexedDB, and answers read from them when the network is not there.
 *
 *   word lists          downloaded by themselves after the first visit, unless
 *                       the reader saves data (about 0.6 MB): suggestions,
 *                       and knowing a word is in the dictionary
 *   senses, related     downloaded on request (the Offline page), for members
 *                       or for everyone by the site's setting
 *
 * An answer from here equals the online lookup for one word, as the packs
 * are made with the same lookup; phrases and sentences need the server.
 * Answers from here carry offline: true and the build they come from.
 */
import { getJSON } from '#platform/http.js';
import { AppError } from '#shared/errors.js';

const DB_NAME = 'myordbok-offline';
const DB_VERSION = 1;
/** Stores of answers, by pack id; word lists go to "words", one record per language. */
const ANSWER_STORES = /** @type {const} */ (['senses-en', 'senses-my', 'related-en']);
const BATCH = 2000;
const MYANMAR = /[က-႟]/;

/**
 * @typedef {{ id: string, kind: 'words' | 'senses' | 'related', lang: 'en' | 'my', rows: number, bytes: number, allowed: boolean }} PackInfo
 * @typedef {{ build: string, access: 'members' | 'everyone', signedIn: boolean, packs: PackInfo[] }} PacksInfo
 * @typedef {{ id: string, build: string, rows: number, bytes: number, at: number }} Installed
 */

/** @type {Promise<IDBDatabase> | null} */
let opening = null;

/** @returns {Promise<IDBDatabase>} */
function open() {
	if (opening) return opening;
	opening = new Promise((resolve, reject) => {
		if (typeof indexedDB === 'undefined') return reject(new AppError('unavailable', 'This browser cannot keep the dictionary on the device.'));
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			db.createObjectStore('packs', { keyPath: 'id' });
			db.createObjectStore('words', { keyPath: 'lang' });
			for (const name of ANSWER_STORES) db.createObjectStore(name);
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error ?? new Error('IndexedDB could not be opened'));
		req.onblocked = () => reject(new Error('The offline copy is open in another tab with an older version; close it and try again.'));
	});
	opening.catch(() => (opening = null));
	return opening;
}

/**
 * @template T
 * @param {IDBRequest<T>} req
 * @returns {Promise<T>}
 */
const done = (req) => new Promise((resolve, reject) => {
	req.onsuccess = () => resolve(req.result);
	req.onerror = () => reject(req.error);
});

/** @param {IDBTransaction} tx */
const finished = (tx) => new Promise((resolve, reject) => {
	tx.oncomplete = () => resolve(undefined);
	tx.onerror = () => reject(tx.error);
	tx.onabort = () => reject(tx.error ?? new Error('The offline copy could not be written (is the device full?)'));
});

/** @type {WeakMap<ReadableStream<string>, ReadableStreamDefaultReader<string>>} */
const readers = new WeakMap();

/**
 * The next piece of a text stream, or null at its end (a reader, as Safari
 * cannot iterate streams with for await).
 * @param {ReadableStream<string>} stream
 */
async function read(stream) {
	let reader = readers.get(stream);
	if (!reader) {
		reader = stream.getReader();
		readers.set(stream, reader);
	}
	const { value, done: end } = await reader.read();
	return end ? null : value;
}

/** What the site offers for the build it reads. @returns {Promise<PacksInfo>} */
export function packsInfo() {
	return getJSON('/api/packs');
}

/** Packs on this device. @returns {Promise<Installed[]>} */
export async function installed() {
	const db = await open();
	return done(db.transaction('packs').objectStore('packs').getAll());
}

/**
 * Downloads a pack and keeps it, replacing an older copy.
 * @param {PackInfo} pack
 * @param {string} build
 * @param {(fraction: number) => void} [onProgress]
 */
export async function install(pack, build, onProgress) {
	const res = await fetch(`/api/packs/${pack.id}`, { credentials: 'same-origin' }).catch(() => {
		throw new AppError('unavailable', 'Could not reach MyOrdbok. Check the connection.');
	});
	if (!res.ok || !res.body) {
		const err = /** @type {{ error?: { code: string, message: string } } | null} */ (await res.json().catch(() => null))?.error;
		throw new AppError(/** @type {import('#shared/errors.js').ErrorCode} */ (err?.code ?? 'internal'), err?.message ?? `Downloading ${pack.id} failed with status ${res.status}`);
	}
	const got = res.headers.get('x-pack-build');
	if (got && got !== build) throw new AppError('conflict', 'The dictionary was updated while downloading; open the page again.');
	let received = 0;
	const counted = res.body.pipeThrough(
		new TransformStream({
			transform(chunk, controller) {
				received += chunk.byteLength;
				onProgress?.(Math.min(1, received / pack.bytes));
				controller.enqueue(chunk);
			},
		}),
	);
	const text = counted.pipeThrough(new DecompressionStream('gzip')).pipeThrough(new TextDecoderStream());
	const db = await open();

	if (pack.kind === 'words') {
		let all = '';
		for (let part = await read(text); part !== null; part = await read(text)) all += part;
		const words = all.split('\n').filter(Boolean);
		if (words.length !== pack.rows) throw new AppError('internal', `${pack.id}: ${words.length} words arrived, ${pack.rows} expected`);
		const tx = db.transaction(['words', 'packs'], 'readwrite');
		tx.objectStore('words').put({ lang: pack.lang, build, words });
		tx.objectStore('packs').put({ id: pack.id, build, rows: pack.rows, bytes: pack.bytes, at: Date.now() });
		await finished(tx);
		wordLists.delete(pack.lang);
		return;
	}

	const store = /** @type {typeof ANSWER_STORES[number]} */ (pack.id);
	if (!ANSWER_STORES.includes(store)) throw new AppError('internal', `Unknown pack ${pack.id}`);
	// The old copy goes first: a half-written new one is never mixed with it.
	{
		const tx = db.transaction(['packs', store], 'readwrite');
		tx.objectStore('packs').delete(pack.id);
		tx.objectStore(store).clear();
		await finished(tx);
	}
	let rows = 0;
	let rest = '';
	/** @type {Array<[string, unknown]>} */
	let batch = [];
	const flush = async () => {
		if (!batch.length) return;
		const tx = db.transaction(store, 'readwrite');
		const os = tx.objectStore(store);
		for (const [key, value] of batch) os.put(value, key);
		batch = [];
		await finished(tx);
	};
	for (let part = await read(text); part !== null; part = await read(text)) {
		const lines = (rest + part).split('\n');
		rest = /** @type {string} */ (lines.pop());
		for (const line of lines) {
			if (!line) continue;
			batch.push(JSON.parse(line));
			rows++;
		}
		if (batch.length >= BATCH) await flush();
	}
	if (rest) {
		batch.push(JSON.parse(rest));
		rows++;
	}
	await flush();
	if (rows !== pack.rows) throw new AppError('internal', `${pack.id}: ${rows} rows arrived, ${pack.rows} expected`);
	const tx = db.transaction('packs', 'readwrite');
	tx.objectStore('packs').put({ id: pack.id, build, rows, bytes: pack.bytes, at: Date.now() });
	await finished(tx);
}

/**
 * Removes a pack from this device.
 * @param {string} id
 */
export async function remove(id) {
	const db = await open();
	const words = id.startsWith('words-');
	const store = words ? 'words' : id;
	const tx = db.transaction(['packs', store], 'readwrite');
	tx.objectStore('packs').delete(id);
	if (words) tx.objectStore('words').delete(id.slice('words-'.length));
	else tx.objectStore(store).clear();
	await finished(tx);
	if (words) wordLists.delete(id.slice('words-'.length));
}

/** Word lists held in memory once read. @type {Map<string, Promise<string[] | null>>} */
const wordLists = new Map();

/** @param {'en' | 'my'} lang */
function wordList(lang) {
	let list = wordLists.get(lang);
	if (!list) {
		list = open()
			.then((db) => done(db.transaction('words').objectStore('words').get(lang)))
			.then((r) => (r ? /** @type {string[]} */ (r.words) : null));
		list.catch(() => wordLists.delete(lang));
		wordLists.set(lang, list);
	}
	return list;
}

/**
 * Headwords starting with `q` from the word list on this device, or null
 * when there is none.
 * @param {string} q
 * @param {number} [limit]
 */
export async function suggestOffline(q, limit = 10) {
	const lang = MYANMAR.test(q) ? 'my' : 'en';
	const words = await wordList(lang).catch(() => null);
	if (!words) return null;
	return startingWith(words, q, lang, limit);
}

/**
 * The words of a sorted list that start with `q` (English ignoring case,
 * as the list is sorted).
 * @param {string[]} words
 * @param {string} q
 * @param {'en' | 'my'} lang
 * @param {number} limit
 */
export function startingWith(words, q, lang, limit) {
	const fold = (/** @type {string} */ s) => (lang === 'en' ? s.toLowerCase() : s);
	const p = fold(q);
	let lo = 0;
	let hi = words.length;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (fold(words[mid]) < p) lo = mid + 1;
		else hi = mid;
	}
	/** @type {string[]} */
	const out = [];
	for (let i = lo; i < words.length && out.length < limit; i++) {
		if (!fold(words[i]).startsWith(p)) break;
		out.push(words[i]);
	}
	return out;
}

/** Empty related lists, for an answer without the related pack. */
const NO_RELATED = { synonyms: [], similar: [], broader: [], opposite: [], related: [] };

/**
 * One word's answer from this device, in the shape of /api/lookup, or null
 * when this device has no senses for its language or not this word.
 * @param {string} q
 * @returns {Promise<(import('#shared/types.js').LookupResult & { offline: true, build: string }) | null>}
 */
export async function lookupOffline(q) {
	const text = q.normalize('NFC').split(/\s+/).filter(Boolean).join(' ');
	const lang = MYANMAR.test(text) ? 'my' : 'en';
	const db = await open().catch(() => null);
	if (!db) return null;
	const have = /** @type {Installed[]} */ (await done(db.transaction('packs').objectStore('packs').getAll()));
	const senses = have.find((p) => p.id === `senses-${lang}`);
	if (!senses) return null;
	const key = lang === 'en' ? text.toLowerCase() : text;
	const answer = await done(db.transaction(`senses-${lang}`).objectStore(`senses-${lang}`).get(key));
	if (!answer) return null;
	if (lang === 'my') return /** @type {any} */ ({ query: text, language: 'my', ...answer, offline: true, build: senses.build });
	const related = have.some((p) => p.id === 'related-en') ? await done(db.transaction('related-en').objectStore('related-en').get(key)) : null;
	return /** @type {any} */ ({ query: text, language: 'en', ...answer, ...NO_RELATED, ...(related ?? {}), offline: true, build: senses.build });
}

/**
 * Keeps the word lists of the build the site reads, after the first visit:
 * only online, only when the reader does not save data, and never twice
 * for the same build, checked at most once a day. Failures are the
 * caller's to log; reading goes on without them.
 * @param {() => boolean} savingData
 */
export async function keepWordLists(savingData) {
	if (!navigator.onLine || savingData() || typeof indexedDB === 'undefined') return;
	// Once a day per device is enough to notice a new build.
	const CHECKED = 'mo:packs-checked';
	try {
		if (Date.now() - Number(localStorage.getItem(CHECKED) ?? 0) < 86_400_000) return;
		localStorage.setItem(CHECKED, String(Date.now()));
	} catch {
		// storage blocked: check on each visit
	}
	const [info, have] = await Promise.all([packsInfo(), installed()]);
	for (const pack of info.packs.filter((p) => p.kind === 'words')) {
		if (have.some((h) => h.id === pack.id && h.build === info.build)) continue;
		await install(pack, info.build);
	}
}

/** How much this site keeps on the device, when the browser says. */
export async function storageUse() {
	const est = await navigator.storage?.estimate?.().catch(() => null);
	return est ? { used: est.usage ?? 0, quota: est.quota ?? 0 } : null;
}

/** Asks the browser not to clear the offline copy under storage pressure. */
export async function keepOnDevice() {
	return (await navigator.storage?.persist?.().catch(() => false)) ?? false;
}
