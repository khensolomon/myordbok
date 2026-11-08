// @ts-check
/**
 * Which dictionary database a request reads.
 *
 * Two databases hold the dictionary, each with a fixed role:
 *   DATASET     myordbok-dataset     every new build lands here first; beta reads it
 *   DICTIONARY  myordbok-dictionary  what production readers get
 *
 * dict_release in the app database names the one each site reads
 * (scripts/data.js writes it). Production reads myordbok-dataset only while a
 * promotion imports the same build into myordbok-dictionary. DICT_DB, when
 * set, overrides dict_release; local development sets it to "dictionary".
 *
 * The choice is cached for a short time per isolate, so a switch reaches
 * every visitor within CHOICE_TTL_MS without an extra D1 read per lookup.
 */
import { AppError } from '../../shared/errors.js';

export const CHOICE_TTL_MS = 30_000;

/** @typedef {'dataset' | 'dictionary'} Dict */

/** @type {Record<Dict, string>} */
export const DATABASE_NAME = { dataset: 'myordbok-dataset', dictionary: 'myordbok-dictionary' };

/** @type {{ key: string, dict: Dict, at: number } | null} */
let cached = null;

/** Forget the cached choice (tests). */
export function resetChoiceCache() {
	cached = null;
}

/**
 * @typedef {object} DictEnv
 * @property {D1Database} APP
 * @property {D1Database} [DATASET]
 * @property {D1Database} [DICTIONARY]
 * @property {string} [DICT_DB]   "dataset" or "dictionary" to pin one; empty to use dict_release.
 * @property {string} [ENV_NAME]  "beta" or "production".
 */

/**
 * @param {DictEnv} env
 * @param {number} [now]
 * @returns {Promise<Dict>}
 */
export async function activeDict(env, now = Date.now()) {
	const pinned = env.DICT_DB;
	if (pinned) {
		if (pinned !== 'dataset' && pinned !== 'dictionary') {
			throw new AppError('internal', `DICT_DB is "${pinned}", expected "dataset" or "dictionary"`);
		}
		return pinned;
	}
	const name = env.ENV_NAME;
	if (!name) throw new AppError('internal', 'Neither DICT_DB nor ENV_NAME is set; see wrangler.toml');
	if (cached && cached.key === name && now - cached.at < CHOICE_TTL_MS) return cached.dict;

	const row = await env.APP.prepare('SELECT reads FROM dict_release WHERE env = ?1').bind(name).first();
	if (!row) {
		const how = name === 'production' ? 'make data-promote' : 'make data-publish';
		throw new AppError('unavailable', `No dictionary has been released to ${name}; run ${how}`);
	}
	const dict = row.reads === 'dataset' ? 'dataset' : 'dictionary';
	cached = { key: name, dict, at: now };
	return dict;
}

/**
 * A query error caused by an empty database (no tables yet) becomes an error
 * that says so and how to fill it; any other error passes through unchanged.
 * @param {unknown} err
 * @param {Dict} dict
 * @param {DictEnv} env
 */
export function explainDictError(err, dict, env) {
	const message = err instanceof Error ? err.message : String(err);
	if (!/no such table/i.test(message)) return err;
	const fix = env.DICT_DB
		? 'locally: make data-sample, or make data-local FILE=…/build/myordbok.sql'
		: dict === 'dataset'
			? 'run make data-publish'
			: 'run make data-promote';
	return new AppError('unavailable', `${DATABASE_NAME[dict]} is empty (${message.replace(/^.*?(no such table)/i, '$1')}); ${fix}`);
}

/**
 * @param {DictEnv} env
 * @returns {Promise<{ dict: Dict, db: D1Database }>}
 */
export async function dictionary(env) {
	const dict = await activeDict(env);
	const db = dict === 'dataset' ? env.DATASET : env.DICTIONARY;
	if (!db) throw new AppError('internal', `The ${dict.toUpperCase()} binding is missing; see wrangler.toml`);
	return { dict, db };
}
