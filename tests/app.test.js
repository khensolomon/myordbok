import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { appConfig, VERSION_CODE_BASE } from '../scripts/app-config.js';

test('app version: the store version and a version code above the Flutter app’s', () => {
	assert.deepEqual(appConfig('26.11.21+161'), { version: '26.11.21', bundle: { android: { versionCode: VERSION_CODE_BASE + 161 }, iOS: { bundleVersion: String(VERSION_CODE_BASE + 161) } } });
	assert.ok(VERSION_CODE_BASE > 44, 'above the last Flutter build');
	assert.throws(() => appConfig('26.11.21'), /year\.month\.day\+build/);
});

test('app: the Tauri project names the app and reaches only the MyOrdbok API', async () => {
	const conf = JSON.parse(await readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
	assert.equal(conf.identifier, 'com.myordbok.app', 'the store listings’ package name and bundle ID');
	assert.equal(conf.build.frontendDist, '../dist/tauri');
	assert.match(conf.bundle.iOS.developmentTeam, /^[A-Z0-9]{10}$/, 'the Apple team that signs the iOS app');
	assert.equal(conf.app.withGlobalTauri, true, 'the adapters call window.__TAURI__');
	const caps = JSON.parse(await readFile(new URL('../src-tauri/capabilities/default.json', import.meta.url), 'utf8'));
	const http = caps.permissions.find((p) => typeof p === 'object' && p.identifier === 'http:default');
	assert.deepEqual(http.allow.map((a) => a.url), ['https://myordbok.com/api/*', 'https://beta.myordbok.com/api/*']);
	const lib = await readFile(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8');
	for (const plugin of ['tauri_plugin_http', 'tauri_plugin_opener']) assert.match(lib, new RegExp(`${plugin}::init\\(\\)`));
});

test('app: the icon source is opaque, as the App Store requires', async () => {
	const png = await readFile(new URL('../src-tauri/app-icon.png', import.meta.url));
	assert.equal(png.toString('ascii', 12, 16), 'IHDR');
	assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1024, 1024], '1024 × 1024');
	assert.equal(png[25], 2, 'colour type 2: RGB, no alpha channel');
});
