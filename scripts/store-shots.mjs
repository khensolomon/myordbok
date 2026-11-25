#!/usr/bin/env node
/**
 * Store screenshots, taken of the app itself: the tauri build (dist/tauri),
 * served here and shown in Chromium as each device shows it, its server
 * answering through --from. The app's native side is stood in for: the
 * store's products, the haptics and the back swipe answer as on a phone,
 * and nothing leaves for a store.
 *
 *   make store-shots            (the local server, with a real build loaded:
 *                                make data-local FILE=…/build/myordbok.sql)
 *   node scripts/store-shots.mjs [--from http://localhost:8787] [--only play-phone]
 *
 * The live server is reachable from a home connection; from GitHub's
 * runners Cloudflare answers with a challenge page, so the shots are taken
 * on a machine of one's own. Playwright is not a dependency of MyOrdbok:
 * PLAYWRIGHT names its module (as scripts/splash.js). Play takes phones at
 * 9:16 and tablets at 9:16 or 16:9; the App Store takes the 6.9" iPhone and
 * the 13" iPad sizes.
 *
 * Writes, for each set below, store/<store>/<language>/<set folder>/NN-<shot>.png;
 * scripts/play-listing.js sends the Play ones.
 */
import { createServer } from 'node:http';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { extname, join } from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');

const ROOT = new URL('..', import.meta.url).pathname;
const DIST = join(ROOT, 'dist/tauri');
const option = (/** @type {string} */ name) => {
	const i = process.argv.indexOf(name);
	return i > -1 ? process.argv[i + 1] : undefined;
};
const FROM = option('--from') ?? 'http://localhost:8787';
const ONLY = option('--only');

const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

/**
 * Each set: the store's folder, the screen in CSS pixels and its scale
 * (the image is their product), and the phone it says it is.
 */
const SETS = [
	{ id: 'play-phone', dir: 'play/en-US/phoneScreenshots', width: 360, height: 640, scale: 3, agent: ANDROID, mobile: true },
	{ id: 'play-tablet-7', dir: 'play/en-US/sevenInchScreenshots', width: 600, height: 1067, scale: 2, agent: ANDROID.replace(' Mobile', ''), mobile: true },
	{ id: 'play-tablet-10', dir: 'play/en-US/tenInchScreenshots', width: 1120, height: 630, scale: 2, agent: ANDROID.replace(' Mobile', ''), mobile: true },
	{ id: 'ios-phone', dir: 'app-store/en-US/iphone-6.9', width: 440, height: 956, scale: 3, agent: IPHONE, mobile: true },
	{ id: 'ios-tablet', dir: 'app-store/en-US/ipad-13', width: 1032, height: 1376, scale: 2, agent: IPAD, mobile: true },
	// For App Review of the in-app purchases: where they are offered (not a
	// store page; uploaded on each purchase's page in App Store Connect).
	{ id: 'ios-review', dir: 'app-store/review', width: 440, height: 956, scale: 3, agent: IPHONE, mobile: true, shots: ['support'] },
];

/**
 * The shots, in the order the store shows them.
 * @type {{ name: string, path: string, dark?: boolean, act?: (page: import('playwright').Page) => Promise<void> }[]}
 */
const SHOTS = [
	{ name: 'home', path: '/' },
	{ name: 'english', path: '/definition?q=love' },
	{ name: 'myanmar', path: '/definition?q=%E1%80%81%E1%80%BB%E1%80%85%E1%80%BA' },
	{
		name: 'suggest',
		path: '/',
		act: async (page) => {
			await page.locator('input[type="search"]').first().click();
			await page.keyboard.type('beau', { delay: 60 });
			await page.waitForTimeout(1500);
		},
	},
	{ name: 'related', path: '/definition?q=happy', act: (page) => page.evaluate(() => document.querySelector('.related-family, .related-list')?.scrollIntoView({ block: 'center' })).then(() => page.waitForTimeout(600)) },
	{
		name: 'practice',
		path: '/definition?q=water',
		act: async (page) => {
			await page.locator('button', { hasText: /^Start$/ }).first().click({ timeout: 8000 });
			await page.waitForTimeout(1200);
			await page.evaluate(() => document.querySelector('.quiz, [class*="quiz"]')?.scrollIntoView({ block: 'center' }));
			await page.waitForTimeout(600);
		},
	},
	{ name: 'grammar', path: '/grammar' },
	{ name: 'dark', path: '/definition?q=light', dark: true },
	{
		name: 'support',
		path: '/more',
		only: true,
		act: async (page) => {
			await page.waitForSelector('.support-price:not([disabled])', { timeout: 8000 });
			await page.evaluate(() => document.querySelector('.support-price')?.closest('section, .you-group, .you-card')?.scrollIntoView({ block: 'center' }));
			await page.waitForTimeout(600);
		},
	},
];

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
const server = createServer(async (req, res) => {
	const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
	for (const file of [join(DIST, path), join(DIST, 'index.html')]) {
		try {
			const body = await readFile(file);
			res.writeHead(200, { 'content-type': TYPES[/** @type {keyof TYPES} */ (extname(file))] ?? 'application/octet-stream' });
			return res.end(body);
		} catch {
			// The app's own paths (/definition, …) are its page.
		}
	}
	res.writeHead(404).end();
});
await new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(null)));
const port = /** @type {import('node:net').AddressInfo} */ (server.address()).port;
const index = await readFile(join(DIST, 'index.html'), 'utf8');
const API = /<meta name="mo-api" content="([^"]+)">/.exec(index)?.[1];
if (!API) throw new Error('dist/tauri/index.html names no server (mo-api): build it with --target tauri --api …');

