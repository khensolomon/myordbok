import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import worker from '../worker/index.js';
import { BACKUP_INDEX, BACKUP_PREFIX, KEEP, KEEP_DAYS, backupKey, backupName, nameOfKey, planPrune, timeOfName } from '../shared/backup.js';
import { applyRestore, keyMatch, literal, loadBackup, planRestore, restoreSql } from '../scripts/backup.js';
import { MIGRATION, SAMPLE, d1, sqlite } from './helpers/d1.js';

const SITE = 'https://myordbok.test';
const DAY = 86400000;

test('backup names: UTC minute, sortable, and back again', () => {
	const at = new Date('2026-11-15T20:17:42Z');
	assert.equal(backupName(at), '2026-11-15-2017');
	assert.equal(backupKey('2026-11-15-2017'), `${BACKUP_PREFIX}2026-11-15-2017.sql.gz`);
	assert.equal(nameOfKey(backupKey('2026-11-15-2017')), '2026-11-15-2017');
	assert.equal(nameOfKey(BACKUP_INDEX), null, 'the index is not a backup');
	assert.equal(nameOfKey('offline/x/manifest.json'), null);
	assert.equal(timeOfName('2026-11-15-2017'), Date.parse('2026-11-15T20:17:00Z'));
	assert.throws(() => backupKey('../../offline'), /Not a backup name/);
});

test('retention: everything of the last KEEP_DAYS days, never fewer than KEEP', () => {
	const now = Date.parse('2027-06-01T00:00:00Z');
	const weekly = (n) => Array.from({ length: n }, (_, i) => ({ key: backupKey(backupName(new Date(now - i * 7 * DAY))), size: 100 + i }));

	// Twenty weeks: the 12 weeks of KEEP_DAYS (and the day itself) stay.
	const { kept, dropped } = planPrune([...weekly(20), { key: BACKUP_INDEX, size: 1 }], now);
	assert.equal(kept.length, KEEP_DAYS / 7 + 1);
	assert.equal(dropped.length, 20 - kept.length);
	assert.ok(kept[0].name > kept[1].name, 'newest first');
	assert.equal(kept[0].bytes, 100);
	assert.ok(!dropped.includes(BACKUP_INDEX));

	// Backups made by hand in between push no weekly one out.
	const extra = [1, 2, 3].map((d) => ({ key: backupKey(backupName(new Date(now - d * DAY))), size: 1 }));
	assert.equal(planPrune([...weekly(20), ...extra], now).kept.length, KEEP_DAYS / 7 + 1 + 3);

	// Backups that stopped half a year ago: the newest KEEP stay anyway.
	const stale = weekly(20).map((o) => ({ ...o, key: backupKey(backupName(new Date(timeOfName(nameOfKey(o.key)) - 180 * DAY))) }));
	const old = planPrune(stale, now);
	assert.equal(old.kept.length, KEEP);
	assert.equal(old.dropped.length, 20 - KEEP);
});

test('SQL literals and key matches', () => {
	assert.equal(literal(null), 'NULL');
	assert.equal(literal(42), '42');
	assert.equal(literal(12345678901234567890n), '12345678901234567890');
	assert.equal(literal("it's"), "'it''s'");
	assert.equal(literal(new Uint8Array([0, 255])), "X'00ff'");
	assert.throws(() => literal(NaN), /storable/);
	assert.equal(keyMatch(['id'], [{ id: 1 }, { id: 2 }]), '"id" IN (1, 2)');
	assert.equal(keyMatch(['day', 'name'], [{ day: '2026-11-01', name: 'a' }]), `("day", "name") IN (VALUES ('2026-11-01', 'a'))`);
});

/** A live myordbok-app, as wrangler's runner would reach it. */
function liveRunner(db) {
	return {
		where: 'test',
		query: (_binding, sql) => db.prepare(sql).all(),
		file: (_binding, path) => db.exec(readFileSync(path, 'utf8')),
	};
}

function dump(db) {
	// What a D1 export holds, near enough: the schema, then every row.
	const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all();
	const lines = ['PRAGMA defer_foreign_keys=TRUE;'];
	for (const t of tables) {
		lines.push(`${t.sql};`);
		for (const r of db.prepare(`SELECT * FROM "${t.name}"`).all()) lines.push(`INSERT INTO "${t.name}" (${Object.keys(r).map((c) => `"${c}"`).join(',')}) VALUES(${Object.values(r).map(literal).join(',')});`);
	}
	return lines.join('\n');
}

