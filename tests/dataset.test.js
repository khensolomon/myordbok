import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { statementsModule } from '../scripts/dataset-sync.js';
import { parseStatements, search, sqliteDatabase } from '../shared/search/search.mjs';
import statements from '../shared/search/statements.js';
import { ROOT, SAMPLE, sqlite } from './helpers/d1.js';

const SQL = readFileSync(join(ROOT, 'shared/search/search.sql'), 'utf8');

test('statements.js is generated from search.sql', () => {
	assert.deepEqual({ ...statements }, parseStatements(SQL));
	const generated = statementsModule(SQL, 'khensolomon/lai dataset:myordbok/search/search.sql');
	assert.equal(readFileSync(join(ROOT, 'shared/search/statements.js'), 'utf8'), generated);
});

test('every lookup statement runs on the sample', async () => {
	const db = sqliteDatabase(sqlite(SAMPLE));
	for (const q of ['love', 'went', 'color', 'waters', 'ရေ', 'nothing']) await search(db, statements, q);
});

test('the sample is marked as a sample, never as a real build', () => {
	const db = sqlite(SAMPLE);
	assert.equal(db.prepare("SELECT value FROM meta WHERE key = 'source'").get()?.value, 'sample');
});
