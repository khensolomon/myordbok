// @ts-check
/**
 * The app's version for a Tauri build, from package.json, as a Tauri
 * config to merge (tauri build --config <file>). Standard library only.
 *
 *   node scripts/app-config.js > src-tauri/tauri.ci.json
 *
 * The site's version "26.11.26+1210" gives:
 *   version                       "26.11.26"  (what the stores show)
 *   bundle.android.versionCode    1210        (the change number itself)
 *   bundle.iOS.bundleVersion      "1210"      (the same; CFBundleVersion)
 *
 * Android and iOS need a build number above every one uploaded before. The
 * change number only grows (scripts/version.js) and is at least STORE_FLOOR
 * (shared/version.js), above every build the stores had before it became
 * the build number; a version below it is refused here.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { STORE_FLOOR } from '../shared/version.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
/** Android's largest version code. */
const VERSION_CODE_MAX = 2100000000;

/**
 * @param {string} version  "26.11.21+161"
 */
export function appConfig(version) {
	const m = /^(\d+)\.(\d+)\.(\d+)\+(\d+)$/.exec(version);
	if (!m) throw new Error(`app-config: version "${version}" is not year.month.day+build`);
	const code = Number(m[4]);
	if (code < STORE_FLOOR) throw new Error(`app-config: build ${code} is below ${STORE_FLOOR}, where the stores' numbers are (shared/version.js): move the version on first (node scripts/version.js)`);
	if (code > VERSION_CODE_MAX) throw new Error(`app-config: version code ${code} is above Android's largest`);
	return { version: `${m[1]}.${m[2]}.${m[3]}`, bundle: { android: { versionCode: code }, iOS: { bundleVersion: String(code) } } };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
	try {
		console.log(JSON.stringify(appConfig(pkg.version), null, '\t'));
	} catch (err) {
		console.error(err instanceof Error ? err.message : String(err));
		process.exit(1);
	}
}