test('restore: only rows that are gone come back; changed ones are reported and left', async () => {
	const live = sqlite(MIGRATION);
	live.exec(`INSERT INTO users (id, name) VALUES (1, 'Mya'), (2, 'Ed');
		INSERT INTO comments (id, user_id, lang, word, body) VALUES (10, 1, 'en', 'love', 'one'), (11, 1, 'en', 'love', 'two'), (12, 2, 'en', 'love', 'three');
		INSERT INTO reactions (user_id, lang, word, value) VALUES (1, 'en', 'love', 1), (2, 'en', 'love', -1);`);
	const backup = loadBackup(dump(live));

	// Since the backup: 10 deleted, 11 edited, 12 deleted and its id reused.
	live.exec("DELETE FROM comments WHERE id IN (10, 12); UPDATE comments SET body = 'two, edited' WHERE id = 11; INSERT INTO comments (id, user_id, lang, word, body) VALUES (12, 2, 'en', 'hope', 'newer');");
	const runner = liveRunner(live);
	const plan = planRestore(backup, runner, 'comments');
	assert.deepEqual(plan.missing.map((r) => r.id), [10]);
	assert.deepEqual(plan.changed.map((c) => c.backup.id), [11, 12]);
	assert.equal(plan.same, 0);
	assert.deepEqual(plan.unresolved, []);
	assert.match(restoreSql(plan), /^INSERT INTO "comments" \("id", .*\) VALUES \(10, 1, 'en', 'love', 'one',/);

	const lines = [];
	applyRestore(runner, plan, false, (l) => lines.push(l));
	assert.match(lines.at(-1), /Dry run: 1 row/);
	assert.equal(live.prepare('SELECT count(*) AS n FROM comments WHERE id = 10').get().n, 0, 'a dry run changes nothing');
	applyRestore(runner, plan, true, (l) => lines.push(l));
	assert.equal(live.prepare('SELECT body FROM comments WHERE id = 10').get().body, 'one');
	assert.equal(live.prepare('SELECT body FROM comments WHERE id = 11').get().body, 'two, edited', 'an edit since is kept');
	assert.equal(live.prepare('SELECT body FROM comments WHERE id = 12').get().body, 'newer', 'a reused id is not overwritten');
	assert.equal(planRestore(backup, runner, 'comments').missing.length, 0, 'a second run finds nothing');

	// --where narrows; a composite key matches too.
	live.exec('DELETE FROM reactions');
	assert.deepEqual(
		planRestore(backup, runner, 'reactions', 'user_id = 2').missing.map((r) => [r.user_id, r.value]),
		[[2, -1]],
	);
	assert.throws(() => planRestore(backup, runner, 'comments', 'nope = 1'), /--where does not work/);
	assert.throws(() => planRestore(backup, runner, 'sessions'), /never restored/);
	assert.throws(() => planRestore(backup, runner, 'nothing'), /no table nothing/);
});

test('restore: rows pointing at a member who is gone stop it until the member is back', () => {
	const live = sqlite(MIGRATION);
	live.exec(`INSERT INTO users (id, name) VALUES (1, 'Mya');
		INSERT INTO comments (id, user_id, lang, word, body) VALUES (10, 1, 'en', 'love', 'one');`);
	const backup = loadBackup(dump(live));
	live.exec('DELETE FROM comments; DELETE FROM users WHERE id = 1');
	const runner = liveRunner(live);

	const plan = planRestore(backup, runner, 'comments');
	assert.deepEqual(plan.unresolved, [{ column: 'user_id', table: 'users', to: 'id', values: [1] }]);
	assert.throws(() => applyRestore(runner, plan, true, () => {}), /Restore those first/);
	assert.equal(live.prepare('SELECT count(*) AS n FROM comments').get().n, 0);

	applyRestore(runner, planRestore(backup, runner, 'users', 'id = 1'), true, () => {});
	applyRestore(runner, planRestore(backup, runner, 'comments'), true, () => {});
	assert.equal(live.prepare('SELECT body FROM comments WHERE id = 10').get().body, 'one');
});

test('restore: columns added since the backup take their defaults; columns gone are left out', () => {
	const old = sqlite('CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT, retired TEXT); INSERT INTO notes VALUES (1, \'a\', \'x\');');
	const live = sqlite("CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT, status TEXT NOT NULL DEFAULT 'new');");
	const backup = loadBackup(dump(old));
	const runner = liveRunner(live);
	const plan = planRestore(backup, runner, 'notes');
	assert.deepEqual([plan.columns, plan.dropped], [['id', 'body'], ['retired']]);
	applyRestore(runner, plan, true, () => {});
	assert.deepEqual({ ...live.prepare('SELECT * FROM notes').get() }, { id: 1, body: 'a', status: 'new' });
});

test('overview: admins see the newest backup, others nothing; an unreadable bucket says so', async () => {
	const hash = (t) => createHash('sha256').update(t).digest('hex');
	const app = sqlite(MIGRATION);
	app.exec(`INSERT INTO users (id, name, role) VALUES (1, 'Ad', 'admin'), (2, 'Ed', 'editor');
		INSERT INTO sessions (id_hash, user_id, expires_at) VALUES ('${hash('admin')}', 1, unixepoch() + 3600), ('${hash('editor')}', 2, unixepoch() + 3600);`);
	const index = { updated: '2026-11-15T20:18:00Z', keep: KEEP, keep_days: KEEP_DAYS, backups: [{ name: '2026-11-15-2017', key: backupKey('2026-11-15-2017'), bytes: 3009, at: '2026-11-15T20:17:00.000Z' }, { name: '2026-11-08-2017', key: backupKey('2026-11-08-2017'), bytes: 2990, at: '2026-11-08T20:17:00.000Z' }] };
	const dict = sqlite(SAMPLE);
	const env = (STORAGE) => ({ APP: d1(app), BETA: d1(sqlite()), LIVE: d1(dict), ASSETS: { fetch: () => new Response('') }, DICT_DB: 'live', STORAGE });
	const overview = async (e, who) => (await (await worker.fetch(new Request(`${SITE}/api/workspace/overview`, { headers: { origin: SITE, cookie: `__Host-mo_session=${who}` } }), e)).json());

	const kept = env({ get: async (key) => (key === BACKUP_INDEX ? { json: async () => index } : null) });
	assert.deepEqual((await overview(kept, 'admin')).backup, { at: '2026-11-15T20:17:00.000Z', name: '2026-11-15-2017', bytes: 3009, kept: 2 });
	assert.equal((await overview(kept, 'editor')).backup, undefined);
	assert.equal((await overview(env({ get: async () => null }), 'admin')).backup, null);
	assert.match((await overview(env({ get: async () => { throw new Error('R2 down'); } }), 'admin')).backup.error, /R2 down/);
	assert.match((await overview(env(undefined), 'admin')).backup.error, /STORAGE is missing/);
});
