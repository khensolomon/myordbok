// @ts-check
/**
 * The guide's index: every passage's words, stemmed, with where each
 * occurs (which passage, which sentence, in its heading, in code), and how
 * rare it is across the guide. Built from the markdown in milliseconds;
 * nothing is stored but what this module returns. ask.js scores against
 * it; the workspace shows its passages.
 *
 * Two files of the guide are read specially:
 * - docs/guide-answers.md: each heading is a question as an editor would
 *   put it, its text the answer. A match on such a heading counts double,
 *   so a written answer beats a chance of words.
 * - docs/guide-terms.md: each line a group of words that mean the same
 *   here ("sense, meaning, gloss"). A question with one of them also
 *   looks for the others.
 */
import { passages as readPassages } from './markdown.js';
import { stem } from './stem.js';

export const ANSWERS_FILE = 'docs/guide-answers.md';
export const TERMS_FILE = 'docs/guide-terms.md';

/** Words carrying nothing on their own; question words among them (ask.js reads those first). */
export const STOP = new Set(
	'a an the and or but if then else of to in on at by for from with without into onto over under about as is are was were be been being am do does did done have has had having it its this that these those there here where when why how what which who whom whose i me my we our you your they them their he she his her one ones not no yes so such than too very can could should would will shall may might must also just only even still yet already again more most much many some any each every all both few other another same own s t ll re ve d m up down out off use used using get got thing things way'.split(
		' ',
	),
);

/**
 * @typedef {object} Hit
 * @property {number} p  Passage index.
 * @property {number[]} s  Sentence indexes holding the term (-1: only in code or the heading).
 * @property {number} tf  Occurrences in the passage.
 * @property {boolean} head  In the passage's title or the headings above it.
 * @property {boolean} code  In a code span or block.
 */
/**
 * @typedef {object} GuideIndex
 * @property {import('./markdown.js').Passage[]} passages
 * @property {Map<string, Hit[]>} terms  stem → where it occurs, by passage.
 * @property {Map<string, number>} df  stem → passages holding it.
 * @property {string[][][]} groups  guide-terms.md: each group's entries, each entry its stems.
 * @property {{ files: number, words: number }} size
 */

/**
 * Words of a text, as index terms: Latin words stemmed, Myanmar runs
 * whole, and in code the symbols the guide's conventions turn on (›, ~,
 * ⇒ …) each a term of its own. A hyphenated or dotted name counts whole
 * and as its parts ("data-packs": data-packs, data, packs).
 * @param {string} text
 * @param {boolean} [code]
 */
export function terms(text, code = false) {
	/** @type {string[]} */
	const out = [];
	const lower = text.toLowerCase();
	const re = code ? /[a-z0-9][a-z0-9_./-]*[a-z0-9]|[a-z0-9]|[က-႟]+|[›‹~⇒→«»•·|=:\[\]<>{}#$@*+]+/g : /[a-z0-9][a-z0-9'’_.-]*[a-z0-9]|[a-z0-9]|[က-႟]+/g;
	for (const m of lower.matchAll(re)) {
		const w = m[0].replace(/^[.]+|[.]+$/g, '');
		if (!w) continue;
		if (/^[က-႟]/.test(w)) {
			out.push(w);
			continue;
		}
		if (/^[^a-z0-9]/.test(w)) {
			out.push(w);
			continue;
		}
		const parts = w.split(/[-_./'’]+/).filter(Boolean);
		if (parts.length > 1) out.push(w);
		for (const p of parts) {
			if (STOP.has(p) || (p.length < 2 && !/\d/.test(p))) continue;
			out.push(stem(p));
		}
	}
	return out;
}

/**
 * @param {{ file: string, text: string }[]} files  Each doc, with its docs/… path.
 * @returns {GuideIndex}
 */
export function build(files) {
	/** @type {import('./markdown.js').Passage[]} */
	const passages = [];
	/** @type {string[][][]} */
	const groups = [];
	let words = 0;
	for (const { file, text } of files) {
		if (file === TERMS_FILE) {
			for (const line of text.split('\n')) {
				const row = line.replace(/^\s*[-*]\s+/, '').trim();
				if (!row || row.startsWith('#')) continue;
				// Each entry as its stems: "legacy font" is one entry of two, matched only whole.
				const group = row.split(/\s*[,;]\s*/).map((w) => terms(w)).filter((e) => e.length);
				if (group.length >= 2) groups.push(group);
			}
			continue;
		}
		passages.push(...readPassages(file, text));
		words += text.split(/\s+/).filter(Boolean).length;
	}
	/** @type {Map<string, Hit[]>} */
	const index = new Map();
	passages.forEach((pass, p) => {
		/** @type {Map<string, Hit>} */
		const here = new Map();
		const add = (/** @type {string} */ t, /** @type {number} */ s, /** @type {boolean} */ head, /** @type {boolean} */ code) => {
			let hit = here.get(t);
			if (!hit) here.set(t, (hit = { p, s: [], tf: 0, head: false, code: false }));
			hit.tf++;
			if (s >= 0 && !hit.s.includes(s)) hit.s.push(s);
			if (head) hit.head = true;
			if (code) hit.code = true;
		};
		for (const t of terms([pass.title, ...pass.path].join(' '))) add(t, -1, true, false);
		pass.sentences.forEach((sentence, s) => {
			for (const t of terms(sentence)) add(t, s, false, false);
		});
		for (const t of terms(pass.code, true)) add(t, -1, false, true);
		for (const [t, hit] of here) {
			const list = index.get(t);
			if (list) list.push(hit);
			else index.set(t, [hit]);
		}
	});
	/** @type {Map<string, number>} */
	const df = new Map();
	for (const [t, hits] of index) df.set(t, hits.length);
	return { passages, terms: index, df, groups, size: { files: files.length, words } };
}

/**
 * How much a term tells: rare across the guide counts more. Smoothed so a
 * term in every passage still counts a little.
 * @param {GuideIndex} ix
 * @param {string} term
 */
export function idf(ix, term) {
	const n = ix.passages.length;
	const d = ix.df.get(term) ?? 0;
	return Math.log(1 + (n - d + 0.5) / (d + 0.5));
}
