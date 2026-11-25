#!/usr/bin/env node
// @ts-check
/**
 * The apps' splash: the MyOrdbok logo in the middle, "Myanmar dictionary"
 * near the bottom, on the app's own ground, light or dark with the phone
 * (src-tauri/splash/README.md).
 *
 *   node scripts/splash.js render [--apply]
 *       Draws the pictures from src-tauri/splash/logo.svg and logo-dark.svg
 *       into src-tauri/splash/ios and src-tauri/splash/android (PNG at the
 *       sizes each system asks for). Needs Playwright, which is not a
 *       dependency of the project: installed globally (`npm i -g playwright`)
 *       and named by PLAYWRIGHT=$(npm root -g)/playwright/index.mjs. Run by
 *       hand when the logo or the colours change; the pictures are committed.
 *
 *   node scripts/splash.js install ios|android [--apply]
 *       Puts the splash into the native project the Tauri CLI made
 *       (src-tauri/gen/apple, src-tauri/gen/android), after
 *       `tauri ios init` or `tauri android init`: the launch screen and its
 *       assets on iOS; the splash theme, its colours and pictures on
 *       Android. Standard library only (the CI runs it).
 *
 * Without --apply it says what it would do and changes nothing.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SPLASH = join(ROOT, 'src-tauri', 'splash');
const GEN = join(ROOT, 'src-tauri', 'gen');

/** The ground and the label, light and dark: app/styles/tokens.css (--grouped, --muted; the label dimmer at night). */
export const COLOURS = {
	light: { ground: '#f2f4f7', label: '#5b6573' },
	dark: { ground: '#0d1116', label: '#7a8594' },
};
/** The logo's width: 220 points on iOS; 176 dp on Android, the widest Android 12's splash icon circle holds. */
const IOS_LOGO_PT = 220;
const ANDROID_LOGO_DP = 176;
/** The logo's proportions (logo.svg, 1024 × 171). */
const LOGO_RATIO = 171 / 1024;

const [command, platform] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const apply = process.argv.includes('--apply');

/** @param {string} message */
function fail(message) {
	console.error(`splash: ${message}`);
	process.exit(1);
}

/**
 * Writes a file, or says it would.
 * @param {string} path
 * @param {string | Buffer} content
 */
function write(path, content) {
	console.log(`${apply ? 'write' : 'would write'} ${relative(ROOT, path)}`);
	if (!apply) return;
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content);
}

/**
 * Copies a folder's files, or says it would.
 * @param {string} from
 * @param {string} to
 */
function copyTree(from, to) {
	if (!existsSync(from)) fail(`${relative(ROOT, from)} is missing: run \`node scripts/splash.js render --apply\` and commit the pictures.`);
	for (const name of readdirSync(from)) {
		const src = join(from, name);
		const dst = join(to, name);
		if (statSync(src).isDirectory()) {
			copyTree(src, dst);
			continue;
		}
		console.log(`${apply ? 'copy' : 'would copy'} ${relative(ROOT, src)} → ${relative(ROOT, dst)}`);
		if (!apply) continue;
		mkdirSync(dirname(dst), { recursive: true });
		copyFileSync(src, dst);
	}
}

/** @param {string} hex  #rrggbb */
function rgb(hex) {
	const n = parseInt(hex.slice(1), 16);
	return { red: ((n >> 16) & 255) / 255, green: ((n >> 8) & 255) / 255, blue: (n & 255) / 255 };
}

/**
 * An asset catalog colour with a light and a dark appearance.
 * @param {string} light
 * @param {string} dark
 */
function colorset(light, dark) {
	/** @param {string} hex */
	const color = (hex) => {
		const c = rgb(hex);
		return { 'color-space': 'srgb', components: { red: c.red.toFixed(3), green: c.green.toFixed(3), blue: c.blue.toFixed(3), alpha: '1.000' } };
	};
	return JSON.stringify(
		{
			colors: [
				{ idiom: 'universal', color: color(light) },
				{ idiom: 'universal', appearances: [{ appearance: 'luminosity', value: 'dark' }], color: color(dark) },
			],
			info: { author: 'xcode', version: 1 },
		},
		null,
		2,
	);
}

