// @ts-check
/**
 * Test doubles backed by node:sqlite, so the Worker and the release tool run
 * real SQL against the real migration and the public sample.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const ROOT = join(import.meta.dirname, '..', '..');
export const MIGRATION = readFileSync(join(ROOT, 'assets/db/migrations/0001_app.sql'), 'utf8');
export const SAMPLE = readFileSync(join(ROOT, 'assets/db/seed.dev.sql'), 'utf8');

/** @param {string} [sql]  Run first. */
export function sqlite(sql) {
	const db = new DatabaseSync(':memory:');
	if (sql) db.exec(sql);
	return db;
}

/**
 * The parts of the D1 binding API the Worker uses.
 * @param {DatabaseSync} db
 * @returns {any}
 */
export function d1(db) {
	return {
		prepare(/** @type {string} */ sql) {
			const statement = db.prepare(sql);
			/** @type {any[]} */
			let args = [];
			const api = {
				bind(/** @type {any[]} */ ...a) {
					args = a;
					return api;
				},
				async first() {
					return statement.get(...args) ?? null;
				},
				async all() {
					return { results: statement.all(...args) };
				},
				async raw() {
					statement.setReturnArrays(true);
					try {
						return statement.all(...args);
					} finally {
						statement.setReturnArrays(false);
					}
				},
			};
			return api;
		},
	};
}

/**
 * A scripts/data.js Runner over in-memory databases.
 * @param {Record<string, DatabaseSync>} dbs  By binding: DB, DICT_A, DICT_B.
 * @returns {import('../../scripts/data.js').Runner}
 */
export function runner(dbs) {
	return {
		where: 'test',
		query: (binding, sql) => /** @type {any} */ (dbs[binding].prepare(sql).all()),
		file: (binding, path) => dbs[binding].exec(readFileSync(path, 'utf8')),
	};
}