const browser = await chromium.launch();
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, DELETE' };
let failed = 0;
for (const set of SETS.filter((s) => !ONLY || s.id === ONLY)) {
	const out = join(ROOT, 'store', set.dir);
	await rm(out, { recursive: true, force: true });
	await mkdir(out, { recursive: true });
	const shots = set.shots ? SHOTS.filter((s) => set.shots?.includes(s.name)) : SHOTS.filter((s) => !s.only);
	for (const [i, shot] of shots.entries()) {
		const ctx = await browser.newContext({ viewport: { width: set.width, height: set.height }, deviceScaleFactor: set.scale, isMobile: set.mobile, hasTouch: true, userAgent: set.agent, colorScheme: shot.dark ? 'dark' : 'light' });
		await ctx.route(`${API}/**`, async (route) => {
			const req = route.request();
			if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
			const u = new URL(req.url());
			// As the app's native requests go: no browser's Sec-Fetch-*, Origin or
			// Referer, only what the app sets (X-MyOrdbok-App).
			const headers = Object.fromEntries(Object.entries(req.headers()).filter(([k]) => !/^(sec-fetch-|origin$|referer$)/.test(k)));
			const res = await route.fetch({ url: FROM + u.pathname + u.search, headers });
			await route.fulfill({ response: res, headers: { ...res.headers(), ...cors } });
		});
		await ctx.addInitScript(() => {
			const products = [
				{ productId: 'supporter', title: 'Supporter', formattedPrice: '$2.99' },
				{ productId: 'tip_small', title: 'Small tip', formattedPrice: '$0.99' },
				{ productId: 'tip_medium', title: 'Kind tip', formattedPrice: '$4.99' },
				{ productId: 'tip_large', title: 'Generous tip', formattedPrice: '$9.99' },
			];
			/** @type {any} */ (window).__TAURI__ = {
				http: { fetch: (/** @type {any} */ u, /** @type {any} */ i) => fetch(u, i) },
				opener: { openUrl: async () => {} },
				core: {
					invoke: async (/** @type {string} */ cmd) => (cmd === 'plugin:iap|get_products' ? { products } : cmd === 'plugin:iap|restore_purchases' ? { purchases: [] } : null),
					addPluginListener: async () => ({ unregister() {} }),
				},
			};
			try {
				localStorage.setItem('mo:analytics', 'denied');
				localStorage.setItem('mo:recent', JSON.stringify(['beautiful', 'ချစ်', 'light', 'happy', 'river']));
			} catch {
				// A screenshot without them still shows the app.
			}
		});
		const page = await ctx.newPage();
		const errors = /** @type {string[]} */ ([]);
		page.on('pageerror', (e) => errors.push(e.message));
		await page.goto(`http://127.0.0.1:${port}${shot.path}`, { waitUntil: 'networkidle' });
		await page.evaluate(() => document.querySelector('.app-splash')?.remove());
		await page.waitForTimeout(1200);
		if (shot.act) await shot.act(page).catch((/** @type {Error} */ e) => errors.push(`the steps: ${e.message.split('\n')[0]}`));
		const file = join(out, `${String(i + 1).padStart(2, '0')}-${shot.name}.png`);
		await page.screenshot({ path: file });
		if (errors.length) {
			failed++;
			console.error(`${set.id} ${shot.name}: ${errors.join('; ')}`);
		}
		console.log(file.replace(ROOT, ''));
		await ctx.close();
	}
}
await browser.close();
server.close();
if (failed) process.exit(1);
