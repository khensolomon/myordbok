// @ts-check
/**
 * Which dictionary database a request reads.
 *
 * Two databases hold the dictionary, named for the site each serves:
 *   BETA  myordbok-beta  every new build lands here first; beta reads it
 *   LIVE  myordbok-live  what live readers get
 *
 * dict_release in the app database names the one each site reads
 * (scripts/data.js writes it). Live reads myordbok-beta only while a
 * promotion imports the same build into myordbok-live. DICT_DB, when set,
 * overrides dict_release; local development sets it to "live".
 *
 * The choice is cached for a short time per isolate, so a switch reaches
 * every visitor within CHOICE_TTL_MS without an extra D1 read per lookup.
 */
import { AppError } from '../../shared/errors.js';

export const CHOICE_TTL_MS = 30_000;

/** @typedef {'beta' | 'live'} Dict */

/** @type {Record<Dict, string>} */
export const DATABASE_NAME = { beta: 'myordbok-beta', live: 'myordbok-live' };

/** @param {unknown} value @returns {value is Dict} */
const isDict = (value) => value === 'beta' || value === 'live';

/** @type {{ key: string, dict: Dict, at: number } | null} */
let cached = null;

/** Forget the cached choice (tests). */
export function resetChoiceCache() {
	cached = null;
}

/**
 * @typedef {object} DictEnv
 * @property {D1Database} APP
 * @property {D1Database} [BETA]
 * @property {D1Database} [LIVE]
 * @property {string} [DICT_DB]   "beta" or "live" to pin one; empty to use dict_release.
 * @property {string} [ENV_NAME]  "beta" or "live".
 */

/**
 * @param {DictEnv} env
 * @param {number} [now]
 * @returns {Promise<Dict>}
 */
export async function activeDict(env, now = Date.now()) {
	const pinned = env.DICT_DB;
	if (pinned) {
		if (!isDict(pinned)) throw new AppError('internal', `DICT_DB is "${pinned}", expected "beta" or "live"`);
		return pinned;
	}
	const name = env.ENV_NAME;
	if (!name) throw new AppError('internal', 'Neither DICT_DB nor ENV_NAME is set; see wrangler.toml');
	if (cached && cached.key === name && now - cached.at < CHOICE_TTL_MS) return cached.dict;

	const row = await env.APP.prepare('SELECT reads FROM dict_release WHERE env = ?1').bind(name).first();
	if (!row) {
		const how = name === 'live' ? 'make data-promote' : 'make data-publish';
		throw new AppError('unavailable', `No dictionary has been released to ${name}; run ${how}`);
	}
	if (!isDict(row.reads)) {
		throw new AppError('internal', `dict_release says ${name} reads "${row.reads}", expected "beta" or "live"; apply the migrations (make db-migrate-remote)`);
	}
	cached = { key: name, dict: row.reads, at: now };
	return row.reads;
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
		: dict === 'beta'
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
	const db = dict === 'beta' ? env.BETA : env.LIVE;
	if (!db) throw new AppError('internal', `The ${dict.toUpperCase()} binding is missing; see wrangler.toml`);
	return { dict, db };
}
