// @ts-check
/**
 * A question put to the guide, answered in the guide's own sentences.
 *
 * 1. The question is read (readQuestion): its question words name what
 *    kind of answer is wanted (how: a way to do it; what: what a thing is;
 *    where: a place in the code or the site; when: a condition), and the
 *    rest are its terms. Anything in quotes or backticks is a term as
 *    written, besides its words.
 * 2. Each term brings its neighbours (widen): the words of its synonym
 *    group (guide-terms.md), and the words that keep company with it in
 *    the guide's own passages, at a lower weight; so "example" also looks
 *    for the marker it is written with.
 * 3. Every sentence holding one of the terms is scored: each term by how
 *    rare it is, more when the passage's heading has it, more in code;
 *    with the passage's own coverage of the question added, so a sentence
 *    in the right passage beats a stray one; and a little for the kind of
 *    sentence the question wants.
 * 4. The best sentences, from at most ANSWER_PASSAGES passages, are the
 *    answer, when the best covers enough of the question; else the guide
 *    does not answer, and the nearest passages are offered as such.
 */
import { ANSWERS_FILE, idf, terms as termsOf } from './index.js';

/** Passages an answer draws on, and sentences from each, at most. */
export const ANSWER_PASSAGES = 2;
export const ANSWER_SENTENCES = 3;
/** Share of the question's weight a sentence (with its passage) must cover to be an answer. */
export const FLOOR = 0.45;

/** @typedef {'how' | 'what' | 'where' | 'when' | 'why' | 'which' | 'whether' | null} Kind */

const KINDS = /** @type {[RegExp, Kind][]} */ ([
	[/^(how|in what way)\b/, 'how'],
	[/^what\b/, 'what'],
	[/^(where|in which file|which file)\b/, 'where'],
	[/^when\b/, 'when'],
	[/^why\b/, 'why'],
	[/^(which|what kind of|what type of)\b/, 'which'],
	[/^(is|are|does|do|can|could|should|will|would|must|may|did)\b/, 'whether'],
]);
/** After the question word: the helping words and the pronoun that frame it, never the subject. */
const AFTER = /^((is|are|was|were|do|does|did|can|could|should|would|will|must|may|might|to|about)\s+)?((i|we|you|one|it|they|someone|there|a|an|the)\s+)?/;

/** Phrases that frame a question and name nothing of its subject. */
const FRAME = /\b(i|we|you|one|someone|please|tell me|explain|show me|know|need to|want to|would like to|supposed to|meant to|mean|means|meaning of|about|regarding|concerning|exactly|actually|really|correctly|properly|the right way|right way|best way|way to|how about|what about)\b/g;

/**
 * @typedef {object} Question
 * @property {Kind} kind
 * @property {string[]} terms  Stemmed content terms, in order, repeats dropped.
 * @property {string[]} quoted  Terms taken as written from quotes or backticks.
 * @property {string} text  What was asked.
 */

/**
 * @param {string} text
 * @returns {Question}
 */
