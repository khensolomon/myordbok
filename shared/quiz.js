// @ts-check
/**
 * Questions made from a word's own entry, and when a word comes back for
 * practice. Pure: the app fetches the entries (app/reader/quiz.js) and keeps
 * the progress on the device (app/data/quiz-store.js).
 *
 * Only reviewed (Active) senses make questions: a learner should never be
 * scored against a draft. The wrong choices are other words' meanings, never
 * one the word itself has, so exactly one choice is right.
 */
import { itemsOf, parseMarkup, plainText } from './markup.js';

/** Days until a word comes back, by how many rounds in a row it was answered right. */
export const REVIEW_DAYS = Object.freeze([1, 3, 7, 21]);
/** A word answered right this many rounds in a row counts as learned. */
export const LEARNED_BOX = 2;
/** Choices a question offers at most, and at least. */
export const MOST_CHOICES = 4;
export const FEWEST_CHOICES = 3;

/**
 * @typedef {import('./types.js').EnglishResult} EnglishResult
 * @typedef {{ type: string, glosses: string[], explained: string | null, example: string | null }} Reviewed
 * @typedef {{ text: string, right: boolean, word?: string, note?: string }} Choice
 *   text: what is shown; word: the English word it belongs to (a Myanmar
 *   meaning's word, or the word itself); note: said beside it once answered.
 * @typedef {{ kind: 'en-my', word: string, prompt: string, choices: Choice[], answer: Reviewed }
 *   | { kind: 'my-en', word: string, prompt: string, choices: Choice[], answer: Reviewed }
 *   | { kind: 'gap', word: string, before: string, after: string, choices: Choice[], answer: Reviewed }
 *   | { kind: 'listen', word: string, prompt: string, choices: Choice[], answer: Reviewed }
 *   | { kind: 'type', word: string, prompt: string, hint: string, choices: Choice[], answer: Reviewed }
 *   | { kind: 'sense', word: string, prompt: string, choices: Choice[], answer: Reviewed }} Question
 *   listen: the word is heard, not shown (prompt is the word to say); type: the
 *   word is typed for a Myanmar meaning, its one choice the word; sense: which
 *   of the word's own meanings an example of it uses.
 */

/** Every kind of question, in the order a round asks them. */
export const KINDS = /** @type {const} */ (['en-my', 'listen', 'my-en', 'type', 'gap', 'sense']);

/**
 * A gloss or an example as plain text: markup read, labels left out.
 * @param {string} text
 * @param {string} [headword]  Replaces `~`.
 */
export function plainItem(text, headword) {
	const tokens = parseMarkup(text).filter((tk) => tk.t !== 'label');
	return plainText(tokens, headword).replace(/\s+/g, ' ').trim();
}

/**
 * The reviewed senses of an English result, with their glosses as plain text.
 * @param {EnglishResult} result
 * @returns {Reviewed[]}
 */
export function reviewed(result) {
	return result.entries
		.filter((s) => s.kind === 'Active')
		.map((s) => {
			const items = itemsOf(s.sense, { languages: true });
			const glosses = items.flatMap((it) => (it.t === 'text' ? [plainItem(it.text)] : [])).filter(Boolean);
			const en = items.find((it) => it.t === 'language' && it.lang === 'en');
			return { type: s.type, glosses, explained: en && en.t === 'language' ? en.text : null, example: s.example };
		})
		.filter((s) => s.glosses.length > 0);
}

/** Every gloss a result has, reviewed or not, to keep a wrong choice from being right. @param {EnglishResult} result */
function allGlosses(result) {
	return new Set(result.entries.flatMap((s) => itemsOf(s.sense, { languages: true }).flatMap((it) => (it.t === 'text' ? [plainItem(it.text)] : []))));
}

/**
 * Words to borrow wrong choices from, best first: opposites and related
 * words read as different meanings; then the reader's own words. Words
 * close in meaning (synonyms, similar) and the word's own forms are left out.
 * @param {EnglishResult} result
 * @param {string[]} [more]  Recent and popular words.
 */
