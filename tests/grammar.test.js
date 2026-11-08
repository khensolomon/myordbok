import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { grammarFiles, grammarSlug, markdownBlocks } from '../scripts/grammar-data.js';

/** A small grammar folder: structure, context, topics, pos-en.md. */
function fixture(topics, order = Object.keys(topics)) {
	const dir = mkdtempSync(join(tmpdir(), 'myordbok-grammar-'));
	writeFileSync(join(dir, 'structure.json'), JSON.stringify({ structure: { file: [{ id: 'pos', child: order }] } }));
	writeFileSync(join(dir, 'context.json'), JSON.stringify({ name: 'သဒ္ဒါ', desc: 'd', kind: [] }));
	writeFileSync(join(dir, 'pos-en.md'), '# PARTS\n\nText.');
	for (const [name, data] of Object.entries(topics)) writeFileSync(join(dir, `pos-${grammarSlug(name)}.json`), JSON.stringify(data));
	return dir;
}
const topic = (name, status = 1, extra = {}) => ({ info: { name, status }, root: { name: `${name}-my`, desc: 'd' }, ...extra });

test('slugs follow the English name', () => {
	assert.equal(grammarSlug('Part of speech'), 'part-of-speech');
	assert.equal(grammarSlug('Noun'), 'noun');
});

test('the real grammar builds: every topic listed, in order, grouped', async () => {
	const files = await grammarFiles();
	const index = JSON.parse(files.get('/data/grammar/index.json'));
	assert.equal(index.topics.length, 18);
	assert.equal(index.topics.filter((t) => t.group === 'pos').length, 9);
	assert.equal(index.topics[0].slug, 'noun');
	for (const t of index.topics) assert.ok(files.has(`/data/grammar/${t.slug}.json`), t.slug);
	assert.ok(JSON.parse(files.get('/data/grammar/part-of-speech.json')).english.length > 5);
});

test('markdown: headings, quotes and paragraphs', () => {
	assert.deepEqual(markdownBlocks('# A\n\n## B\n\n> x... y\n\nOne\nline.'), [
		{ type: 'h1', text: 'A' },
		{ type: 'h2', text: 'B' },
		{ type: 'quote', text: 'x... y' },
		{ type: 'p', text: 'One line.' },
	]);
});

test('malformed grammar stops with the file named', async () => {
	await assert.rejects(grammarFiles(fixture({ Noun: { info: { name: 'Noun', status: 1 }, root: {} } })), /pos-noun\.json: root\.name is missing/);
	await assert.rejects(grammarFiles(fixture({ Noun: topic('Noun', 1, { kind: [{ root: { name: '' } }] }) })), /pos-noun\.json › kind\[0\]: root\.name is missing/);
	await assert.rejects(grammarFiles(fixture({ Noun: topic('Noun', 1, { exam: [{ form: [{ row: [] }] }] }) })), /exam\[0\]\.form\[0\] needs title and row/);
	await assert.rejects(grammarFiles(fixture({ Noun: topic('Noun'), Verb: topic('Verb') }, ['noun'])), /pos-verb\.json not listed in structure\.json/);
	await assert.rejects(grammarFiles(fixture({ Noun: topic('Noun') }, ['noun', 'verb'])), /lists "verb" but pos-verb\.json does not exist/);
});
