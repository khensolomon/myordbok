// @ts-check
/**
 * The interface texts the app asks for: every t('…'), tx('…'), mark('…')
 * and the plural of tn('…', '…') in app/, and the data-t texts of
 * index.html. Used by tests/i18n.test.js to check app/i18n/my.js.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const STRING = String.raw`'((?:[^'\\]|\\.)*)'`;
const CALLS = new RegExp(String.raw`\b(?:t|tx|mark)\(\s*` + STRING, 'g');
const PLURAL = new RegExp(String.raw`\btn\(\s*` + STRING + String.raw`\s*,\s*` + STRING, 'g');

/** @param {string} dir */
function files(dir) {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return files(path);
		return name.endsWith('.js') && !path.endsWith(join('i18n', 'my.js')) ? [path] : [];
	});
}

/** @param {string} s */
const unescape = (s) => s.replace(/\\(.)/g, '$1');

/**
 * @param {string} root  The repository.
 * @returns {Map<string, string>}  Text → first file asking for it.
 */
export function interfaceKeys(root) {
	/** @type {Map<string, string>} */
	const keys = new Map();
	const add = (/** @type {string} */ key, /** @type {string} */ where) => {
		if (!keys.has(key)) keys.set(key, where);
	};
	for (const file of files(join(root, 'app'))) {
		const src = readFileSync(file, 'utf8');
		for (const m of src.matchAll(CALLS)) add(unescape(m[1]), file);
		// Myanmar has one form for a count: the plural's text.
		for (const m of src.matchAll(PLURAL)) add(unescape(m[2]), file);
	}
	const html = readFileSync(join(root, 'app', 'index.html'), 'utf8');
	for (const m of html.matchAll(/data-t>([^<]+)</g)) add(m[1].trim(), 'app/index.html');
	for (const m of html.matchAll(/data-t-label="([^"]+)"/g)) add(m[1], 'app/index.html');
	return keys;
}
