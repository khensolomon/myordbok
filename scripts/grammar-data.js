// @ts-check
/**
 * Grammar content for the /grammar pages, from assets/data/thuddar (the
 * Myanmar grammar the previous site used). Node standard library only.
 *
 * Produces, as JSON text keyed by URL path:
 *
 *   /data/grammar/index.json    the introduction and every topic, in order,
 *                               grouped: parts of speech, then other topics
 *   /data/grammar/<slug>.json   one topic (pos-<slug>.json), as stored, plus
 *                               `english` on part-of-speech (from pos-en.md)
 *
 * The build writes these into dist (and the service worker precaches them);
 * the dev server answers them from the same function. Anything malformed
 * stops both with the file and the problem named.
 */
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

export const GRAMMAR_DIR = join(import.meta.dirname, '..', 'assets', 'data', 'thuddar');

/**
 * URL slug of a topic's English name: "Part of speech" → "part-of-speech".
 * @param {string} name
 */
export function grammarSlug(name) {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * The few Markdown forms pos-en.md uses, as blocks the page renders as text.
 * @param {string} md
 * @returns {Array<{ type: 'h1' | 'h2' | 'quote' | 'p', text: string }>}
 */
export function markdownBlocks(md) {
	/** @type {Array<{ type: 'h1' | 'h2' | 'quote' | 'p', text: string }>} */
	const out = [];
	for (const raw of md.replace(/\r\n/g, '\n').split(/\n{2,}/)) {
		const text = raw.trim();
		if (!text) continue;
		if (text.startsWith('## ')) out.push({ type: 'h2', text: text.slice(3).trim() });
		else if (text.startsWith('# ')) out.push({ type: 'h1', text: text.slice(2).trim() });
		else if (text.startsWith('> ')) out.push({ type: 'quote', text: text.replace(/^> ?/gm, '').trim() });
		else out.push({ type: 'p', text: text.replace(/\s*\n\s*/g, ' ') });
	}
	return out;
}

/**
 * @param {unknown} node
 * @param {string} where
 */
function checkNode(node, where) {
	if (!node || typeof node !== 'object') throw new Error(`${where}: not an object`);
	const n = /** @type {Record<string, unknown>} */ (node);
	const root = /** @type {Record<string, unknown> | undefined} */ (n.root);
	if (!root || typeof root.name !== 'string' || !root.name.trim()) throw new Error(`${where}: root.name is missing`);
	for (const key of ['cate', 'word', 'exam', 'kind']) {
		if (n[key] !== undefined && n[key] !== null && !Array.isArray(n[key])) throw new Error(`${where}: ${key} is not a list`);
	}
	for (const [i, e] of (/** @type {any[]} */ (n.exam) ?? []).entries()) {
		for (const [j, f] of (e.form ?? []).entries()) {
			if (!Array.isArray(f.title) || !Array.isArray(f.row)) throw new Error(`${where}: exam[${i}].form[${j}] needs title and row lists`);
		}
	}
	for (const [i, k] of (/** @type {any[]} */ (n.kind) ?? []).entries()) checkNode(k, `${where} › kind[${i}]`);
}

/**
 * @param {string} [dir]
 * @returns {Promise<Map<string, string>>}  URL path → JSON text.
 */
export async function grammarFiles(dir = GRAMMAR_DIR) {
	/** @param {string} name */
	const read = async (name) => {
		const text = await readFile(join(dir, name), 'utf8');
		try {
			return JSON.parse(text);
		} catch (err) {
			throw new Error(`grammar: ${name} is not valid JSON (${/** @type {Error} */ (err).message})`);
		}
	};

	const structure = await read('structure.json');
	const order = structure?.structure?.file?.find((/** @type {any} */ f) => f.id === 'pos')?.child;
	if (!Array.isArray(order)) throw new Error('grammar: structure.json has no structure.file[pos].child list');
	const context = await read('context.json');

	const names = (await readdir(dir)).filter((f) => /^pos-[a-z0-9-]+\.json$/.test(f));
	/** @type {Map<string, any>} */
	const topics = new Map();
	for (const file of names) {
		const data = await read(file);
		const slug = file.slice(4, -5);
		if (typeof data?.info?.name !== 'string') throw new Error(`grammar: ${file}: info.name is missing`);
		if (grammarSlug(data.info.name) !== slug) throw new Error(`grammar: ${file}: info.name "${data.info.name}" does not match the file name`);
		checkNode(data, `grammar: ${file}`);
		topics.set(slug, data);
	}

	const ordered = order.map((/** @type {string} */ name) => {
		const slug = grammarSlug(name);
		if (!topics.has(slug)) throw new Error(`grammar: structure.json lists "${name}" but pos-${slug}.json does not exist`);
		return slug;
	});
	const unlisted = [...topics.keys()].filter((s) => !ordered.includes(s));
	if (unlisted.length) throw new Error(`grammar: pos-${unlisted.join('.json, pos-')}.json not listed in structure.json`);

	const index = {
		context: {
			name: String(context.name),
			desc: String(context.desc ?? ''),
			kind: (context.kind ?? []).map((/** @type {any} */ k) => ({ name: String(k.name), desc: String(k.desc ?? '') })),
		},
		topics: ordered.map((slug) => {
			const t = topics.get(slug);
			return {
				slug,
				name: t.info.name,
				my: t.root.name,
				desc: t.root.desc ?? '',
				// status 1 marks the nine parts of speech; the rest are other topics.
				group: Number(t.info.status) === 1 ? 'pos' : 'other',
			};
		}),
	};

	/** @type {Map<string, string>} */
	const out = new Map([['/data/grammar/index.json', JSON.stringify(index)]]);
	const english = markdownBlocks(await readFile(join(dir, 'pos-en.md'), 'utf8'));
	for (const slug of ordered) {
		const topic = { slug, ...topics.get(slug) };
		if (slug === 'part-of-speech') topic.english = english;
		out.set(`/data/grammar/${slug}.json`, JSON.stringify(topic));
	}
	return out;
}
