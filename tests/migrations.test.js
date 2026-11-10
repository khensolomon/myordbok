import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';

const dir = join(import.meta.dirname, '..', 'assets', 'db', 'migrations');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

/**
 * Every migration applied one at a time, each in its own transaction as
 * D1 runs them, over a database that already has members, sign-ins,
 * sessions, grants and ratings: a migration that rebuilds a table others
 * point at must keep every reference whole (foreign keys are on in D1).
 */
test('migrations apply over a database with members and what points at them', () => {
	const db = new DatabaseSync(':memory:');
	assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
	let seeded = false;
	for (const f of files) {
		db.exec('BEGIN');
		db.exec(readFileSync(join(dir, f), 'utf8'));
		db.exec('COMMIT');
		if (!seeded && f.startsWith('0005')) {
			db.exec(`INSERT INTO users (id, name, email, role) VALUES (1, 'K', 'k@example.org', 'admin'), (2, 'M', 'm@example.org', 'member');
				INSERT INTO identities (provider, provider_user_id, user_id) VALUES ('github', '1', 1), ('google', '2', 2);
				INSERT INTO sessions (id_hash, user_id, expires_at) VALUES ('a', 1, unixepoch() + 60), ('b', 2, unixepoch() + 60);
				INSERT INTO role_grants (user_id, role, granted_by) VALUES (1, 'admin', NULL), (2, 'member', 1);
				INSERT INTO reactions (user_id, lang, word, value) VALUES (2, 'en', 'love', 1);
				INSERT INTO messages (kind, body, lang, user_id) VALUES ('feedback', 'hi', 'en', 2);`);
			seeded = true;
		}
	}
	assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
	assert.deepEqual(
		db.prepare('SELECT id, role FROM users ORDER BY id').all().map((r) => [r.id, r.role]),
		[[0, 'member'], [1, 'owner'], [2, 'member']],
	);
	assert.equal(db.prepare('SELECT count(*) AS n FROM sessions').get().n, 2);
	assert.equal(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name LIKE '%copy%' OR name LIKE '%next%'").get().n, 0);
});
