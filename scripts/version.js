// @ts-check
/**
 * Moves the version forward (yy.mm.dd+changes) and adds a CHANGELOG entry.
 * Dry run by default; nothing is written without --apply.
 *
 *   node scripts/version.js --note "Add search" --note "Fix entry layout"
 *   node scripts/version.js --note "Add search" --apply
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { nextVersion } from '../shared/version.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HEADING = '# Changelog\n';

/**
 * @param {string} changelog
 * @param {string} version
 * @param {string[]} notes
 */
export function addEntry(changelog, version, notes) {
	if (!changelog.startsWith(HEADING)) throw new Error(`CHANGELOG.md must start with "${HEADING.trim()}"`);
	if (changelog.includes(`\n## ${version}\n`)) throw new Error(`CHANGELOG.md already has ${version}`);
	const entry = `\n## ${version}\n\n${notes.map((n) => `- ${n}`).join('\n')}\n`;
	return HEADING + entry + changelog.slice(HEADING.length);
}

async function main() {
	const args = process.argv.slice(2);
	const apply = args.includes('--apply');
	/** @type {string[]} */
	const notes = [];
	args.forEach((a, i) => {
		if (a === '--note') {
			const text = args[i + 1];
			if (!text || text.startsWith('--')) throw new Error('--note needs text after it');
			notes.push(text);
		}
	});
	if (!notes.length) throw new Error('Give at least one --note describing the change');

	const pkgPath = join(ROOT, 'package.json');
	const logPath = join(ROOT, 'CHANGELOG.md');
	const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
	const version = nextVersion(pkg.version, new Date());
	const changelog = addEntry(await readFile(logPath, 'utf8'), version, notes);

	console.log(`version: ${pkg.version} → ${version}`);
	notes.forEach((n) => console.log(`  - ${n}`));
	if (!apply) {
		console.log('Dry run. Re-run with --apply to write package.json and CHANGELOG.md.');
		return;
	}
	pkg.version = version;
	await writeFile(pkgPath, `${JSON.stringify(pkg, null, '\t')}\n`);
	await writeFile(logPath, changelog);
	console.log('Written: package.json, CHANGELOG.md');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	main().catch((err) => {
		console.error(`version: ${err.message}`);
		process.exit(1);
	});
}
