// @ts-check
/**
 * Builds the client into dist/<target> with Node's standard library only.
 *
 *   node scripts/build.js                  web build (PWA, service worker)
 *   node scripts/build.js --noindex        web build for beta: X-Robots-Tag noindex on every file
 *   node scripts/build.js --target tauri   Tauri build (no service worker)
 *
 * Steps: copy app/ and shared/, write the grammar content (scripts/grammar-data.js)
 * to /data/grammar/, add a content hash to every .js and .css file,
 * write an import map from the original paths to the hashed ones (so source
 * imports never change), add modulepreload links, and for the web target fill
 * the service worker's precache list. Workspace code is never precached.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { GRAMMAR_DIR, grammarFiles } from './grammar-data.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TARGETS = ['web', 'tauri'];

/**
 * @param {string} dir
 * @returns {Promise<string[]>} file paths relative to `dir`, POSIX separators
 */
async function walk(dir) {
	/** @type {string[]} */
	const out = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...(await walk(full)).map((f) => `${entry.name}/${f}`));
		else out.push(entry.name);
	}
	return out;
}

/** @param {Buffer} data */
const hash8 = (data) => createHash('sha256').update(data).digest('hex').slice(0, 8);

/**
 * @param {string} text
 * @param {RegExp} pattern
 * @param {string} replacement
 * @param {string} what  Used in the error when the pattern is missing.
 */
function replaceOnce(text, pattern, replacement, what) {
	if (!pattern.test(text)) throw new Error(`build: ${what} not found; the source file changed shape`);
	return text.replace(pattern, () => replacement);
}

/**
 * @param {object} options
 * @param {'web' | 'tauri'} options.target
 * @param {string} [options.out]
 * @param {string} [options.root]
 * @param {boolean} [options.noindex]  Ask search engines not to index (beta).
 * @param {string} [options.grammar]  Grammar source folder (tests use a fixture).
 */
