import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { badDatabaseIds, buildOfFile, exportEdits, planExport, promote, publish, releaseBeta, releaseLive, setDatabaseIds, status, switchSite, tsv, verifyBuild } from '../scripts/data.js';
import { MIGRATION, SAMPLE, runner, sqlite } from './helpers/d1.js';

/** @param {Partial<import('../scripts/data.js').Edit>} e */
const edit = (e) => /** @type {import('../scripts/data.js').Edit} */ ({
	dict: 'emd', action: 'edit', sense_id: null, field: null, old_value: null, new_value: null, word: 'water', data: null, created_at: 1, ...e,
});

const none = { emd: new Map(), med: new Map() };
const noWords = { emd: new Set(), med: new Set() };

test('tsv: CRLF, \\N for NULL, no tabs or line breaks inside values', () => {
	assert.equal(tsv(['id', 'new'], [[1, null]]), 'id\tnew\r\n1\t\\N\r\n');
	assert.throws(() => tsv(['a'], [['x\ty']]), /tab or line break/);
	assert.throws(() => tsv(['a'], [['x\ny']]), /tab or line break/);
});

test('export: chained edits of one field become one patch line', () => {
	const current = { emd: new Map([[7, { word: 'water', exam: 'a glass of water' }]]), med: new Map() };
	const plan = planExport(
		[
			edit({ id: 1, sense_id: 7, field: 'exam', old_value: 'a glass of water', new_value: 'a glass of cold water', created_at: 1 }),
			edit({ id: 2, sense_id: 7, field: 'exam', old_value: 'a glass of cold water', new_value: 'a cup of water', created_at: 2 }),
		],
		current,
		noWords,
	);
	assert.deepEqual(plan.files['emd_patch.tsv'].rows, [[7, 'exam', 'a glass of water', 'a cup of water']]);
	assert.deepEqual(plan.exported, [1, 2]);
	assert.deepEqual(plan.conflicts, []);
});

test('export: a stale old value or a broken chain is a conflict', () => {
	const current = { emd: new Map([[7, { word: 'water', exam: 'now different', sense: 'ရေ' }]]), med: new Map() };
	const plan = planExport(
		[
			edit({ id: 1, sense_id: 7, field: 'exam', old_value: 'a glass of water', new_value: 'x' }),
			edit({ id: 2, sense_id: 7, field: 'sense', old_value: 'ရေ', new_value: 'ရေ (အရည်)', created_at: 1 }),
			edit({ id: 3, sense_id: 7, field: 'sense', old_value: 'ရေ', new_value: 'ရေချို', created_at: 2 }),
			edit({ id: 4, sense_id: 99, field: 'sense', old_value: 'a', new_value: 'b' }),
			edit({ id: 5, sense_id: 7, field: 'wseq', old_value: '1', new_value: '2' }),
		],
		current,
		noWords,
	);
	assert.deepEqual(plan.conflicts.map((c) => c.id).sort((a, b) => a - b), [1, 3, 4, 5]);
	assert.deepEqual(plan.files['emd_patch.tsv'].rows, [[7, 'sense', 'ရေ', 'ရေ (အရည်)']]);
});

test('export: a delete names the headword and blocks other edits of the sense', () => {
	const current = { emd: new Map(), med: new Map([[3, { word: 'ချစ်သူ', sense: '<lover>' }]]) };
	const plan = planExport(
		[
			edit({ id: 1, dict: 'med', action: 'delete', sense_id: 3, word: 'ချစ်သူ' }),
			edit({ id: 2, dict: 'med', sense_id: 3, field: 'sense', old_value: '<lover>', new_value: '<darling>' }),
		],
		current,
		noWords,
	);
	assert.deepEqual(plan.files['med_patch.tsv'].rows, [[3, 'delete', 'ချစ်သူ', null]]);
	assert.deepEqual(plan.conflicts.map((c) => c.id), [2]);
});

test('export: additions go to new or existing-word files', () => {
	const plan = planExport(
		[
			edit({ id: 1, action: 'add', word: 'lovely', data: JSON.stringify({ wrte: 2, sense: 'ချစ်စရာ' }) }),
			edit({ id: 2, action: 'add', word: 'love', data: JSON.stringify({ wrte: 0, sense: 'အချစ်', exam: 'true love', synset: 107543288 }) }),
			edit({ id: 3, dict: 'med', action: 'add', word: 'ရေ', data: JSON.stringify({ wrte: 0, sense: '<liquid>' }) }),
			edit({ id: 4, dict: 'med', action: 'add', word: 'မြစ်', data: JSON.stringify({ wrte: 0, sense: '<river>' }) }),
			edit({ id: 5, dict: 'med', action: 'add', word: 'ကန်', data: JSON.stringify({ wrte: 0, sense: '<lake>', ipa: 'kàɴ', mlc: 'kan' }) }),
		],
		none,
		{ emd: new Set(['love']), med: new Set(['ရေ']) },
	);
	assert.deepEqual(plan.files['emd_new.tsv'].rows, [['lovely', 2, 'ချစ်စရာ', null, null]]);
	assert.deepEqual(plan.files['emd_more.tsv'].rows, [['love', 0, 'အချစ်', 'true love', 107543288]]);
	assert.deepEqual(plan.files['med_more.tsv'].rows, [['ရေ', 0, '<liquid>', null, null, null]]);
	assert.deepEqual(plan.files['med_new.tsv'].rows, [['ကန်', 0, '<lake>', null, 'kàɴ', 'kan']]);
	assert.deepEqual(plan.conflicts.map((c) => c.id), [4]); // a new headword needs a pronunciation
});

