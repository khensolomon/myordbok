// @ts-check
/**
 * Test doubles backed by node:sqlite, so the Worker and the release tool run
 * real SQL against the real migration and the public sample.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const ROOT = join(import.meta.dirname, '..', '..');
/** Every app migration, in order, as wrangler applies them. */
export const MIGRATION = readdirSync(join(ROOT, 'assets/db/migrations'))
	.filter((f) => f.endsWith('.sql'))
	.sort()
	.map((f) => readFileSync(join(ROOT, 'assets/db/migrations', f), 'utf8'))
	.join('\n');
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
			// D1 reports SQL errors when the statement runs, not when it is prepared.
			/** @type {any} */
			let prepared;
			const statement = {
				get: (/** @type {any[]} */ ...a) => (prepared ??= db.prepare(sql)).get(...a),
				run: (/** @type {any[]} */ ...a) => (prepared ??= db.prepare(sql)).run(...a),
				all: (/** @type {any[]} */ ...a) => (prepared ??= db.prepare(sql)).all(...a),
				setReturnArrays: (/** @type {boolean} */ v) => (prepared ??= db.prepare(sql)).setReturnArrays(v),
			};
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
				async run() {
					const r = statement.run(...args);
					return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
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
		/** D1 runs a batch as one transaction. @param {Array<{ run(): Promise<any> }>} statements */
		async batch(statements) {
			db.exec('BEGIN');
			try {
				const out = [];
				for (const s of statements) out.push(await s.run());
				db.exec('COMMIT');
				return out;
			} catch (err) {
				db.exec('ROLLBACK');
				throw err;
			}
		},
	};
}

/**
 * A scripts/data.js Runner over in-memory databases.
 * @param {Record<string, DatabaseSync>} dbs  By binding: APP, DATASET, DICTIONARY.
 * @returns {import('../../scripts/data.js').Runner}
 */
export function runner(dbs) {
	return {
		where: 'test',
		query: (binding, sql) => /** @type {any} */ (dbs[binding].prepare(sql).all()),
		file: (binding, path) => dbs[binding].exec(readFileSync(path, 'utf8')),
	};
}
