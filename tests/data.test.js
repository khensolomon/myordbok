import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { badDatabaseIds, exportEdits, planExport, setDatabaseIds, publish, status, switchSlot, tsv, verifyBuild } from '../scripts/data.js';
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

test('release cycle: publish, promote, export, merge', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'myordbok-data-'));
	const dbs = { DB: sqlite(MIGRATION), DICT_A: sqlite(), DICT_B: sqlite() };
	const db = runner(dbs);
	/** @type {string[]} */
	const out = [];
	const log = (/** @type {string} */ s) => out.push(s);

	// First release: slot A, beta first, then production.
	const first = join(dir, 'first.sql');
	writeFileSync(first, SAMPLE);
	publish(db, first, true, log);
	switchSlot(db, 'production', undefined, true, log);
	out.length = 0;
	status(db, log);
	assert.match(out[0], /^slot a: build sample, .*← beta, production$/);

	// Studio edits, approved.
	dbs.DB.exec(`INSERT INTO users (id, name, role) VALUES (1, 'Editor', 'editor');
		INSERT INTO dict_edits (user_id, dict, action, sense_id, field, old_value, new_value, word, status, created_at) VALUES
		(1, 'emd', 'edit', 7, 'exam', 'a glass of water', 'a glass of cold water', 'water', 'approved', 1),
		(1, 'emd', 'edit', 7, 'exam', 'a glass of cold water', 'a cup of water', 'water', 'approved', 2),
		(1, 'emd', 'edit', 6, 'sense', 'stale', 'x', 'colour', 'approved', 3)`);
	await exportEdits(db, dir, true, log);
	const exported = join(dir, 'export-0001');
	assert.deepEqual(readdirSync(exported), ['emd_patch.tsv']);
	assert.equal(readFileSync(join(exported, 'emd_patch.tsv'), 'utf8'), 'id\tfield\told\tnew\r\n7\texam\ta glass of water\ta cup of water\r\n');
	const states = () => dbs.DB.prepare('SELECT status FROM dict_edits ORDER BY id').all().map((r) => r.status);
	assert.deepEqual(states(), ['exported', 'exported', 'conflict']);

	// The dataset merges the patch; the next build goes to slot B and beta.
	const next = join(dir, 'next.sql');
	writeFileSync(next, SAMPLE.replace("'a glass of water'", "'a cup of water'").replace("('built', 'sample')", "('built', 'sample-2')"));
	publish(db, next, true, log);
	assert.deepEqual(states(), ['merged', 'merged', 'conflict']);
	assert.equal(dbs.DB.prepare('SELECT merged_source FROM dict_exports').get()?.merged_source, 'sample-2');

	// Until production follows, a further publish or export is refused.
	assert.throws(() => publish(db, next, true, log), /Beta reads slot b, production slot a/);
	switchSlot(db, 'production', undefined, true, log);
	out.length = 0;
	status(db, log);
	assert.match(out[1], /^slot b: build sample-2, .*← beta, production$/);
});

test('publish refuses an incomplete build and leaves the sites alone', () => {
	const dir = mkdtempSync(join(tmpdir(), 'myordbok-data-'));
	const dbs = { DB: sqlite(MIGRATION), DICT_A: sqlite(), DICT_B: sqlite() };
	const broken = join(dir, 'broken.sql');
	writeFileSync(broken, SAMPLE.replace("('rows.eng_word', '21')", "('rows.eng_word', '22')"));
	assert.throws(() => publish(runner(dbs), broken, true, () => {}), /eng_word: 21 rows, meta says 22/);
	assert.equal(dbs.DB.prepare('SELECT count(*) AS n FROM dict_release').get()?.n, 0);
});

test('database ids: placeholders and non-ids are refused, setup fills every environment', () => {
	// wrangler.toml as shipped before setup: dictionary ids are placeholders.
	const toml = setDatabaseIds(readFileSync(join(import.meta.dirname, '..', 'wrangler.toml'), 'utf8'), {
		DICT_A: '00000000-0000-0000-0000-00000000000a',
		DICT_B: '00000000-0000-0000-0000-00000000000b',
	});
	assert.equal(badDatabaseIds(toml).length, 2);
	assert.deepEqual(badDatabaseIds('[[d1_databases]]\nbinding = "DICT_A"\ndatabase_name = "myordbok-dict-a"\ndatabase_id = "<id of dict-a>"\n'), ['DICT_A (myordbok-dict-a): "<id of dict-a>"']);
	const a = '11111111-2222-3333-4444-555555555555';
	const b = '66666666-7777-8888-9999-000000000000';
	const filled = setDatabaseIds(toml, { DICT_A: a, DICT_B: b });
	assert.deepEqual(badDatabaseIds(filled), []);
	assert.equal(filled.split(a).length - 1, 3);
	assert.equal(filled.split(b).length - 1, 3);
	assert.equal(filled.split('526dfd31-5d80-40ce-82aa-8f9c94e27456').length, toml.split('526dfd31-5d80-40ce-82aa-8f9c94e27456').length);
	assert.equal(setDatabaseIds(filled.replaceAll(a, '<id of dict-a>'), { DICT_A: a, DICT_B: b }), filled);
	assert.throws(() => setDatabaseIds(toml, { DICT_A: 'nope' }), /Not a database id/);
});
