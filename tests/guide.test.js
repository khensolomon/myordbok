// @ts-check
/**
 * The guide: markdown into passages, the stemmer, the index, and questions
 * answered in the guide's own sentences, against the real docs/.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stem } from '../shared/guide/stem.js';
import { inlinePlain, passages, render, split } from '../shared/guide/markdown.js';
import { ANSWERS_FILE, TERMS_FILE, build, terms } from '../shared/guide/index.js';
import { ask, readQuestion, widen } from '../shared/guide/ask.js';

const ROOT = join(import.meta.dirname, '..');
/** Every markdown file under docs/, as the build ships it. */
function docs() {
	/** @type {{ file: string, text: string }[]} */
	const out = [];
	const walk = (/** @type {string} */ dir) => {
		for (const f of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
			const path = `${dir}/${f.name}`;
			if (f.isDirectory()) walk(path);
			else if (f.name.endsWith('.md')) out.push({ file: path, text: readFileSync(join(ROOT, path), 'utf8') });
		}
	};
	walk('docs');
	return out;
}
const INDEX = build(docs());

test('stemmer: forms of a word meet; short words and other scripts pass through', () => {
	assert.equal(stem('marked'), stem('marking'));
	assert.equal(stem('examples'), stem('example'));
	assert.equal(stem('databases'), stem('database'));
	assert.equal(stem('releases'), stem('released'));
	assert.equal(stem('suggestions'), stem('suggest'));
	assert.equal(stem('go'), 'go');
	assert.equal(stem('မြန်မာ'), 'မြန်မာ');
	assert.equal(stem('D1'), 'd1');
});

test('markdown: headings, bold-led bullets and long runs make passages; tables and lists make sentences', () => {
	const md = `# Deploy\n\nIntro line one. Intro line two.\n\n## Decisions\n\n- **Deep links.** Every route is a real URL.\n  The Worker serves it.\n- **Minified.** One file at a time.\n\n## Table\n\n| A | B |\n|---|---|\n| one | two |\n\n> \`\`\`bash\n> make release\n> \`\`\`\n> [!NOTE]\n> Quoted note.\n`;
	const ps = passages('docs/x.md', md);
	assert.deepEqual(ps.map((p) => p.title), ['Deploy', 'Deep links', 'Minified', 'Table']);
	assert.deepEqual(ps[0].sentences, ['Intro line one.', 'Intro line two.']);
	assert.deepEqual(ps[1].path, ['Deploy', 'Decisions']);
	assert.deepEqual(ps[1].sentences, ['Deep links.', 'Every route is a real URL.', 'The Worker serves it.']);
	assert.deepEqual(ps[3].sentences, ['A | B', 'one | two', 'Quoted note.'], 'the separator row, the quoted fence and the callout tag are not sentences');
	assert.equal(ps[3].code, 'make release');
	assert.ok(ps.every((p) => p.id.startsWith('docs/x.md#') && p.line > 0));
});

test('markdown: inline marks go, code and link text stay; sentences split only at real ends', () => {
	assert.equal(inlinePlain('Run `make api` and see [the docs](x.md), **bold** and *soft*.'), 'Run make api and see the docs, bold and soft.');
	assert.deepEqual(split('See scripts/build.js. It runs e.g. twice. Then stop.'), ['See scripts/build.js.', 'It runs e.g. twice.', 'Then stop.']);
});