export function otherWords(result, more = []) {
	const own = new Set([result.query, ...result.entries.map((s) => s.word), ...result.forms.map(([w]) => w), ...result.forms_of.map(([w]) => w), ...result.variant_of, ...result.synonyms, ...result.similar].map((w) => w.toLowerCase()));
	/** @type {string[]} */
	const out = [];
	for (const w of [...result.opposite, ...result.related, ...result.broader, ...more]) {
		const key = w.trim().toLowerCase();
		if (!key || own.has(key) || out.some((x) => x.toLowerCase() === key)) continue;
		// English words of a word or two; a question about a long phrase reads badly.
		if (!/^[A-Za-z][A-Za-z' -]*$/.test(w) || w.split(' ').length > 2) continue;
		out.push(w.trim());
	}
	return out;
}

/**
 * @template T
 * @param {T[]} list
 * @param {() => number} random
 * @returns {T[]}
 */
function shuffle(list, random) {
	const out = [...list];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/**
 * Other words' meanings, one a word, none the target has: a sense of the
 * same part of speech first, so a Myanmar ending (-သည်, -သော) gives nothing away.
 * @param {Set<string>} taken  Glosses that may not be offered; grows.
 * @param {EnglishResult[]} others
 * @param {string} type
 * @param {number} n
 * @returns {Array<{ word: string, gloss: string }>}
 */
function borrowed(taken, others, type, n) {
	/** @type {Array<{ word: string, gloss: string, same: boolean }>} */
	const found = [];
	for (const other of others) {
		const senses = reviewed(other);
		const pick = senses.find((s) => s.type === type) ?? senses[0];
		const gloss = pick?.glosses.find((g) => !taken.has(g));
		if (!pick || !gloss) continue;
		taken.add(gloss);
		found.push({ word: other.entries.find((s) => s.kind === 'Active')?.word ?? other.query, gloss, same: pick.type === type });
	}
	return [...found.filter((f) => f.same), ...found.filter((f) => !f.same)].slice(0, n);
}

/**
 * "Which one means love?", with Myanmar meanings to choose from.
 * @param {EnglishResult} target
 * @param {EnglishResult[]} others
 * @param {Reviewed} sense
 * @param {() => number} random
 * @returns {Question | null}
 */
function enToMy(target, others, sense, random) {
	const word = target.entries[0].word;
	const wrong = borrowed(allGlosses(target), others, sense.type, MOST_CHOICES - 1);
	if (wrong.length < FEWEST_CHOICES - 1) return null;
	const choices = [{ text: sense.glosses[0], right: true, word }, ...wrong.map((w) => ({ text: w.gloss, right: false, word: w.word }))];
	return { kind: 'en-my', word, prompt: word, choices: shuffle(choices, random), answer: sense };
}

/**
 * A Myanmar meaning, with English words to choose from.
 * @param {EnglishResult} target
 * @param {EnglishResult[]} others
 * @param {Reviewed} sense
 * @param {string} gloss
 * @param {() => number} random
 * @returns {Question | null}
 */
function myToEn(target, others, sense, gloss, random) {
	const word = target.entries[0].word;
	// A word that has this meaning too would be right as well.
	const fit = others.filter((o) => !allGlosses(o).has(gloss));
	const wrong = borrowed(new Set(allGlosses(target)), fit, sense.type, MOST_CHOICES - 1);
	if (wrong.length < FEWEST_CHOICES - 1) return null;
	const choices = [{ text: word, right: true, note: gloss }, ...wrong.map((w) => ({ text: w.word, right: false, note: w.gloss }))];
	return { kind: 'my-en', word, prompt: gloss, choices: shuffle(choices, random), answer: sense };
}

/**
 * The word heard, with English words to choose from: the word's own, and
 * words that sound nothing alike (others' headwords).
 * @param {EnglishResult} target
 * @param {EnglishResult[]} others
 * @param {Reviewed} sense
 * @param {() => number} random
 * @returns {Question | null}
 */
function listen(target, others, sense, random) {
	const word = target.entries[0].word;
	/** @type {Choice[]} */
	const wrong = [];
	for (const o of others) {
		const s = reviewed(o)[0];
		const w = o.entries.find((e) => e.kind === 'Active')?.word ?? o.query;
		const lw = w.toLowerCase();
		const lt = word.toLowerCase();
		// Words with the word in them (lovable, love affair) sound like it: no fair choice.
		if (!s || lw.includes(lt) || lt.includes(lw) || wrong.some((c) => c.text.toLowerCase() === lw)) continue;
		wrong.push({ text: w, right: false, note: s.glosses[0] });
		if (wrong.length === MOST_CHOICES - 1) break;
	}
	if (wrong.length < FEWEST_CHOICES - 1) return null;
	return { kind: 'listen', word, prompt: word, choices: shuffle([{ text: word, right: true, note: sense.glosses[0] }, ...wrong], random), answer: sense };
}

/**
 * A Myanmar meaning, and the English word typed for it.
 * @param {EnglishResult} target
 * @param {Reviewed} sense
 * @param {string} gloss
 * @returns {Question | null}
 */
function typed(target, sense, gloss) {
	const word = target.entries[0].word;
	// Letters only, and long enough that the first letter does not give it away.
	if (!/^[A-Za-z]{3,20}$/.test(word)) return null;
	return { kind: 'type', word, prompt: gloss, hint: word[0].toLowerCase(), choices: [{ text: word, right: true, note: gloss }], answer: sense };
}

/**
 * An example of the word, and which of its own meanings the example uses.
 * Only when the word has two or more reviewed meanings that read differently.
 * @param {EnglishResult} target
 * @param {Reviewed[]} senses
 * @param {() => number} random
 * @returns {Question | null}
 */
function whichSense(target, senses, random) {
	const word = target.entries[0].word;
	/** @type {Reviewed[]} */
	const distinct = [];
	for (const s of senses) if (!distinct.some((d) => d.glosses[0] === s.glosses[0])) distinct.push(s);
	if (distinct.length < 2) return null;
	for (const sense of shuffle(distinct, random)) {
		if (!sense.example) continue;
		const item = itemsOf(sense.example)
			.flatMap((it) => (it.t === 'text' ? [it.text] : []))
			.find((t) => !/^<[^<>]*\/[^<>]*>$/.test(t.trim()));
		if (!item) continue;
		const text = plainItem(item, word);
		if (text.length < 8) continue;
		const pick = [sense, ...distinct.filter((d) => d !== sense)].slice(0, MOST_CHOICES);
		const choices = pick.map((d) => ({ text: d.glosses[0], right: d === sense, note: d.type }));
		return { kind: 'sense', word, prompt: text, choices: shuffle(choices, random), answer: sense };
	}
	return null;
}

/**
 * How near a typed word is to the word asked for: right, one slip off
 * (a letter missing, added, changed or two swapped, in a word of four
 * letters or more), or wrong. Case and spaces at the ends do not matter.
 * @param {string} typedText
 * @param {string} word
 * @returns {'right' | 'close' | 'wrong'}
 */
export function checkTyped(typedText, word) {
	const a = typedText.trim().toLowerCase();
	const b = word.trim().toLowerCase();
	if (a === b) return 'right';
	if (b.length < 4 || Math.abs(a.length - b.length) > 1) return 'wrong';
	// One letter swapped with the next.
	for (let i = 0; i + 1 < b.length; i++) if (a === b.slice(0, i) + b[i + 1] + b[i] + b.slice(i + 2)) return 'close';
	// Edit distance of one.
	let i = 0;
	while (i < a.length && i < b.length && a[i] === b[i]) i++;
	const rest = (/** @type {number} */ x, /** @type {number} */ y) => a.slice(i + x) === b.slice(i + y);
	return rest(1, 1) || rest(0, 1) || rest(1, 0) ? 'close' : 'wrong';
}

/**
 * Up to `n` questions for one round on a word, with variety: one about
 * the meaning (en-my), one recalling the word (my-en, listen or type) and
 * one about its use (gap or sense), each picked at random among those made.
 * @param {Question[]} questions
 * @param {number} [n]
 * @param {() => number} [random]
 */
export function pickRound(questions, n = 3, random = Math.random) {
	const groups = [['en-my'], ['my-en', 'listen', 'type'], ['gap', 'sense']];
	/** @type {Question[]} */
	const out = [];
	for (const g of groups) {
		const can = questions.filter((q) => g.includes(q.kind));
		if (can.length) out.push(can[Math.floor(random() * can.length)]);
	}
	for (const q of questions) if (out.length < n && !out.includes(q)) out.push(q);
	return out.slice(0, n).sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind));
}

/** The verb forms a gap can ask for. */
const VERB_FORMS = new Set(['third person', 'past', 'past participle', '-ing']);

/**
 * The word before the gap decides which forms fit it; the wrong choices are
 * forms that cannot. "She ___ her family": loves or loved fit, so loved is
 * never offered beside loves; love and loving cannot.
 * @type {Array<[RegExp, Set<string>]>}
 */
const CUES = [
	[/^(to|will|would|can|could|shall|should|may|might|must|do|does|did|don't|doesn't|didn't|won't|can't|cannot|let's|please)$/, new Set(['base'])],
	[/^(has|have|had|hasn't|haven't|hadn't|i've|you've|we've|they've)$/, new Set(['past participle'])],
	[/^(am|is|are|was|were|be|been|being|isn't|aren't|wasn't|weren't)$/, new Set(['-ing', 'past participle'])],
	[/^(he|she|it)$/, new Set(['third person', 'past'])],
	[/^(i|you|we|they)$/, new Set(['base', 'past'])],
];

/**
 * Fill the gap in one of the word's own examples with one of its own forms.
 * @param {EnglishResult} target
 * @param {Reviewed[]} senses
 * @param {() => number} random
 * @returns {Question | null}
 */
function gap(target, senses, random) {
	const word = target.entries[0].word;
	/** @type {Map<string, Set<string>>} spelling → its forms */
	const forms = new Map([[word.toLowerCase(), new Set(['base'])]]);
	for (const [spelling, pos, form] of target.forms) {
		if (pos !== 'verb' || !VERB_FORMS.has(form)) continue;
		const key = spelling.toLowerCase();
		forms.set(key, (forms.get(key) ?? new Set()).add(form));
	}
	if (forms.size < FEWEST_CHOICES) return null;
	const spellings = [...forms.keys()].sort((a, b) => b.length - a.length).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
	const find = new RegExp(`\\b(${spellings.join('|')})\\b`, 'gi');
	for (const sense of senses.filter((s) => s.type === 'Verb' && s.example)) {
		const items = itemsOf(sense.example).flatMap((it) => (it.t === 'text' ? [it.text] : []));
		for (const item of items) {
			// The forms line (<love/loved/loved>) is the answer itself.
			if (/^<[^<>]*\/[^<>]*>$/.test(item.trim())) continue;
			const text = plainItem(item, word);
			const hits = [...text.matchAll(find)];
			if (hits.length !== 1) continue;
			const hit = hits[0];
			const at = hit.index ?? 0;
			const before = text.slice(0, at);
			const cue = /([A-Za-z']+)\s*$/.exec(before)?.[1]?.toLowerCase() ?? '';
			const fits = CUES.find(([re]) => re.test(cue))?.[1];
			const said = hit[0].toLowerCase();
			if (!fits || ![...(forms.get(said) ?? [])].some((f) => fits.has(f))) continue;
			const cannot = [...forms].filter(([, f]) => ![...f].some((x) => fits.has(x))).map(([s]) => s);
			if (cannot.length < FEWEST_CHOICES - 1) continue;
			const cap = (/** @type {string} */ s) => (/^[A-Z]/.test(hit[0]) ? s[0].toUpperCase() + s.slice(1) : s);
			const label = (/** @type {string} */ s) => [...(forms.get(s) ?? [])].join(', ');
			const choices = [{ text: cap(said), right: true, note: label(said) }, ...shuffle(cannot.map((s) => ({ text: cap(s), right: false, note: label(s) })), random).slice(0, MOST_CHOICES - 1)];
			return { kind: 'gap', word, before, after: text.slice(at + hit[0].length), choices: shuffle(choices, random), answer: sense };
		}
	}
	return null;
}

/**
 * Up to three questions on a word: its meaning in Myanmar, a Myanmar
 * meaning back to English, and a gap in its own example. Fewer when the
 * entry or the other words cannot make one; none when it has no reviewed sense.
 * @param {EnglishResult} target
 * @param {EnglishResult[]} others  Lookups of otherWords(target), best first.
 * @param {{ random?: () => number, kinds?: Array<Question['kind']> }} [opts]
 * @returns {Question[]}
 */
export function makeQuestions(target, others, opts = {}) {
	const { random = Math.random, kinds = ['en-my', 'my-en', 'gap'] } = opts;
	// listen, type and sense are asked for by name: a caller that cannot play sound leaves listen out.
	const senses = reviewed(target);
	if (!senses.length || !target.entries.length) return [];
	const usable = others.filter((o) => o.language === 'en' && o.entries.length && o.query.toLowerCase() !== target.query.toLowerCase());
	/** @type {Question[]} */
	const out = [];
	const first = senses[0];
	if (kinds.includes('en-my')) {
		const q = enToMy(target, usable, first, random);
		if (q) out.push(q);
	}
	if (kinds.includes('my-en')) {
		// Another meaning than the first question's, when there is one.
		const other = senses.find((s) => s.glosses[0] !== first.glosses[0]);
		const sense = other ?? first;
		const gloss = other ? other.glosses[0] : (first.glosses[1] ?? first.glosses[0]);
		const q = myToEn(target, usable, sense, gloss, random);
		if (q) out.push(q);
	}
	if (kinds.includes('gap')) {
		const q = gap(target, senses, random);
		if (q) out.push(q);
	}
	if (kinds.includes('listen')) {
		const q = listen(target, usable, first, random);
		if (q) out.push(q);
	}
	if (kinds.includes('type')) {
		const other = senses.find((s) => s.glosses[0] !== first.glosses[0]) ?? first;
		const q = typed(target, other, other.glosses[0]);
		if (q) out.push(q);
	}
	if (kinds.includes('sense')) {
		const q = whichSense(target, senses, random);
		if (q) out.push(q);
	}
	return out;
}

/**
 * @typedef {{ box: number, due: number, seen: number }} WordProgress
 *   box: rounds in a row answered right; due: the day it comes back.
 * @typedef {{ words: Record<string, WordProgress>, streak: number, last: number | null }} Progress
 *   last: the day of the last round; days are counted from 1970-01-01 in local time.
 */

/** @returns {Progress} */
export function noProgress() {
	return { words: {}, streak: 0, last: null };
}

/**
 * Today as a day number, in the device's time zone.
 * @param {Date} [now]
 */
export function dayOf(now = new Date()) {
	return Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000);
}

/**
 * A round on a word: all right moves it to the next box, which comes back
 * later; anything wrong starts it again tomorrow. A round on a new day
 * after one the day before grows the streak.
 * @param {Progress} progress
 * @param {string} word
 * @param {boolean} right
 * @param {number} today
 * @returns {Progress}
 */
export function recordRound(progress, word, right, today) {
	const key = word.toLowerCase();
	const was = progress.words[key] ?? { box: 0, due: today, seen: 0 };
	const box = right ? Math.min(was.box + 1, REVIEW_DAYS.length) : 0;
	const due = today + (right ? REVIEW_DAYS[box - 1] : 1);
	const streak = progress.last === today ? Math.max(progress.streak, 1) : progress.last === today - 1 ? progress.streak + 1 : 1;
	return { words: { ...progress.words, [key]: { box, due, seen: was.seen + 1 } }, streak, last: today };
}

/**
 * The streak as of today: kept through yesterday, gone after a missed day.
 * @param {Progress} progress
 * @param {number} today
 */
export function streakOf(progress, today) {
	return progress.last !== null && progress.last >= today - 1 ? progress.streak : 0;
}

/** @param {Progress} progress */
export function learnedCount(progress) {
	return Object.values(progress.words).filter((w) => w.box >= LEARNED_BOX).length;
}

/**
 * Words due today or before, the longest waiting first.
 * @param {Progress} progress
 * @param {number} today
 */
export function dueWords(progress, today) {
	return Object.entries(progress.words)
		.filter(([, w]) => w.due <= today)
		.sort((a, b) => a[1].due - b[1].due)
		.map(([word]) => word);
}

/**
 * A stored value read back, or nothing kept when it is not one.
 * @param {unknown} value
 * @returns {Progress}
 */
export function readProgress(value) {
	if (!value || typeof value !== 'object') return noProgress();
	const v = /** @type {Record<string, unknown>} */ (value);
	/** @type {Record<string, WordProgress>} */
	const words = {};
	if (v.words && typeof v.words === 'object') {
		for (const [k, w] of Object.entries(/** @type {Record<string, any>} */ (v.words))) {
			if (w && Number.isInteger(w.box) && Number.isInteger(w.due) && Number.isInteger(w.seen)) words[k] = { box: w.box, due: w.due, seen: w.seen };
		}
	}
	return { words, streak: Number.isInteger(v.streak) ? /** @type {number} */ (v.streak) : 0, last: Number.isInteger(v.last) ? /** @type {number} */ (v.last) : null };
}

/** Words a progress keeps at most; the ones answered longest ago go first. */
export const PROGRESS_WORDS_MAX = 5000;

/**
 * Two progresses of one learner, as two devices kept them, made one: a
 * word answered on both keeps the record with more rounds (on a tie, the
 * later return); the streak is the one of the later round.
 * @param {Progress} a
 * @param {Progress} b
 * @returns {Progress}
 */
export function mergeProgress(a, b) {
	/** @type {Record<string, WordProgress>} */
	const words = { ...a.words };
	for (const [k, w] of Object.entries(b.words)) {
		const mine = words[k];
		if (!mine || w.seen > mine.seen || (w.seen === mine.seen && w.due > mine.due)) words[k] = w;
	}
	const later = (a.last ?? -1) > (b.last ?? -1) ? a : (b.last ?? -1) > (a.last ?? -1) ? b : null;
	const streak = later ? later.streak : Math.max(a.streak, b.streak);
	const last = later ? later.last : a.last;
	// Over the limit: the words due latest stay, those learned long ago and those never coming back soon go.
	const kept = Object.entries(words);
	if (kept.length > PROGRESS_WORDS_MAX) {
		kept.sort((x, y) => y[1].due - x[1].due);
		kept.length = PROGRESS_WORDS_MAX;
	}
	return { words: Object.fromEntries(kept), streak, last };
}
