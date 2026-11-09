import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { build } from '../scripts/build.js';

const out = await mkdtemp(join(tmpdir(), 'myordbok-build-'));
after(() => rm(out, { recursive: true, force: true }));

test('web build hashes modules and maps them in the import map', async () => {
	await build({ target: 'web', out });
	const html = await readFile(join(out, 'index.html'), 'utf8');
	const map = JSON.parse(/<script type="importmap">(.*?)<\/script>/.exec(html)?.[1] ?? '{}');

	assert.match(map.imports['/core/router.js'], /^\/core\/router\.[0-9a-f]{8}\.js$/);
	assert.match(map.imports['#platform/http.js'], /^\/platform\/web\/http\.[0-9a-f]{8}\.js$/);
	assert.match(map.imports['#shared/errors.js'], /^\/shared\/errors\.[0-9a-f]{8}\.js$/);
	assert.match(html, /<script type="module" src="\/main\.[0-9a-f]{8}\.js">/);
	assert.match(html, /<meta name="mo-sw"/);
	assert.doesNotMatch(html, /modulepreload" href="\/workspace\//, 'workspace code is not preloaded');
});

test('web build precaches the shell but not the workspace', async () => {
	const sw = await readFile(join(out, 'sw.js'), 'utf8');
	const precache = JSON.parse(/const PRECACHE = (\[.*?\]);/.exec(sw)?.[1] ?? '[]');
	assert.ok(precache.some((u) => /^\/main\.[0-9a-f]{8}\.js$/.test(u)));
	assert.ok(precache.includes('/manifest.webmanifest'));
	assert.ok(!precache.some((u) => u.startsWith('/workspace/')));
	assert.doesNotMatch(sw, /const VERSION = 'dev'/);
});

test('web build leaves other platforms out', async () => {
	const dirs = await readdir(join(out, 'platform'));
	assert.deepEqual(dirs, ['web']);
});

test('beta build asks search engines not to index, without precaching the rule file', async () => {
	const beta = join(out, 'beta');
	await build({ target: 'web', out: beta, noindex: true });
	assert.equal(await readFile(join(beta, '_headers'), 'utf8'), '/*\n  X-Robots-Tag: noindex\n');
	const sw = await readFile(join(beta, 'sw.js'), 'utf8');
	assert.doesNotMatch(sw, /_headers/);
	await assert.rejects(readFile(join(out, '_headers')), 'production build has no noindex rule');
});

test('tauri build stops until its adapters exist', async () => {
	await assert.rejects(build({ target: 'tauri', out: join(out, 'tauri') }), /app\/platform\/tauri\/ is missing/);
});
