// @ts-check
/**
 * Web adapter: local storage for offline packs and small settings, on IndexedDB.
 * The Tauri adapter exports the same functions backed by files or SQLite.
 */
import { AppError } from '#shared/errors.js';

const DB_NAME = 'myordbok';
const DB_VERSION = 1;

/** @type {Promise<IDBDatabase> | null} */
let opening = null;

function open() {
	if (!('indexedDB' in globalThis)) {
		return Promise.reject(new AppError('unavailable', 'This browser has no IndexedDB, so offline data cannot be stored.'));
	}
	opening ??= new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
			if (!db.objectStoreNames.contains('packs')) db.createObjectStore('packs', { keyPath: 'id' });
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(new AppError('unavailable', `Could not open local storage: ${req.error?.message}`));
	});
	return opening;
}

/**
 * @template T
 * @param {'kv' | 'packs'} store
 * @param {IDBTransactionMode} mode
 * @param {(s: IDBObjectStore) => IDBRequest<T>} op
 * @returns {Promise<T>}
 */
async function run(store, mode, op) {
	const db = await open();
	return new Promise((resolve, reject) => {
		const req = op(db.transaction(store, mode).objectStore(store));
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(new AppError('internal', `Local storage failed: ${req.error?.message}`));
	});
}

/** @param {string} key */
export const get = (key) => run('kv', 'readonly', (s) => s.get(key));

/**
 * @param {string} key
 * @param {unknown} value
 */
export const put = (key, value) => run('kv', 'readwrite', (s) => s.put(value, key));

/**
 * @typedef {object} PackRecord
 * @property {string} id  e.g. "emd"
 * @property {number} version  Last applied changes.id
 * @property {number} bytes
 */

/** @returns {Promise<PackRecord[]>} */
export const listPacks = () => run('packs', 'readonly', (s) => s.getAll());

/** @param {string} id */
export const deletePack = (id) => run('packs', 'readwrite', (s) => s.delete(id));
