// @ts-check
/**
 * Development server, Node standard library only. Serves the source directly
 * (no build step) with the same URLs as production:
 *
 *   /            → app/           (index.html for any app route: deep links)
 *   /shared/…    → shared/
 *   /data/grammar/… → generated from assets/data/thuddar (scripts/grammar-data.js)
 *   /api/…       → proxied to the local worker (npm run dev:api)
 *
 *   PORT=8000 API_ORIGIN=http://127.0.0.1:8787 node scripts/serve.js
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, request as httpRequest } from 'node:http';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { grammarFiles } from './grammar-data.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT ?? 8000);
const API = new URL(process.env.API_ORIGIN ?? 'http://127.0.0.1:8787');

/** @type {Record<string, string>} */
const TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.webmanifest': 'application/manifest+json',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.woff2': 'font/woff2',
};

/**
 * Maps a URL path to a file under app/ or shared/, refusing anything outside them.
 * @param {string} pathname
 */
function resolveFile(pathname) {
	const base = pathname.startsWith('/shared/') ? join(ROOT, 'shared') : join(ROOT, 'app');
	const rel = pathname.startsWith('/shared/') ? pathname.slice('/shared'.length) : pathname;
	const file = normalize(join(base, decodeURIComponent(rel)));
	return file.startsWith(base + sep) ? file : null;
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
function proxy(req, res) {
	const upstream = httpRequest(
		// The Worker builds sign-in callbacks from Host. The registered callbacks
		// are on localhost:8787, so that is the host it is told, whichever
		// address the connection itself uses; cookies on localhost are shared by
		// every port, so a sign-in started here finishes on :8787.
		{ hostname: API.hostname, port: API.port, path: req.url, method: req.method, headers: { ...req.headers, host: `localhost:${API.port}` } },
		(up) => {
			res.writeHead(up.statusCode ?? 502, up.headers);
			up.pipe(res);
		},
	);
	upstream.on('error', () => {
		res.writeHead(502, { 'content-type': 'application/json' });
		res.end(JSON.stringify({ error: { code: 'unavailable', message: `API not reachable at ${API.origin}. Start it with: npm run dev:api` } }));
	});
	req.pipe(upstream);
}

const server = createServer(async (req, res) => {
	const url = new URL(req.url ?? '/', 'http://localhost');
	if (url.pathname.startsWith('/api/')) return proxy(req, res);
	if (url.pathname.startsWith('/data/grammar/')) {
		// Read fresh on every request, so edits to the grammar files show at once.
		try {
			const json = (await grammarFiles()).get(url.pathname);
			res.writeHead(json ? 200 : 404, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
			return res.end(json ?? JSON.stringify({ error: { code: 'not_found', message: `No grammar topic at ${url.pathname}` } }));
		} catch (err) {
			res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
			return res.end(JSON.stringify({ error: { code: 'internal', message: /** @type {Error} */ (err).message } }));
		}
	}

	let file = resolveFile(url.pathname);
	const info = file ? await stat(file).catch(() => null) : null;
	if (!info || info.isDirectory()) {
		// No such file: an app route without a file extension gets index.html.
		if (extname(url.pathname)) {
			res.writeHead(404, { 'content-type': 'text/plain' });
			return res.end(`Not found: ${url.pathname}`);
		}
		file = join(ROOT, 'app', 'index.html');
	}
	res.writeHead(200, { 'content-type': TYPES[extname(/** @type {string} */ (file))] ?? 'application/octet-stream', 'cache-control': 'no-store' });
	createReadStream(/** @type {string} */ (file)).pipe(res);
});

server.listen(PORT, () => {
	console.log(`serve: http://localhost:${PORT}  (API → ${API.origin})`);
});