test('verifyBuild compares row counts with meta', () => {
	assert.deepEqual(verifyBuild({ built: 'x', 'rows.eng_word': '2' }, { eng_word: 2 }), []);
	assert.match(verifyBuild({ built: 'x', 'rows.eng_word': '2' }, { eng_word: 1 })[0], /eng_word: 1 rows, meta says 2/);
	assert.equal(verifyBuild({ 'rows.a': '1' }, { a: 1 }).length, 1);
});

test('the app database refuses edit values that cannot travel as TSV', () => {
	const db = sqlite(MIGRATION);
	db.exec("INSERT INTO users (id, name) VALUES (1, 'A')");
	const insert = db.prepare("INSERT INTO dict_edits (user_id, dict, action, sense_id, field, old_value, new_value, word) VALUES (1, 'emd', 'edit', 1, 'exam', 'a', ?, 'x')");
	insert.run('fine');
	assert.throws(() => insert.run('two\nlines'), /CHECK/);
	assert.throws(() => insert.run('a\ttab'), /CHECK/);
	assert.throws(() => db.exec("INSERT INTO dict_edits (user_id, dict, action, word) VALUES (1, 'emd', 'edit', 'x')"), /CHECK/);
});

/** Fresh databases, a runner over them, and a log. */
function setupRelease() {
	const dir = mkdtempSync(join(tmpdir(), 'myordbok-data-'));
	const dbs = { APP: sqlite(MIGRATION), DATASET: sqlite(), DICTIONARY: sqlite() };
	/** @type {string[]} */
	const out = [];
	return { dir, dbs, db: runner(dbs), out, log: (/** @type {string} */ s) => out.push(s) };
}

/** @param {import('node:sqlite').DatabaseSync} app */
const readsOf = (app) => Object.fromEntries(app.prepare('SELECT env, reads, build FROM dict_release').all().map((r) => [r.env, `${r.reads} ${r.build}`]));

test('a build file names its build', () => {
	assert.equal(buildOfFile(SAMPLE), 'sample');
	assert.equal(buildOfFile("INSERT INTO meta (key, value) VALUES ('built', '2026-11-08 08:26 UTC'),\n('source', 'x');"), '2026-11-08 08:26 UTC');
	assert.equal(buildOfFile('SELECT 1;'), null);
});

