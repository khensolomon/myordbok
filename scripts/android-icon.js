#!/usr/bin/env node
// @ts-check
/**
 * The Android launcher icon as an adaptive icon: one design in layers, the
 * phone cutting it to its own shape (circle, squircle, rounded square,
 * teardrop) and, from Android 13, tinting it with the wallpaper's colours
 * (themed icons). The layers:
 *
 *   background   MyOrdbok blue, #318ed7 (a colour)
 *   foreground   the white "M" (a vector drawable: sharp at every density),
 *                inside the 66 dp circle every mask keeps of the 108 dp layer
 *   monochrome   the same "M", for themed icons
 *
 * The "M" is the path in src-tauri/app-icon.svg, the iOS icon's; only its
 * size and colour differ here.
 *
 *   node scripts/android-icon.js render [--apply]
 *     src-tauri/icon/android.png      1024 px, blue with the white "M", for
 *                                     `tauri icon` (the pictures Android 7
 *                                     shows, before adaptive icons)
 *     store/play/en-US/icon/icon.png  512 px, Play's icon (Play rounds it)
 *     Needs Playwright, named by PLAYWRIGHT (as scripts/splash.js).
 *
 *   node scripts/android-icon.js install [--apply]
 *     The layers into the Android project tauri made (src-tauri/gen/android),
 *     after `tauri icon src-tauri/icon/android.png`: res/drawable/
 *     ic_launcher_foreground.xml, res/values/ic_launcher_background.xml and
 *     res/mipmap-anydpi-v26/ic_launcher{,_round}.xml.
 *
 * Without --apply it says what it would do and changes nothing.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RES = join(ROOT, 'src-tauri/gen/android/app/src/main/res');
const BLUE = '#318ed7';
/** The "M"'s width on the 108 dp layer: inside the 66 dp safe circle. */
const M_WIDTH = 44;
/** The path's own box (units of app-icon.svg's path), and its optical centre. */
const PATH_WIDTH = 838.35;
const PATH_CENTRE = [516.57, 551.95];
/** The "M" sits a little below the middle, as on the iOS icon. */
const LOWER = 0.6;

const apply = process.argv.includes('--apply');

/** @param {string} message @returns {never} */
function fail(message) {
	console.error(`android-icon: ${message}`);
	process.exit(1);
}

/** @param {string} path @param {string | Buffer} content */
function write(path, content) {
	console.log(`${apply ? 'write' : 'would write'} ${relative(ROOT, path)}`);
	if (!apply) return;
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content);
}

const source = readFileSync(join(ROOT, 'src-tauri/app-icon.svg'), 'utf8');
const d = /<path[^>]* d="([^"]+)"/.exec(source)?.[1];
if (!d) fail('src-tauri/app-icon.svg has no path for the "M"');

const scale = M_WIDTH / PATH_WIDTH;
const tx = 54 - PATH_CENTRE[0] * scale;
const ty = 54 + LOWER - PATH_CENTRE[1] * scale;

/** The 108-unit layer as SVG: the "M" in white, on blue or on nothing. */
const layer = (/** @type {boolean} */ withBlue) =>
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">${withBlue ? `<rect width="108" height="108" fill="${BLUE}"/>` : ''}<path fill="#ffffff" transform="translate(${tx.toFixed(4)} ${ty.toFixed(4)}) scale(${scale.toFixed(6)})" d="${d}"/></svg>`;

/** The visible part of the layer (the middle 72 units), full-bleed: what a store or Android 7 shows. */
const square = (/** @type {number} */ px) => layer(true).replace('viewBox="0 0 108 108"', `viewBox="18 18 72 72" width="${px}" height="${px}"`);

const foreground = `<?xml version="1.0" encoding="utf-8"?>
<!-- Written by scripts/android-icon.js: the white "M" of the adaptive icon. -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <group
        android:translateX="${tx.toFixed(4)}"
        android:translateY="${ty.toFixed(4)}"
        android:scaleX="${scale.toFixed(6)}"
        android:scaleY="${scale.toFixed(6)}">
        <path
            android:fillColor="#FFFFFF"
            android:pathData="${d}" />
    </group>
</vector>
`;
const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<!-- Written by scripts/android-icon.js. -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
    <monochrome android:drawable="@drawable/ic_launcher_foreground" />
</adaptive-icon>
`;
const background = `<?xml version="1.0" encoding="utf-8"?>
<!-- Written by scripts/android-icon.js: MyOrdbok blue. -->
<resources>
    <color name="ic_launcher_background">${BLUE}</color>
</resources>
`;

const [command] = process.argv.slice(2);
if (command === 'install') {
	if (!existsSync(RES)) fail(`no Android project at ${relative(ROOT, RES)}: run \`tauri android init\` first`);
	write(join(RES, 'drawable/ic_launcher_foreground.xml'), foreground);
	write(join(RES, 'values/ic_launcher_background.xml'), background);
	write(join(RES, 'mipmap-anydpi-v26/ic_launcher.xml'), adaptive);
	write(join(RES, 'mipmap-anydpi-v26/ic_launcher_round.xml'), adaptive);
} else if (command === 'render') {
	const from = process.env.PLAYWRIGHT;
	if (!from) fail('Playwright is needed to draw the pictures: PLAYWRIGHT="$(npm root -g)/playwright/index.mjs" node scripts/android-icon.js render');
	const { chromium } = await import(from);
	const browser = await chromium.launch();
	const page = await browser.newPage();
	/** @param {number} px */
	const png = async (px) => {
		await page.setViewportSize({ width: px, height: px });
		await page.setContent(`<!doctype html><style>html,body{margin:0}svg{display:block}</style>${square(px)}`);
		return page.screenshot({ clip: { x: 0, y: 0, width: px, height: px } });
	};
	write(join(ROOT, 'src-tauri/icon/android.png'), await png(1024));
	write(join(ROOT, 'store/play/en-US/icon/icon.png'), await png(512));
	await browser.close();
} else if (command === 'preview') {
	// The layer for a look at it in the masks (not written anywhere kept).
	process.stdout.write(layer(true));
} else {
	fail('usage: node scripts/android-icon.js render|install [--apply]');
}
