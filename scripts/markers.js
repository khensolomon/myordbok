// @ts-check
/**
 * Marker entries: a few invented words, or wordings found nowhere else, put
 * into the dataset on purpose (in the private data build, never in this
 * repository), so that a copy of the dictionary shows itself. This finds them.
 *
 *   node scripts/markers.js --markers PATH --file SUSPECT    a saved page or dump
 *   node scripts/markers.js --markers PATH --url URL         a page on the web
 *
 * PATH is a private text file, one marker per line: the exact text that only
 * MyOrdbok has (an invented headword, or a definition's unusual wording);
 * lines starting with # are notes. Matching ignores case and runs of spaces.
 * Exit status: 0 when no marker is found, 3 when any is; read only either way.
 */
import { readFileSync } from 'node:fs';

/** @param {string} s */
const norm = (s) => s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ');

/**
 * The markers found in a text.
 * @param {string[]} markers
 * @param {string} text
 */
export function findMarkers(markers, text) {
	const hay = norm(text);
	return markers.filter((m) => hay.includes(norm(m)));
}

/** @param {string} body */
export function readMarkers(body) {
	return body
		.split('\n')
		.map((l) => l.trim())
		.filter((l) => l && !l.startsWith('#'));
}

/** @param {string[]} argv */
async function main(argv) {
	const arg = (/** @type {string} */ name) => {
		const i = argv.indexOf(name);
		return i < 0 ? null : (argv[i + 1] ?? null);
	};
	const path = arg('--markers');
	const file = arg('--file');
	const url = arg('--url');
	if (!path || (!file && !url)) throw new Error('Usage: node scripts/markers.js --markers PATH (--file SUSPECT | --url URL)');
	const markers = readMarkers(readFileSync(path, 'utf8'));
	if (!markers.length) throw new Error(`${path} holds no markers`);
	let text;
	if (file) text = readFileSync(file, 'utf8');
	else {
		const res = await fetch(/** @type {string} */ (url));
		if (!res.ok) throw new Error(`${url} answered ${res.status}`);
		text = await res.text();
	}
	const found = findMarkers(markers, text);
	console.log(`${found.length} of ${markers.length} markers found in ${file ?? url}`);
	for (const m of found) console.log(`  found: ${m}`);
	process.exitCode = found.length ? 3 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main(process.argv.slice(2)).catch((err) => {
		console.error(err instanceof Error ? err.message : err);
		process.exitCode = 1;
	});
}
