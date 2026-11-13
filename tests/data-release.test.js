import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promote, publish } from '../scripts/data.js';
import { changelogEntry, release, summary, withEntry } from '../scripts/data-release.js';
import { MIGRATION, SAMPLE, runner, sqlite } from './helpers/d1.js';

const git = (/** @type {string} */ cwd, /** @type {string[]} */ ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

/**
 * A dataset checkout as the release sees it: a git repository on branch
 * dataset with a myordbok folder whose scripts stand in for the real ones.
 * emd_edit.py appends each patch line to emd_sense.tsv when applied, and
 * fails on a line whose new value is "boom"; db_build.py writes the build.
 */
function fakeDataset(root, buildFails = false) {
	const repo = join(root, 'lai');
	const dataset = join(repo, 'myordbok');
	mkdirSync(join(dataset, 'scripts'), { recursive: true });
	writeFileSync(join(repo, '.gitignore'), 'build/\n__pycache__/\n');
	writeFileSync(join(dataset, 'emd_sense.tsv'), 'id\twrid\tsense\r\n1\t1\tstale\r\n');
	writeFileSync(join(dataset, 'CHANGELOG.md'), '# Changelog\r\n\r\n## 2026-11-07 (earlier)\r\n- Something.\r\n');
	writeFileSync(
		join(dataset, 'scripts', 'emd_edit.py'),
		`import sys, pathlib
here = pathlib.Path(__file__).resolve().parent.parent
lines = pathlib.Path(sys.argv[1]).read_text(encoding='utf-8').splitlines()[1:]
if any(l.split('\\t')[3] == 'boom' for l in lines): sys.exit('emd_edit: old value does not match')
if '--apply' in sys.argv:
    with open(here / 'emd_sense.tsv', 'a', encoding='utf-8', newline='') as f:
        for l in lines: f.write('patched\\t' + l + '\\r\\n')
print('ok')
`,
	);
	writeFileSync(
		join(dataset, 'scripts', 'db_build.py'),
		`import sys, pathlib
here = pathlib.Path(__file__).resolve().parent.parent
${buildFails ? "sys.exit('search check failed: love')" : ''}
(here / 'build').mkdir(exist_ok=True)
(here / 'build' / 'myordbok.sql').write_text(${JSON.stringify(SAMPLE.replace("('built', 'sample')", "('built', 'sample-2')"))}, encoding='utf-8')
print('75 search checks passed')
`,
	);
	git(repo, 'init', '--quiet', '--initial-branch', 'dataset');
	git(repo, 'config', 'user.name', 'Test');
	git(repo, 'config', 'user.email', 'test@example.com');
	git(repo, 'add', '--all');
	git(repo, 'commit', '--quiet', '-m', 'start');
	return { repo, dataset };
}

/** Databases with the sample build on beta and production, and approved edits. */
function databases() {
	const dir = mkdtempSync(join(tmpdir(), 'myordbok-rel-'));
	const dbs = { APP: sqlite(MIGRATION), DATASET: sqlite(), DICTIONARY: sqlite() };
	const db = runner(dbs);
	const file = join(dir, 'sample.sql');
	writeFileSync(file, SAMPLE);
	publish(db, file, true, () => {});
	return promote(db, file, true, () => {}, { waitMs: 0 }).then(() => {
		dbs.APP.exec(`INSERT INTO users (id, name, role) VALUES (1, 'Editor', 'editor');
			INSERT INTO dict_edits (user_id, dict, action, sense_id, field, old_value, new_value, word, status, created_at) VALUES
			(1, 'emd', 'edit', 7, 'exam', 'a glass of water', 'a cup of water', 'water', 'approved', 1),
			(1, 'emd', 'edit', 6, 'sense', 'stale', 'x', 'colour', 'approved', 2)`);
		return { dir, dbs, db };
	});
}

const states = (app) => app.prepare('SELECT status FROM dict_edits ORDER BY id').all().map((r) => r.status);

test('changelog entry in the dataset’s style, at the top', () => {
	const entry = changelogEntry('2026-11-13', 7, { changed: 2, added: 1, deleted: 0 }, ['water', 'love']);
	assert.equal(entry, '## 2026-11-13 (workspace edits, export 0007)\n- Approved in the MyOrdbok workspace: 2 sense edits, 1 sense added; `water`, `love`.\n');
	assert.equal(withEntry('# Changelog\r\n\r\n## 2026-11-07 (x)\r\n- y\r\n', entry), '# Changelog\r\n\r\n## 2026-11-13 (workspace edits, export 0007)\r\n- Approved in the MyOrdbok workspace: 2 sense edits, 1 sense added; `water`, `love`.\r\n\r\n## 2026-11-07 (x)\r\n- y\r\n');
	const many = changelogEntry('2026-11-13', 1, { changed: 20, added: 0, deleted: 0 }, Array.from({ length: 15 }, (_, i) => `w${i}`));
	assert.match(many, /`w11` and 3 more\.\n$/);
	assert.deepEqual(summary({ files: { 'emd_patch.tsv': { header: ['id', 'field', 'old', 'new'], rows: [[1, 'sense', 'a', 'b'], [2, 'delete', 'w', '\\N']] }, 'emd_new.tsv': { header: ['word'], rows: [['x']] } }, exported: [], conflicts: [] }), { changed: 1, added: 1, deleted: 1 });
});

test('release: a dry run runs the scripts without --apply and changes nothing', async () => {
	const { dir, dbs, db } = await databases();
	const { dataset } = fakeDataset(dir);
	const out = [];
	await release({ db, dataset, apply: false, log: (l) => out.push(l), fetch: false, push: false, ask: async () => assert.fail('a dry run asks nothing') });
	assert.ok(out.some((l) => /scripts\/emd_edit\.py emd_patch\.tsv: passes/.test(l)));
	assert.ok(out.some((l) => /conflict, left in the workspace: edit 2/.test(l)));
	assert.equal(git(dataset, 'status', '--porcelain'), '');
	assert.deepEqual(states(dbs.APP), ['approved', 'approved']);
});

test('release: answered no, the dataset is put back and no edit is marked', async () => {
	const { dir, dbs, db } = await databases();
	const { dataset } = fakeDataset(dir);
	let asked = '';
	await release({ db, dataset, apply: true, log: () => {}, fetch: false, push: false, ask: async (q) => ((asked = q), false), beta: async () => assert.fail('no publish') });
	assert.match(asked, /Commit to the dataset and publish to beta\?/);
	assert.equal(git(dataset, 'status', '--porcelain'), '');
	assert.deepEqual(states(dbs.APP), ['approved', 'approved']);
	assert.equal(dbs.APP.prepare('SELECT count(*) AS n FROM dict_exports').get().n, 0);
});

test('release: answered yes, the dataset is committed with a CHANGELOG entry, and the build goes to beta', async () => {
	const { dir, dbs, db } = await databases();
	const { dataset } = fakeDataset(dir);
	let published = '';
	const out = [];
	await release({ db, dataset, apply: true, log: (l) => out.push(l), fetch: false, push: false, ask: async () => true, beta: async (file) => void (published = file), today: '2026-11-13' });
	assert.equal(published, join(dataset, 'build', 'myordbok.sql'));
	assert.equal(git(dataset, 'status', '--porcelain'), '');
	assert.equal(git(dataset, 'log', '-1', '--format=%s'), 'Workspace edits, export 0001: 1 changed');
	assert.match(readFileSync(join(dataset, 'emd_sense.tsv'), 'utf8'), /patched\t7\texam\ta glass of water\ta cup of water/);
	assert.match(readFileSync(join(dataset, 'CHANGELOG.md'), 'utf8'), /^# Changelog\r\n\r\n## 2026-11-13 \(workspace edits, export 0001\)\r\n- Approved in the MyOrdbok workspace: 1 sense edit; `water`\.\r\n\r\n## 2026-11-07/);
	assert.deepEqual(states(dbs.APP), ['exported', 'conflict']);
	assert.ok(out.some((l) => /75 search checks passed/.test(l)));
});

test('release: a failing script or build stops it, puts the dataset back, marks nothing', async () => {
	const { dir, dbs, db } = await databases();
	const { dataset } = fakeDataset(dir, true);
	await assert.rejects(release({ db, dataset, apply: true, log: () => {}, fetch: false, push: false, ask: async () => true }), /search check failed: love/);
	assert.equal(git(dataset, 'status', '--porcelain'), '');
	assert.deepEqual(states(dbs.APP), ['approved', 'approved']);

	const again = await databases();
	const second = fakeDataset(again.dir);
	again.dbs.APP.exec("UPDATE dict_edits SET new_value = 'boom' WHERE id = 1");
	await assert.rejects(release({ db: again.db, dataset: second.dataset, apply: false, log: () => {}, fetch: false, push: false }), /old value does not match/);
});

test('release: only from the dataset branch, clean', async () => {
	const { dir, db } = await databases();
	const { repo, dataset } = fakeDataset(dir);
	writeFileSync(join(dataset, 'emd_sense.tsv'), 'changed by hand\r\n');
	await assert.rejects(release({ db, dataset, apply: false, log: () => {}, fetch: false }), /uncommitted changes/);
	git(repo, 'checkout', '--quiet', '--', '.');
	git(repo, 'checkout', '--quiet', '-b', 'main');
	await assert.rejects(release({ db, dataset, apply: false, log: () => {}, fetch: false }), /on branch main; releases are built from dataset/);
	await assert.rejects(release({ db, dataset: dir, apply: false, log: () => {}, fetch: false }), /not the dataset's myordbok folder/);
});