export function readQuestion(text) {
	const asked = text.trim();
	let rest = asked.toLowerCase().replace(/[?!.]+$/, '').trim();
	/** @type {Kind} */
	let kind = null;
	for (const [re, k] of KINDS) {
		const m = re.exec(rest);
		if (m) {
			kind = k;
			rest = rest.slice(m[0].length).trim().replace(AFTER, '');
			break;
		}
	}
	/** @type {string[]} */
	const quoted = [];
	for (const m of rest.matchAll(/[`"“”'‘’]([^`"“”'‘’]+)[`"“”'‘’]/g)) quoted.push(...termsOf(m[1], true));
	rest = rest.replace(FRAME, ' ');
	const seen = new Set();
	/** @type {string[]} */
	const list = [];
	for (const t of [...termsOf(rest), ...quoted]) {
		if (seen.has(t)) continue;
		seen.add(t);
		list.push(t);
	}
	return { kind, terms: list, quoted, text: asked };
}

/**
 * The question's terms with their neighbours, each with a weight: the
 * term itself 1; a synonym 0.8; a word that occurs with it in the guide
 * (in most of its passages, and not in too many others) 0.35.
 * @param {import('./index.js').GuideIndex} ix
 * @param {Question} q
 * @returns {Map<string, { w: number, of: string }>}  term → weight and the question term it stands for.
 */
export function widen(ix, q) {
	/** @type {Map<string, { w: number, of: string }>} */
	const out = new Map();
	const put = (/** @type {string} */ t, /** @type {number} */ w, /** @type {string} */ of) => {
		const have = out.get(t);
		if (!have || have.w < w) out.set(t, { w, of });
	};
	const n = ix.passages.length;
	// A group of the terms file whose entry the question holds whole: its one-word entries, as the entry's stand-ins.
	for (const group of ix.groups) {
		const held = group.find((entry) => entry.every((t) => q.terms.includes(t)));
		if (!held) continue;
		for (const entry of group) if (entry.length === 1 && entry[0] !== held[0]) put(entry[0], 0.8, held[0]);
	}
	for (const t of q.terms) {
		put(t, 1, t);
		const hits = ix.terms.get(t);
		if (!hits || hits.length < 2) continue;
		/** @type {Map<string, number>} */
		const company = new Map();
		for (const h of hits) {
			const pass = ix.passages[h.p];
			for (const u of new Set([...termsOf(pass.sentences.join(' ')), ...termsOf(pass.code, true)])) {
				if (u === t) continue;
				company.set(u, (company.get(u) ?? 0) + 1);
			}
		}
		const best = [...company]
			.filter(([u, c]) => c / hits.length >= 0.5 && (ix.df.get(u) ?? n) <= n / 4)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 3);
		for (const [u] of best) put(u, 0.35, t);
	}
	return out;
}

/**
 * @typedef {object} Answer
 * @property {number} passage  Index into the index's passages.
 * @property {number[]} sentences  Sentence indexes, in the passage's order.
 * @property {number} score
 */
/**
 * @typedef {object} Reply
 * @property {Question} question
 * @property {boolean} answered  The best sentence covered enough of the question.
 * @property {Answer[]} answers  Empty when not answered.
 * @property {{ passage: number, score: number, coverage: number }[]} passages  The nearest passages, best first (at most 8).
 * @property {string[]} matched  The terms found, the question's and their neighbours.
 */

/**
 * @param {import('./index.js').GuideIndex} ix
 * @param {string} text
 * @returns {Reply}
 */
export function ask(ix, text) {
	const question = readQuestion(text);
	const empty = { question, answered: false, answers: [], passages: [], matched: [] };
	if (!question.terms.length) return empty;
	const wide = widen(ix, question);
	/** The question's weight: each of its own terms by rarity. */
	const total = question.terms.reduce((sum, t) => sum + idf(ix, t), 0) || 1;
	/** Its most telling term (the rarest): an answer must hold it. */
	const key = question.terms.reduce((best, t) => (idf(ix, t) > idf(ix, best) ? t : best), question.terms[0]);

	/** Per passage: the question terms it covers (weight), and each sentence's score. */
	/** @type {Map<number, { cover: Map<string, number>, sentences: Map<number, number>, own: Map<number, Map<string, number>>, head: number, headStrong: number, headOf: Map<string, number> }>} */
	const byPassage = new Map();
	for (const [t, { w, of }] of wide) {
		const hits = ix.terms.get(t);
		if (!hits) continue;
		const gain = idf(ix, of) * w;
		for (const h of hits) {
			let pp = byPassage.get(h.p);
			if (!pp) byPassage.set(h.p, (pp = { cover: new Map(), sentences: new Map(), own: new Map(), head: 0, headStrong: 0, headOf: new Map() }));
			if ((pp.cover.get(of) ?? 0) < gain) pp.cover.set(of, gain);
			// Named after the term by its writer: as telling as the words below it.
			if (h.head) {
				pp.head += gain;
				// The question's own words (or their synonyms) in the heading, not a word that merely keeps them company.
				if (w >= 0.8) pp.headStrong += gain;
				if ((pp.headOf.get(of) ?? 0) < gain) pp.headOf.set(of, gain);
			}
			const per = gain * (h.head ? 1.25 : 1) * (h.code ? 1.15 : 1);
			for (const s of h.s) {
				pp.sentences.set(s, (pp.sentences.get(s) ?? 0) + per);
				let c = pp.own.get(s);
				if (!c) pp.own.set(s, (c = new Map()));
				if ((c.get(of) ?? 0) < gain) c.set(of, gain);
			}
		}
	}
	if (!byPassage.size) return empty;

	/** @type {{ passage: number, score: number, coverage: number }[]} */
	const ranked = [];
	/** @type {{ passage: number, sentence: number, score: number, coverage: number }[]} */
	const candidates = [];
	for (const [p, pp] of byPassage) {
		const pass = ix.passages[p];
		let covered = 0;
		for (const g of pp.cover.values()) covered += g;
		const coverage = Math.min(1, covered / total);
		const answerFile = pass.file === ANSWERS_FILE;
		const passageScore = (covered + pp.head + (answerFile ? pp.headStrong : 0)) * fileWeight(pass.file);
		ranked.push({ passage: p, score: passageScore, coverage });
		for (const [s, own] of pp.sentences) {
			const sentence = pass.sentences[s];
			const kindBonus = wanted(question.kind, sentence) ? 0.15 * covered : 0;
			// A stub ("Details: Releases.") says little by itself; a line introducing a block (ends in ":") brings the block with it (codeAfter).
			const stub = sentence.split(/\s+/).length < 5 && !sentence.endsWith(':') ? 0.3 : 1;
			// The sentence's own share of the question, lifted a little by its passage's.
			// Its own words, and the heading's: a sentence under "Updating the dictionary" is about that.
			const held = new Map(pp.headOf);
			for (const [of, g] of pp.own.get(s) ?? []) if ((held.get(of) ?? 0) < g) held.set(of, g);
			let mine = 0;
			for (const g of held.values()) mine += g;
			// At least half the question's words must be in the passage: one rare word is not an answer to a question of several.
			const enough = pp.cover.size >= Math.ceil(question.terms.length / 2) && pp.cover.has(key);
			const sentenceCoverage = Math.min(1, (mine + 0.3 * (covered - mine)) / total) * (enough ? 1 : 0.5);
			candidates.push({ passage: p, sentence: s, score: (own + 0.8 * passageScore + kindBonus) * fileWeight(pass.file) * stub, coverage: sentenceCoverage });
		}
		// An answer written for a question: its first sentences stand even without a word in common.
		if (answerFile && pp.headStrong > 0) pass.sentences.forEach((_, s) => candidates.push({ passage: p, sentence: s, score: (pp.headStrong * 2 + covered) * fileWeight(pass.file) - s * 0.01, coverage: Math.max(coverage, pp.headStrong / total) }));
	}
	ranked.sort((a, b) => b.score - a.score);
	candidates.sort((a, b) => b.score - a.score);

	/** @type {Answer[]} */
	const answers = [];
	const best = candidates[0];
	const answered = Boolean(best) && best.coverage >= FLOOR;
	if (answered) {
		for (const c of candidates) {
			if (c.coverage < FLOOR * 0.8) continue;
			let a = answers.find((x) => x.passage === c.passage);
			if (!a) {
				// A second passage only when it stands near the first.
				if (answers.length >= ANSWER_PASSAGES || c.score < best.score * 0.75) continue;
				answers.push((a = { passage: c.passage, sentences: [], score: c.score }));
			}
			if (a.sentences.length < ANSWER_SENTENCES && !a.sentences.includes(c.sentence)) a.sentences.push(c.sentence);
		}
		for (const a of answers) a.sentences.sort((x, y) => x - y);
	}
	return {
		question,
		answered,
		answers,
		passages: ranked.slice(0, 8),
		matched: [...wide.keys()].filter((t) => ix.terms.has(t)),
	};
}

/**
 * How much a file's passages count: a to-do list is not guidance. (An
 * answer written for a question counts through its heading, above.)
 * @param {string} file
 */
function fileWeight(file) {
	if (/\/TODO\.md$/.test(file)) return 0.5;
	return 1;
}

/**
 * Whether a sentence is the kind the question wants: a way to do it
 * (how: an imperative or a command), what a thing is (what: "X is …"),
 * a place (where: a path), a condition (when: "when", "until", "once").
 * @param {Kind} kind
 * @param {string} sentence
 */
function wanted(kind, sentence) {
	switch (kind) {
		case 'how':
			return /^(run|use|add|write|put|open|set|give|make|go|click|press|type|choose|pick|send|start|call|pass|keep|leave)\b|\b(make|npm|node|wrangler|git) [a-z]/i.test(sentence) || /\bby (running|adding|writing|setting)\b/i.test(sentence);
		case 'what':
			return /^[A-Z`'"][^.]{0,60}\b(is|are|holds|means|stands for|names)\b/.test(sentence);
		case 'where':
			return /[a-z0-9_-]+\/[a-z0-9_./-]+|\.(js|md|json|toml|css|html|sql)\b/i.test(sentence);
		case 'when':
			return /\b(when|whenever|until|once|after|before|unless|only if|as soon as)\b/i.test(sentence);
		case 'why':
			return /\b(so that|because|since|so|otherwise|would)\b/i.test(sentence);
		default:
			return false;
	}
}

/**
 * The code block a sentence introduces, when it ends in ":" and a fenced
 * block follows it in the passage; else null.
 * @param {import('./markdown.js').Passage} passage
 * @param {number} sentence
 */
export function codeAfter(passage, sentence) {
	const text = passage.sentences[sentence];
	if (!text || !text.endsWith(':')) return null;
	const key = text.slice(0, 24).replace(/[`*_>]/g, '');
	const parts = passage.markdown.replace(/^[ \t]*>[ ]?/gm, '').split(/^\s*(?:```|~~~).*$/m);
	for (let i = 0; i + 1 < parts.length; i += 2) {
		if (parts[i].replace(/[`*_]/g, '').replace(/\s+/g, ' ').includes(key.replace(/\s+/g, ' '))) return parts[i + 1].replace(/^\n|\n$/g, '');
	}
	return null;
}