test('markdown: render makes small, escaped HTML', () => {
	const html = render('## Head\n\nA `code` and <b>tag</b>.\n\n- one\n- two\n\n```js\nx < 1\n```');
	assert.match(html, /<h3>Head<\/h3>/);
	assert.match(html, /<code>code<\/code> and &lt;b&gt;tag&lt;\/b&gt;/);
	assert.match(html, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
	assert.match(html, /<pre><code class="language-js">x &lt; 1<\/code><\/pre>/);
});

test('terms: stemmed words, hyphenated names whole and in parts, symbols in code, Myanmar whole', () => {
	assert.deepEqual(terms('The markers are examples'), ['marker', 'exampl']);
	assert.deepEqual(terms('make data-packs'), ['make', 'data-packs', 'data', 'pack'], 'the name as written, then its parts stemmed');
	assert.deepEqual(terms('led by › then ~', true), ['led', '›', '~']);
	assert.deepEqual(terms('မြန်မာ words'), ['မြန်မာ', 'word']);
});

test('the real docs index in well under a second, with every file in', () => {
	const t = performance.now();
	const ix = build(docs());
	assert.ok(performance.now() - t < 1000);
	assert.ok(ix.passages.length > 150, `${ix.passages.length} passages`);
	assert.ok(ix.terms.size > 2000);
	assert.ok(ix.size.words > 15000);
	const files = new Set(ix.passages.map((p) => p.file));
	assert.ok(files.has('docs/deploy.md') && files.has('docs/architecture.md'));
});

test('a question is read: its kind, its terms, the frame dropped, quotes kept as written', () => {
	assert.deepEqual(readQuestion('How do I update the dictionary?'), { kind: 'how', terms: ['updat', 'dictionari'], quoted: [], text: 'How do I update the dictionary?' });
	assert.deepEqual(readQuestion('how are examples marked in a definition').terms, ['exampl', 'mark', 'definit']);
	assert.equal(readQuestion('where is the privacy page').kind, 'where');
	assert.equal(readQuestion('is beta always up').kind, 'whether');
	assert.deepEqual(readQuestion('what does `make data-packs` do').quoted, ['make', 'data-packs', 'data', 'pack']);
	assert.deepEqual(readQuestion('   ').terms, []);
});

test('questions the docs answer land on the right passage, in the guide\'s own words', () => {
	const cases = /** @type {[string, RegExp][]} */ ([
		['how do I update the dictionary?', /Updating the dictionary/],
		['what is zawgyi', /Zawgyi/],
		['how to restore a backup', /Restoring rows|Backups/],
		['how is the app version numbered', /testflight|Version/i],
		['what is the layer', /layer/i],
	]);
	for (const [q, title] of cases) {
		const r = ask(INDEX, q);
		assert.ok(r.answered, `${q}: answered`);
		const first = INDEX.passages[r.answers[0].passage];
		assert.match(first.title, title, `${q}: ${first.title}`);
		for (const a of r.answers) {
			assert.ok(a.sentences.length > 0 && a.sentences.length <= 3);
			for (const s of a.sentences) assert.ok(INDEX.passages[a.passage].sentences[s], 'each sentence is the passage\'s own');
		}
	}
});

test('a question the docs do not cover is not answered, and nearest passages are still offered', () => {
	const r = ask(INDEX, 'which font does the iOS app use for Myanmar');
	assert.equal(r.answered, false);
	assert.deepEqual(r.answers, []);
	assert.ok(r.passages.length > 0);
	assert.deepEqual(ask(INDEX, 'the of and').answers, []);
});

test('a written answer beats a chance of words; a terms group widens the question', () => {
	const ix = build([
		...docs(),
		{ file: ANSWERS_FILE, text: '# Answers\n\n## How do I run the tests?\n\n`npm test` runs every test under tests/; one file: `node --test tests/guide.test.js`.\n' },
		{ file: TERMS_FILE, text: '# Terms\n\n- sense, meaning, gloss\n- headword, lemma\n' },
	]);
	const r = ask(ix, 'how do i run the tests');
	assert.ok(r.answered);
	assert.equal(ix.passages[r.answers[0].passage].file, ANSWERS_FILE);
	assert.match(ix.passages[r.answers[0].passage].sentences[r.answers[0].sentences[0]], /npm test/);
	const wide = widen(ix, readQuestion('what is a lemma'));
	assert.equal(wide.get('headword')?.w, 0.8);
	assert.equal(wide.get('lemma')?.w, 1);
});

test('widening brings a term\'s company at a lower weight, never a word that is everywhere', () => {
	const wide = widen(INDEX, readQuestion('backups'));
	for (const [t, { w }] of wide) {
		if (t === 'backup') continue;
		assert.equal(w, 0.35);
		assert.ok((INDEX.df.get(t) ?? 0) <= INDEX.passages.length / 4, t);
	}
});

test('the Worker serves /guide/ files to editors and up only; the build ships them, web only, never precached', async () => {
	const { createHash } = await import('node:crypto');
	const { MIGRATION, d1, sqlite } = await import('./helpers/d1.js');
	const { default: worker } = await import('../worker/index.js');
	const raw = sqlite(MIGRATION);
	const hash = (/** @type {string} */ t) => createHash('sha256').update(t).digest('hex');
	raw.exec(`INSERT INTO users (id, name, email, role) VALUES (1, 'Mya', 'm@example.com', 'member'), (2, 'Ed', 'e@example.com', 'editor');
		INSERT INTO sessions (id_hash, user_id, expires_at) VALUES ('${hash('mya')}', 1, unixepoch() + 3600), ('${hash('ed')}', 2, unixepoch() + 3600);`);
	const env = /** @type {any} */ ({ APP: d1(raw), ASSETS: { fetch: async (/** @type {Request} */ r) => new Response(`served ${new URL(r.url).pathname}`, { headers: { 'content-type': 'text/markdown', 'cache-control': 'public, max-age=3600' } }) } });
	const get = (/** @type {string} */ path, /** @type {string} */ [who] = []) => worker.fetch(new Request(`https://myordbok.test${path}`, { headers: who ? { cookie: `__Host-mo_session=${who}` } : {} }), env);
	assert.equal((await get('/guide/deploy.md')).status, 404, 'signed out');
	assert.equal((await get('/guide/deploy.md', ['mya'])).status, 404, 'a member');
	const ok = await get('/guide/deploy.md', ['ed']);
	assert.equal(ok.status, 200);
	assert.equal(await ok.text(), 'served /guide/deploy.md');
	assert.equal(ok.headers.get('cache-control'), 'private, no-cache');
	assert.equal((await get('/guide/manifest.json', ['ed'])).status, 200);

	const { build } = await import('../scripts/build.js');
	const { mkdtemp, readFile, rm } = await import('node:fs/promises');
	const { tmpdir } = await import('node:os');
	const out = await mkdtemp(join(tmpdir(), 'myordbok-guide-'));
	try {
		await build({ target: 'web', out, minify: false });
		const manifest = JSON.parse(await readFile(join(out, 'guide', 'manifest.json'), 'utf8'));
		assert.ok(manifest.files.some((/** @type {any} */ f) => f.path === 'docs/deploy.md' && f.url === '/guide/deploy.md' && /^[0-9a-f]{8}$/.test(f.hash) && f.words > 100));
		assert.ok(manifest.files.every((/** @type {any} */ f) => f.path.endsWith('.md')));
		assert.match(await readFile(join(out, 'guide', 'deploy.md'), 'utf8'), /^# Deploying to Cloudflare/);
		const sw = await readFile(join(out, 'sw.js'), 'utf8');
		assert.doesNotMatch(sw, /"\/guide\//, 'the guide is not in the offline shell');
		const app = join(out, 'tauri');
		await build({ target: 'tauri', out: app, api: 'https://myordbok.com', minify: false });
		await assert.rejects(readFile(join(app, 'guide', 'manifest.json')), /ENOENT/, 'the app build has no guide');
	} finally {
		await rm(out, { recursive: true, force: true });
	}
});
