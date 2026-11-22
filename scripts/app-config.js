// @ts-check
/**
 * The app's version for a Tauri build, from package.json, as a Tauri
 * config to merge (tauri build --config <file>). Standard library only.
 *
 *   node scripts/app-config.js > src-tauri/tauri.ci.json
 *
 * The site's version "26.11.21+161" gives:
 *   version                       "26.11.21"  (what the stores show)
 *   bundle.android.versionCode    VERSION_CODE_BASE + 161
 *   bundle.iOS.bundleVersion      "1161" (the same number; CFBundleVersion)
 *
 * Android and iOS need a build number above every one uploaded before; the
 * Flutter app reached 44, and VERSION_CODE_BASE keeps every Tauri build
 * above that.
 * The build number only grows (scripts/version.js), so each release's code
 * is above the last.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
/** Above the Flutter app's last version code (44). */
export const VERSION_CODE_BASE = 1000;
/** Android's largest version code. */
const VERSION_CODE_MAX = 2100000000;

/**
 * @param {string} version  "26.11.21+161"
 */
export function appConfig(version) {
	const m = /^(\d+)\.(\d+)\.(\d+)\+(\d+)$/.exec(version);
	if (!m) throw new Error(`app-config: version "${version}" is not year.month.day+build`);
	const code = VERSION_CODE_BASE + Number(m[4]);
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
