import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { test } from 'node:test';

const dir = (name) => new URL(`../app/platform/${name}/`, import.meta.url);
const modules = async (name) => (await readdir(dir(name)).catch(() => [])).filter((f) => f.endsWith('.js')).sort();

test('every Tauri adapter exports the same names as its web counterpart', async (t) => {
	const tauri = await modules('tauri');
	if (!tauri.length) return t.skip('no Tauri adapters yet');
	assert.deepEqual(tauri, await modules('web'), 'adapter files differ');
	for (const file of tauri) {
		const web = Object.keys(await import(new URL(file, dir('web')).href)).sort();
		const native = Object.keys(await import(new URL(file, dir('tauri')).href)).sort();
		assert.deepEqual(native, web, `${file} exports differ`);
	}
});
