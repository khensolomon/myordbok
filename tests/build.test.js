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
	const precache = JSON.parse(/PRECACHE\s*=\s*(\[.*?\])[;,]/.exec(sw)?.[1] ?? '[]');
	assert.ok(precache.some((u) => /^\/main\.[0-9a-f]{8}\.js$/.test(u)));
	assert.ok(precache.includes('/manifest.webmanifest'));
	assert.ok(!precache.some((u) => u.startsWith('/workspace/')));
	assert.doesNotMatch(sw, /VERSION\s*=\s*['"]dev['"]/);
	assert.ok(precache.length > 20, 'the shell is listed');
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
	await assert.rejects(readFile(join(out, '_headers')), 'live build has no noindex rule');
});

test('tauri build stops until its adapters exist', async () => {
	await assert.rejects(build({ target: 'tauri', out: join(out, 'tauri') }), /app\/platform\/tauri\/ is missing/);
});

test('web build minifies each module, with a source map beside it', async () => {
	const html = await readFile(join(out, 'index.html'), 'utf8');
	const map = JSON.parse(/<script type="importmap">(.*?)<\/script>/.exec(html)?.[1] ?? '{}');
	const file = map.imports['/core/router.js'];
	const code = await readFile(join(out, file), 'utf8');
	const source = await readFile(join(import.meta.dirname, '..', 'app', 'core', 'router.js'), 'utf8');

	assert.ok(code.length < source.length * 0.7, `${file} is minified`);
	assert.doesNotMatch(code, /^\s*\*|\/\*\*|@ts-check/m, 'comments are gone');
	assert.match(code, /\bexport\b/, 'still a module, with its exports');
	const name = file.split('/').pop();
	assert.ok(code.endsWith(`//# sourceMappingURL=${name}.map\n`));
	const sourceMap = JSON.parse(await readFile(join(out, `${file}.map`), 'utf8'));
	assert.deepEqual(sourceMap.sources, ['/core/router.js']);
	assert.equal(sourceMap.sourcesContent[0], source, 'the map carries the source as written');

	// Myanmar text stays as written, not as \u escapes.
	const my = await readFile(join(out, map.imports['/i18n/my.js']), 'utf8');
	assert.match(my, /[က-႟]/);

	const sw = await readFile(join(out, 'sw.js'), 'utf8');
	assert.doesNotMatch(sw, /^\/\//m, 'the service worker is minified too');
	assert.doesNotMatch(sw, /\.map"/, 'source maps are never precached');
});

test('a module that does not parse stops the build, naming the file', async () => {
	const { minify } = await import('../scripts/build.js');
	await assert.rejects(minify('export const = 1;', '/core/broken.js'), /cannot minify \/core\/broken\.js/);
	const plain = join(out, 'plain');
	await build({ target: 'web', out: plain, minify: false });
	const html = await readFile(join(plain, 'index.html'), 'utf8');
	const router = JSON.parse(/<script type="importmap">(.*?)<\/script>/.exec(html)?.[1] ?? '{}').imports['/core/router.js'];
	assert.match(await readFile(join(plain, router), 'utf8'), /@ts-check/, '--no-minify keeps the files as written');
	await assert.rejects(readFile(join(plain, `${router}.map`)));
});