export async function build({ target, out, root = ROOT, noindex = false, grammar = GRAMMAR_DIR }) {
	if (!TARGETS.includes(target)) throw new Error(`build: unknown target "${target}" (expected ${TARGETS.join(' or ')})`);
	const app = join(root, 'app');
	const shared = join(root, 'shared');
	const dist = out ?? join(root, 'dist', target);
	const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

	// Every web adapter must exist for the target, or the build stops here.
	const adapters = (await readdir(join(app, 'platform', 'web'))).filter((f) => f.endsWith('.js'));
	const targetDir = join(app, 'platform', target);
	const present = new Set((await readdir(targetDir).catch(() => [])).filter((f) => f.endsWith('.js')));
	const missing = adapters.filter((f) => !present.has(f));
	if (missing.length) {
		throw new Error(`build: app/platform/${target}/ is missing ${missing.join(', ')}; the ${target} build cannot run until those adapters exist`);
	}

	/** @type {{ from: string, url: string }[]} source file → public URL path */
	const files = [];
	for (const f of await walk(app)) {
		if (f.startsWith('platform/')) {
			const [, platform, ...rest] = f.split('/');
			if (platform !== target || !rest.join('/').endsWith('.js')) continue;
		}
		if (f === 'sw.js' && target !== 'web') continue;
		files.push({ from: join(app, f), url: `/${f}` });
	}
	for (const f of await walk(shared)) {
		if (f.endsWith('.js')) files.push({ from: join(shared, f), url: `/shared/${f}` });
	}

	await rm(dist, { recursive: true, force: true });

	/** @type {Map<string, string>} original URL → hashed URL */
	const hashed = new Map();
	for (const file of files) {
		const ext = extname(file.url);
		let url = file.url;
		const data = await readFile(file.from);
		if ((ext === '.js' || ext === '.css') && file.url !== '/sw.js') {
			url = `${file.url.slice(0, -ext.length)}.${hash8(data)}${ext}`;
			hashed.set(file.url, url);
		}
		if (file.url === '/index.html' || file.url === '/sw.js') continue; // written below
		const dest = join(dist, ...url.split('/').filter(Boolean));
		await mkdir(dirname(dest), { recursive: true });
		await writeFile(dest, data);
	}

	// Grammar content: plain JSON, fetched per page and precached for offline use.
	for (const [url, json] of await grammarFiles(grammar)) {
		const dest = join(dist, ...url.split('/').filter(Boolean));
		await mkdir(dirname(dest), { recursive: true });
		await writeFile(dest, json);
	}

	/** @type {Record<string, string>} */
	const imports = {};
	for (const [from, to] of hashed) {
		if (!from.endsWith('.js')) continue;
		imports[from] = to;
		if (from.startsWith(`/platform/${target}/`)) imports[`#platform/${from.slice(`/platform/${target}/`.length)}`] = to;
		if (from.startsWith('/shared/')) imports[`#shared/${from.slice('/shared/'.length)}`] = to;
	}

	// Modules the reader needs on first paint; the workspace stays out.
	const preload = [...hashed]
		.filter(([from]) => from.endsWith('.js') && !from.startsWith('/workspace/') && !from.endsWith('/types.js'))
		.map(([, to]) => `\t<link rel="modulepreload" href="${to}">`)
		.join('\n');
	const styles = [...hashed]
		.filter(([from]) => from.endsWith('.css'))
		.map(([, to]) => `\t<link rel="stylesheet" href="${to}">`)
		.join('\n');
	const main = hashed.get('/main.js');
	if (!main) throw new Error('build: app/main.js is missing');

	let html = await readFile(join(app, 'index.html'), 'utf8');
	html = replaceOnce(html, /<!--styles-->[\s\S]*?<!--\/styles-->/, styles, 'styles block in index.html');
	html = replaceOnce(
		html,
		/<!--importmap[\s\S]*?<!--\/importmap-->/,
		`<script type="importmap">${JSON.stringify({ imports })}</script>\n${preload}${target === 'web' ? '\n\t<meta name="mo-sw" content="1">' : ''}`,
		'import map block in index.html',
	);
	html = replaceOnce(html, /src="\/main\.js"/, `src="${main}"`, 'main.js script tag in index.html');
	await writeFile(join(dist, 'index.html'), html);

	if (noindex) {
		if (target !== 'web') throw new Error('build: --noindex applies to the web target only');
		// Read by Cloudflare, never served as a file.
		await writeFile(join(dist, '_headers'), '/*\n  X-Robots-Tag: noindex\n');
	}

	if (target === 'web') {
		const all = (await walk(dist)).filter((f) => f !== '_headers');
		const precache = all.map((f) => `/${f}`).filter((u) => u !== '/index.html' && !u.startsWith('/workspace/'));
		const version = `${pkg.version}-${hash8(Buffer.from(precache.join('\n')))}`;
		let sw = await readFile(join(app, 'sw.js'), 'utf8');
		sw = replaceOnce(sw, /const VERSION = 'dev';/, `const VERSION = ${JSON.stringify(version)};`, 'VERSION in sw.js');
		sw = replaceOnce(sw, /const PRECACHE = \[\];/, `const PRECACHE = ${JSON.stringify(precache)};`, 'PRECACHE in sw.js');
		await writeFile(join(dist, 'sw.js'), sw);
	}

	const count = (await walk(dist)).length;
	return { dist, count, hashed: hashed.size };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const i = process.argv.indexOf('--target');
	const target = /** @type {'web' | 'tauri'} */ (i > -1 ? process.argv[i + 1] : 'web');
	const noindex = process.argv.includes('--noindex');
	build({ target, noindex })
		.then(({ dist, count, hashed }) => console.log(`build: ${target} → ${relative(ROOT, dist).split(sep).join('/')} (${count} files, ${hashed} hashed)`))
		.catch((err) => {
			console.error(err.message);
			process.exit(1);
		});
}
