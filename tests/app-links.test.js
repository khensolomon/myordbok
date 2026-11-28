// @ts-check
/**
 * The website's links that open in the apps: the site's two files, the
 * Tauri configuration that claims the same pages, and the path the app
 * shows for a link.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_ID, APP_LINK_HOST, APP_LINK_PATHS, APPLE_TEAM_ID, PLAY_SIGNING_SHA256, appLinkPath } from '../shared/stores.js';
import { appLinkFile, appSiteAssociation, assetLinks } from '../worker/routes/app-links.js';
import { ROUTES } from '../app/core/routes.js';

test('the Tauri configuration claims the pages shared/stores.js names, as verified links', () => {
	const conf = JSON.parse(readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
	const mobile = conf.plugins['deep-link'].mobile;
	assert.equal(mobile.length, 1);
	assert.deepEqual(mobile[0], { scheme: ['https'], host: APP_LINK_HOST, pathPrefix: [...APP_LINK_PATHS], appLink: true });
	assert.equal(conf.identifier, APP_ID);
	assert.equal(conf.bundle.iOS.developmentTeam, APPLE_TEAM_ID);
});

test('each page claimed is one of the app\'s, and none of sign-in, the workspace or the account', () => {
	const paths = new Set(ROUTES.map((r) => r.path));
	for (const p of APP_LINK_PATHS) assert.ok(paths.has(p), p);
	for (const kept of ['/', '/link', '/workspace', '/account', '/privacy', '/support', '/more']) assert.ok(!APP_LINK_PATHS.includes(kept), kept);
});

test('apple-app-site-association names the app and each page with what is under it', async () => {
	const res = appLinkFile('/.well-known/apple-app-site-association');
	assert.ok(res);
	assert.equal(res.status, 200);
	assert.match(res.headers.get('content-type') ?? '', /^application\/json/);
	const body = await res.json();
	assert.deepEqual(body, appSiteAssociation());
	const [detail] = body.applinks.details;
	assert.deepEqual(detail.appIDs, ['AY23P8UZ8P.com.myordbok.app']);
	assert.ok(detail.components.some((/** @type {any} */ c) => c['/'] === '/definition'));
	assert.ok(detail.components.some((/** @type {any} */ c) => c['/'] === '/grammar/*'));
});

test('assetlinks.json: served with the Play signing fingerprints, a 404 until there are any', async () => {
	const res = appLinkFile('/.well-known/assetlinks.json');
	assert.ok(res);
	if (!PLAY_SIGNING_SHA256.length) {
		assert.equal(res.status, 404);
		return;
	}
	for (const f of PLAY_SIGNING_SHA256) assert.match(f, /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
	assert.equal(res.status, 200);
	assert.deepEqual(await res.json(), assetLinks());
	assert.equal(assetLinks()[0].target.package_name, 'com.myordbok.app');
});

test('other addresses under .well-known are not these', () => {
	assert.equal(appLinkFile('/.well-known/security.txt'), null);
});

test('the app shows a website link as its own page, query and fragment kept', () => {
	assert.equal(appLinkPath('https://myordbok.com/definition?q=love'), '/definition?q=love');
	assert.equal(appLinkPath('https://myordbok.com/definition/?q=love#n-1'), '/definition?q=love#n-1');
	assert.equal(appLinkPath('https://myordbok.com/grammar/noun#s-2'), '/grammar/noun#s-2');
	assert.equal(appLinkPath('https://myordbok.com/practice'), '/practice');
});

test('the app leaves alone other sites and the pages the website keeps', () => {
	assert.equal(appLinkPath('https://myordbok.com/link?code=X'), null);
	assert.equal(appLinkPath('https://myordbok.com/workspace'), null);
	assert.equal(appLinkPath('https://myordbok.com/'), null);
	assert.equal(appLinkPath('https://myordbok.com/definitions'), null);
	assert.equal(appLinkPath('https://beta.myordbok.com/definition?q=love'), null);
	assert.equal(appLinkPath('http://myordbok.com/definition?q=love'), null);
	assert.equal(appLinkPath('https://evil.example/definition?q=love'), null);
	assert.equal(appLinkPath('not a url'), null);
});

test('the Worker answers apple-app-site-association itself, without a redirect', async () => {
	const { default: worker } = await import('../worker/index.js');
	const res = await worker.fetch(new Request('https://myordbok.test/.well-known/apple-app-site-association'), /** @type {any} */ ({}));
	assert.equal(res.status, 200);
	assert.equal((await res.json()).applinks.details[0].appIDs[0], 'AY23P8UZ8P.com.myordbok.app');
});