async function render() {
	/** @type {any} */
	let playwright;
	const from = process.env.PLAYWRIGHT;
	if (!from) fail('Playwright is needed to draw the pictures: `npm i -g playwright`, then PLAYWRIGHT="$(npm root -g)/playwright/index.mjs" node scripts/splash.js render');
	try {
		playwright = await import(/** @type {string} */ (from));
	} catch (err) {
		fail(`Playwright did not load from ${from}: ${err instanceof Error ? err.message : err}`);
	}
	const svg = { light: readFileSync(join(SPLASH, 'logo.svg'), 'utf8'), dark: readFileSync(join(SPLASH, 'logo-dark.svg'), 'utf8') };
	const browser = await playwright.chromium.launch();
	const page = await browser.newPage();

	/**
	 * Draws HTML of the given size into a transparent PNG.
	 * @param {string} body
	 * @param {number} w
	 * @param {number} h
	 */
	const shot = async (body, w, h) => {
		await page.setViewportSize({ width: w, height: h });
		await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;background:transparent}</style></head><body>${body}</body></html>`);
		await page.evaluate(() => document.fonts.ready);
		return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
	};
	/** @param {'light' | 'dark'} mode @param {number} width */
	const logo = (mode, width) => svg[mode].replace(/width="1024"/, `width="${width}"`).replace(/height="171"/, `height="${(width * LOGO_RATIO).toFixed(2)}"`);
	/** @param {'light' | 'dark'} mode @param {number} scale */
	const label = (mode, scale) =>
		`<div style="width:${200 * scale}px;height:${80 * scale}px;display:flex;align-items:center;justify-content:center;font:500 ${15 * scale}px/1 Inter, 'Helvetica Neue', Arial, sans-serif;letter-spacing:${0.02 * 15 * scale}px;color:${COLOURS[mode].label}">Myanmar dictionary</div>`;

	// iOS: the logo at 1x, 2x and 3x, light and dark, in one image set.
	const set = join(SPLASH, 'ios', 'Assets', 'SplashLogo.imageset');
	/** @type {object[]} */
	const images = [];
	for (const mode of /** @type {const} */ (['light', 'dark'])) {
		for (const scale of [1, 2, 3]) {
			const w = IOS_LOGO_PT * scale;
			const h = Math.ceil(w * LOGO_RATIO);
			const name = `logo${mode === 'dark' ? '-dark' : ''}@${scale}x.png`;
			write(join(set, name), await shot(logo(mode, w), w, h));
			images.push({ idiom: 'universal', filename: name, scale: `${scale}x`, ...(mode === 'dark' ? { appearances: [{ appearance: 'luminosity', value: 'dark' }] } : {}) });
		}
	}
	write(join(set, 'Contents.json'), JSON.stringify({ images, info: { author: 'xcode', version: 1 } }, null, 2));

	// Android, at xxxhdpi (4 px a dp), the system scaling down for the rest:
	// splash_icon   Android 12+: 288 dp square, the logo 176 dp wide in its middle;
	// splash_logo   older Android: the logo alone, in the window's background;
	// splash_brand  the label, 200 × 80 dp (Android 12+'s branding image, and the older background's).
	const S = 4;
	for (const mode of /** @type {const} */ (['light', 'dark'])) {
		const dir = join(SPLASH, 'android', 'res', mode === 'dark' ? 'drawable-night-xxxhdpi' : 'drawable-xxxhdpi');
		const lw = ANDROID_LOGO_DP * S;
		const icon = `<div style="width:${288 * S}px;height:${288 * S}px;display:flex;align-items:center;justify-content:center">${logo(mode, lw)}</div>`;
		write(join(dir, 'splash_icon.png'), await shot(icon, 288 * S, 288 * S));
		write(join(dir, 'splash_logo.png'), await shot(logo(mode, lw), lw, Math.ceil(lw * LOGO_RATIO)));
		write(join(dir, 'splash_brand.png'), await shot(label(mode, S), 200 * S, 80 * S));
	}
	await browser.close();
}

function installIos() {
	const project = join(GEN, 'apple');
	if (!existsSync(join(project, 'Assets.xcassets'))) fail('src-tauri/gen/apple/Assets.xcassets is missing: run `tauri ios init` first.');
	write(join(project, 'LaunchScreen.storyboard'), readFileSync(join(SPLASH, 'ios', 'LaunchScreen.storyboard')));
	copyTree(join(SPLASH, 'ios', 'Assets'), join(project, 'Assets.xcassets'));
	write(join(project, 'Assets.xcassets', 'SplashBackground.colorset', 'Contents.json'), colorset(COLOURS.light.ground, COLOURS.dark.ground));
	write(join(project, 'Assets.xcassets', 'SplashLabel.colorset', 'Contents.json'), colorset(COLOURS.light.label, COLOURS.dark.label));
}

function installAndroid() {
	const res = join(GEN, 'android', 'app', 'src', 'main', 'res');
	if (!existsSync(join(res, 'values', 'themes.xml'))) fail('src-tauri/gen/android/app/src/main/res/values/themes.xml is missing: run `tauri android init` first.');
	copyTree(join(SPLASH, 'android', 'res'), res);
	for (const [folder, mode] of /** @type {const} */ ([['values', 'light'], ['values-night', 'dark']])) {
		write(
			join(res, folder, 'splash_colors.xml'),
			`<?xml version="1.0" encoding="utf-8"?>\n<!-- The splash's ground (scripts/splash.js). -->\n<resources>\n    <color name="splash_background">${COLOURS[mode].ground}</color>\n</resources>\n`,
		);
	}
	// Older Android: the window's own background is the splash, until the page draws.
	write(
		join(res, 'drawable', 'splash_window.xml'),
		`<?xml version="1.0" encoding="utf-8"?>
<!-- The window's background (scripts/splash.js): the splash on Android before 12, and under the page while it loads. -->
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/splash_background"/>
    <item android:gravity="center"><bitmap android:src="@drawable/splash_logo" android:gravity="center"/></item>
    <item android:gravity="bottom|center_horizontal" android:bottom="24dp"><bitmap android:src="@drawable/splash_brand" android:gravity="bottom|center_horizontal"/></item>
</layer-list>
`,
	);
	// The theme, light and dark: the same items in each (values-night replaces the whole style).
	const items = `
        <!-- The splash (scripts/splash.js). -->
        <item name="android:windowBackground">@drawable/splash_window</item>
        <item name="android:windowSplashScreenBackground" tools:targetApi="31">@color/splash_background</item>
        <item name="android:windowSplashScreenAnimatedIcon" tools:targetApi="31">@drawable/splash_icon</item>
        <item name="android:windowSplashScreenBrandingImage" tools:targetApi="31">@drawable/splash_brand</item>
`;
	for (const folder of ['values', 'values-night']) {
		const path = join(res, folder, 'themes.xml');
		if (!existsSync(path)) fail(`${relative(ROOT, path)} is missing: the Tauri CLI's Android template changed; see src-tauri/splash/README.md.`);
		const theme = readFileSync(path, 'utf8');
		if (theme.includes('windowSplashScreenBackground')) {
			console.log(`${relative(ROOT, path)} has the splash already`);
			continue;
		}
		const styles = theme.match(/<style name="Theme\.[^"]+"[^>]*>/g) ?? [];
		if (styles.length !== 1) fail(`${relative(ROOT, path)}: expected one application theme, found ${styles.length}; see src-tauri/splash/README.md.`);
		write(path, theme.replace(styles[0], styles[0] + items));
	}
}

if (command === 'render') await render();
else if (command === 'install' && platform === 'ios') installIos();
else if (command === 'install' && platform === 'android') installAndroid();
else fail('usage: node scripts/splash.js render [--apply] | install ios|android [--apply]');
if (!apply) console.log('(dry run: nothing changed; add --apply)');