test('release cycle: publish to beta, promote to production, export, merge', async () => {
	const { dir, dbs, db, out, log } = setupRelease();
	const first = join(dir, 'first.sql');
	writeFileSync(first, SAMPLE);

	// Publish: the dataset gets the build, beta previews it, production is untouched.
	publish(db, first, true, log);
	assert.deepEqual(readsOf(dbs.APP), { beta: 'dataset sample' });
	// …and its statistics are kept for the workspace.
	const kept = JSON.parse(dbs.APP.prepare("SELECT stats FROM build_stats WHERE build = 'sample'").get().stats);
	assert.equal(kept.en.senses, dbs.DATASET.prepare('SELECT count(*) AS n FROM emd_sense').get().n);
	assert.equal(kept.my.headwords, dbs.DATASET.prepare('SELECT count(DISTINCT wrid) AS n FROM med_sense').get().n);
	assert.ok(kept.en.pos.Noun > 0);

	// Promote: production ends on the dictionary, holding the same build.
	await promote(db, first, true, log, { waitMs: 0 });
	assert.deepEqual(readsOf(dbs.APP), { beta: 'dataset sample', production: 'dictionary sample' });
	out.length = 0;
	status(db, log);
	assert.match(out[0], /^myordbok-dictionary  build sample, source sample  ← production$/);
	assert.match(out[1], /^myordbok-dataset     build sample, source sample  ← beta$/);

	// Studio edits, approved, exported against what production readers see.
	dbs.APP.exec(`INSERT INTO users (id, name, role) VALUES (1, 'Editor', 'editor');
		INSERT INTO dict_edits (user_id, dict, action, sense_id, field, old_value, new_value, word, status, created_at) VALUES
		(1, 'emd', 'edit', 7, 'exam', 'a glass of water', 'a glass of cold water', 'water', 'approved', 1),
		(1, 'emd', 'edit', 7, 'exam', 'a glass of cold water', 'a cup of water', 'water', 'approved', 2),
		(1, 'emd', 'edit', 6, 'sense', 'stale', 'x', 'colour', 'approved', 3)`);
	await exportEdits(db, dir, true, log);
	const exported = join(dir, 'export-0001');
	assert.deepEqual(readdirSync(exported), ['emd_patch.tsv']);
	assert.equal(readFileSync(join(exported, 'emd_patch.tsv'), 'utf8'), 'id\tfield\told\tnew\r\n7\texam\ta glass of water\ta cup of water\r\n');
	const states = () => dbs.APP.prepare('SELECT status FROM dict_edits ORDER BY id').all().map((r) => r.status);
	assert.deepEqual(states(), ['exported', 'exported', 'conflict']);

	// The dataset merges the patch; the next build goes to beta only.
	const next = join(dir, 'next.sql');
	writeFileSync(next, SAMPLE.replace("'a glass of water'", "'a cup of water'").replace("('built', 'sample')", "('built', 'sample-2')"));
	publish(db, next, true, log);
	assert.deepEqual(states(), ['merged', 'merged', 'conflict']);
	assert.equal(dbs.APP.prepare('SELECT merged_source FROM dict_exports').get()?.merged_source, 'sample-2');
	assert.deepEqual(readsOf(dbs.APP), { beta: 'dataset sample-2', production: 'dictionary sample' });

	// Exporting waits until production has what beta previews.
	await assert.rejects(exportEdits(db, dir, false, log), /Beta previews build sample-2, production has sample/);
	// Promoting needs the build beta previews, not an older file.
	await assert.rejects(promote(db, first, true, log, { waitMs: 0 }), /holds build sample, beta previews sample-2/);
	await promote(db, next, true, log, { waitMs: 0 });
	assert.deepEqual(readsOf(dbs.APP), { beta: 'dataset sample-2', production: 'dictionary sample-2' });
	assert.equal(dbs.DICTIONARY.prepare("SELECT exam FROM emd_sense WHERE id = 7").get()?.exam, 'a cup of water');
});

test('a promotion that stops half way leaves production on the dataset, and can be finished', async () => {
	const { dir, dbs, db, log } = setupRelease();
	const good = join(dir, 'good.sql');
	writeFileSync(good, SAMPLE);
	publish(db, good, true, log);

	// The import into the dictionary fails: production keeps reading the dataset.
	const broken = runner(dbs);
	broken.file = (binding, path) => {
		if (binding === 'DICTIONARY') throw new Error('network gone');
		dbs[binding].exec(readFileSync(path, 'utf8'));
	};
	await assert.rejects(promote(broken, good, true, log, { waitMs: 0 }), /network gone/);
	assert.equal(readsOf(dbs.APP).production, 'dataset sample');

	// Nothing new is published until the promotion is finished.
	assert.throws(() => publish(db, good, true, log), /a promotion did not finish/);
	await promote(db, good, true, log, { waitMs: 0 });
	assert.equal(readsOf(dbs.APP).production, 'dictionary sample');
});

test('publish refuses an incomplete build and leaves the sites alone', () => {
	const { dir, dbs, db, log } = setupRelease();
	const broken = join(dir, 'broken.sql');
	writeFileSync(broken, SAMPLE.replace("('rows.eng_word', '29')", "('rows.eng_word', '30')"));
	assert.throws(() => publish(db, broken, true, log), /myordbok-dataset failed its checks:\n  eng_word: 29 rows, meta says 30/);
	assert.equal(dbs.APP.prepare('SELECT count(*) AS n FROM dict_release').get()?.n, 0);
});

test('switch points one site at one database, for repairs', () => {
	const { dir, dbs, db, log } = setupRelease();
	const file = join(dir, 'b.sql');
	writeFileSync(file, SAMPLE);
	assert.throws(() => switchSite(db, 'production', 'dictionary', true, log), /myordbok-dictionary holds no build/);
	publish(db, file, true, log);
	switchSite(db, 'production', 'dataset', true, log);
	assert.equal(readsOf(dbs.APP).production, 'dataset sample');
});

test('database ids: placeholders and non-ids are refused, setup fills every environment', () => {
	// wrangler.toml as shipped before setup: every id a placeholder.
	const toml = setDatabaseIds(readFileSync(join(import.meta.dirname, '..', 'wrangler.toml'), 'utf8'), {
		APP: '00000000-0000-0000-0000-000000000001',
		DATASET: '00000000-0000-0000-0000-000000000002',
		DICTIONARY: '00000000-0000-0000-0000-000000000003',
	});
	assert.equal(badDatabaseIds(toml).length, 3);
	assert.deepEqual(
		badDatabaseIds('[[d1_databases]]\nbinding = "DATASET"\ndatabase_name = "myordbok-dataset"\ndatabase_id = "<id of dataset>"\n'),
		['DATASET (myordbok-dataset): "<id of dataset>"'],
	);
	const ids = {
		APP: '11111111-2222-3333-4444-555555555555',
		DATASET: '66666666-7777-8888-9999-000000000000',
		DICTIONARY: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
	};
	const filled = setDatabaseIds(toml, ids);
	assert.deepEqual(badDatabaseIds(filled), []);
	for (const id of Object.values(ids)) assert.equal(filled.split(id).length - 1, 3);
	assert.equal(setDatabaseIds(filled.replaceAll(ids.DATASET, '<id of dataset>'), ids), filled);
	assert.throws(() => setDatabaseIds(toml, { DATASET: 'nope' }), /Not a database id/);
});

test('grant: a role by sign-in email, dry run first, recorded', async () => {
	const { grant } = await import('../scripts/data.js');
	const dbs = { APP: sqlite(MIGRATION), DATASET: sqlite(), DICTIONARY: sqlite() };
	dbs.APP.exec("INSERT INTO users (name, email) VALUES ('Khen', 'khen@example.com')");
	const db = runner(dbs);
	const lines = [];
	const log = (l) => lines.push(l);
	grant(db, 'Khen@Example.com', 'admin', false, log);
	assert.equal(dbs.APP.prepare('SELECT role FROM users WHERE id > 0').get().role, 'member', 'dry run');
	grant(db, 'khen@example.com', 'admin', true, log);
	assert.equal(dbs.APP.prepare('SELECT role FROM users WHERE id > 0').get().role, 'admin');
	assert.deepEqual({ ...dbs.APP.prepare('SELECT role, granted_by FROM role_grants').get() }, { role: 'admin', granted_by: null });
	assert.throws(() => grant(db, "x' OR 1=1 --@a.b", 'admin', true, log), /Give --email/);
	assert.throws(() => grant(db, 'nobody@example.com', 'admin', true, log), /No member has the email/);
	assert.throws(() => grant(db, 'khen@example.com', 'super', true, log), /Give --role/);
});

test('grant: a level the database does not know yet says which migrations to apply', async () => {
	const { grant } = await import('../scripts/data.js');
	const dir = join(import.meta.dirname, '..', 'assets', 'db', 'migrations');
	const before = readdirSync(dir).filter((f) => f.endsWith('.sql') && f < '0007').sort().map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
	const app = sqlite(before);
	app.exec("INSERT INTO users (id, name, email) VALUES (1, 'K', 'k@example.com')");
	const db = runner({ APP: app, DATASET: sqlite(), DICTIONARY: sqlite() });
	assert.throws(() => grant(db, 'k@example.com', 'owner', true, () => {}), /does not know the level "owner" yet\. Apply the migrations first: make db-migrate/);
});

test('release in two commands: beta (packs first, then publish), live from the remembered file', async () => {
	const { dir, dbs, db, out, log } = setupRelease();
	const file = join(dir, 'build.sql');
	writeFileSync(file, SAMPLE);
	const remember = join(dir, 'state', 'release.json');
	/** @type {string[]} */
	const order = [];
	const packs = async (/** @type {string} */ f) => {
		order.push(`packs ${readsOf(dbs.APP).beta ?? 'none'}`);
		return 'sample';
	};

	await assert.rejects(releaseLive(db, null, true, log, { remember, waitMs: 0 }), /No build was released to beta/);
	await releaseBeta(db, file, false, log, { packs, remember });
	assert.deepEqual([order, readsOf(dbs.APP)], [[], {}], 'a dry run changes nothing');

	await releaseBeta(db, file, true, log, { packs, remember });
	assert.deepEqual(order, ['packs none'], 'the packs are up before beta reads the build');
	assert.deepEqual(readsOf(dbs.APP), { beta: 'dataset sample' });
	assert.equal(JSON.parse(readFileSync(remember, 'utf8')).built, 'sample');

	// The file changed after it went to beta: production is refused.
	writeFileSync(file, `${SAMPLE}\n-- rebuilt`);
	await assert.rejects(releaseLive(db, null, true, log, { remember, waitMs: 0 }), /changed since it went to beta/);
	writeFileSync(file, SAMPLE);
	out.length = 0;
	await releaseLive(db, null, true, log, { remember, waitMs: 0 });
	assert.deepEqual(readsOf(dbs.APP), { beta: 'dataset sample', production: 'dictionary sample' });
});
