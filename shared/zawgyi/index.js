// @ts-check
/**
 * Zawgyi: the font hack many Myanmar phones and keyboards still write in. It
 * uses the code points of Unicode Myanmar with other meanings and in another
 * order, so Zawgyi text looks right on a Zawgyi phone and is a different
 * string to the dictionary, which is in Unicode.
 *
 * The detector and the converter are Google's (myanmar-tools 1.2.0, Apache
 * 2.0; model.js and z2u.js are its data, LICENSE its license); this file is
 * their code ported to plain JavaScript, plus how MyOrdbok uses them:
 *
 *   search     a Myanmar query that finds no entry is read again in Unicode
 *              when it looks like Zawgyi (zawgyiReading); the page says so
 *   writing    comments, suggestions and messages in Zawgyi are not kept:
 *              the form offers the Unicode, the Worker refuses Zawgyi
 *              (refuseZawgyi)
 *
 * The detector gives the probability that text is Zawgyi rather than
 * Unicode. Long text is clear-cut; one short word can be valid in both, so
 * search only converts what as typed found nothing.
 */
import { MODEL } from './model.js';
import { getAllRulesZ2U } from './z2u.js';
import { AppError } from '../errors.js';

/**
 * Sure: written text at or above this is Zawgyi (Google's own suggested
 * cut-off). Search reads such a query in Unicode whatever that finds.
 */
export const ZAWGYI_SURE = 0.95;
/** Likely: search reads the query in Unicode, and keeps it only if that finds an entry. */
export const ZAWGYI_LIKELY = 0.5;

// ---------------------------------------------------------------- detector

const STD_CP0 = 0x1000;
const STD_CP1 = 0x103f;
const AFT_CP0 = 0x104a;
const AFT_CP1 = 0x109f;
const EXA_CP0 = 0xaa60;
const EXA_CP1 = 0xaa7f;
const EXB_CP0 = 0xa9e0;
const EXB_CP1 = 0xa9ff;
const SPC_CP0 = 0x2000;
const SPC_CP1 = 0x200b;
const STD_OFFSET = 1;
const AFT_OFFSET = STD_OFFSET + STD_CP1 - STD_CP0 + 1;
const EXA_OFFSET = AFT_OFFSET + AFT_CP1 - AFT_CP0 + 1;
const EXB_OFFSET = EXA_OFFSET + EXA_CP1 - EXA_CP0 + 1;
const SPC_OFFSET = EXB_OFFSET + EXB_CP1 - EXB_CP0 + 1;

/**
 * The Markov state of a code point: Myanmar, its extensions and spaces have
 * one each; everything else is state 0.
 * @param {number} cp
 * @param {number} ssv  0: spaces have states; 1: they do not.
 */
function stateOf(cp, ssv) {
	if (STD_CP0 <= cp && cp <= STD_CP1) return cp - STD_CP0 + STD_OFFSET;
	if (AFT_CP0 <= cp && cp <= AFT_CP1) return cp - AFT_CP0 + AFT_OFFSET;
	if (EXA_CP0 <= cp && cp <= EXA_CP1) return cp - EXA_CP0 + EXA_OFFSET;
	if (EXB_CP0 <= cp && cp <= EXB_CP1) return cp - EXB_CP0 + EXB_OFFSET;
	if (ssv === 0 && SPC_CP0 <= cp && cp <= SPC_CP1) return cp - SPC_CP0 + SPC_OFFSET;
	return 0;
}

/**
 * @param {DataView} view
 * @param {number} offset
 * @param {number} lead
 * @param {number} trail
 * @param {number} version  -1: not checked or read.
 */
function expectTag(view, offset, lead, trail, version) {
	const got = [view.getUint32(offset), view.getUint32(offset + 4)];
	if (got[0] !== lead || got[1] !== trail) throw new Error(`Zawgyi model: unexpected tag ${got.map((n) => n.toString(16)).join(' ')}`);
	offset += 8;
	if (version !== -1) {
		const v = view.getUint32(offset);
		if (v !== version) throw new Error(`Zawgyi model: unexpected version ${v}`);
		offset += 4;
	}
	return offset;
}

/**
 * The model: log-probability differences (Unicode − Zawgyi) of each
 * transition from one state to the next.
 * @returns {{ ssv: number, delta: Float64Array[] }}
 */
function loadModel() {
	const bytes = Uint8Array.from(atob(MODEL), (c) => c.charCodeAt(0));
	const view = new DataView(bytes.buffer);
	let offset = expectTag(view, 0, 0x555a4d4f, 0x44454c20, -1);
	const version = view.getUint32(offset);
	offset += 4;
	let ssv = 0;
	if (version === 2) {
		ssv = view.getUint32(offset);
		offset += 4;
	} else if (version !== 1) throw new Error(`Zawgyi model: serial version ${version}`);
	offset = expectTag(view, offset, 0x424d4152, 0x4b4f5620, 0);
	const size = view.getInt16(offset);
	offset += 2;
	/** @type {Float64Array[]} */
	const delta = [];
	for (let i1 = 0; i1 < size; i1++) {
		const row = new Float64Array(size);
		let entries = view.getInt16(offset);
		offset += 2;
		let fallback = 0;
		if (entries !== 0) {
			fallback = view.getFloat32(offset);
			offset += 4;
		}
		let next = -1;
		for (let i2 = 0; i2 < size; i2++) {
			if (entries > 0 && next < i2) {
				next = view.getInt16(offset);
				offset += 2;
				entries--;
			}
			if (next === i2) {
				row[i2] = view.getFloat32(offset);
				offset += 4;
			} else row[i2] = fallback;
		}
		delta.push(row);
	}
	return { ssv, delta };
}

/** Read once, on first use. @type {ReturnType<typeof loadModel> | null} */
let model = null;

/**
 * The probability that the text is Zawgyi rather than Unicode, from 0
 * (surely Unicode) to 1 (surely Zawgyi); -Infinity when it has no Myanmar.
 * @param {string} text
 */
export function zawgyiProbability(text) {
	model ??= loadModel();
	let prev = 0;
	let total = 0;
	let seen = false;
	for (let i = 0; i <= text.length; i++) {
		const state = i === text.length ? 0 : stateOf(text.charCodeAt(i), model.ssv);
		if (prev !== 0 || state !== 0) {
			total += model.delta[prev][state];
			seen = true;
		}
		prev = state;
	}
	return seen ? 1 / (1 + Math.exp(total)) : Number.NEGATIVE_INFINITY;
}

// ---------------------------------------------------------------- converter

/** @typedef {{ p: RegExp, s: string, matchOnStart?: string, revisit?: number }} Rule */

/**
 * One phase of the transliteration, as Google's runPhase: at each position
 * every rule is tried in turn on the rest of the text.
 * @param {Rule[]} rules
 * @param {string} input
 */
function runPhase(rules, input) {
	let out = '';
	let rest = input;
	let start = true;
	while (rest.length > 0) {
		let matched = false;
		for (const rule of rules) {
			if (rule.matchOnStart != null && !start) continue;
			const m = rest.match(rule.p);
			if (m === null) continue;
			matched = true;
			const right = rest.length - m[0].length;
			rest = rest.replace(rule.p, rule.s);
			const at = rest.length - right;
			if (rule.revisit == null) {
				out += rest.substring(0, at);
				rest = rest.substring(at);
			}
		}
		if (!matched) {
			out += rest[0];
			rest = rest.substring(1);
		}
		start = false;
	}
	return out;
}

/** @type {Rule[][] | null} */
let rules = null;

/**
 * Zawgyi text in Unicode (NFC). Text that is not Zawgyi is changed too:
 * call it on what the detector says is Zawgyi.
 * @param {string} text
 */
export function zawgyiToUnicode(text) {
	rules ??= getAllRulesZ2U();
	let out = text;
	for (const phase of rules) out = runPhase(phase, out);
	return out.normalize('NFC');
}

// ---------------------------------------------------------------- policy

/**
 * The Unicode of text that is surely Zawgyi, or null for anything else.
 * @param {string} text
 */
export function unicodeIfZawgyi(text) {
	if (zawgyiProbability(text) < ZAWGYI_SURE) return null;
	const as = zawgyiToUnicode(text);
	return as === text ? null : as;
}

/**
 * Written text (a comment, a suggestion, a message) is not kept in Zawgyi.
 * The forms offer the Unicode first, so this is the Worker's last check.
 * @param {string} text
 * @param {string} what  For the message: "The comment".
 */
export function refuseZawgyi(text, what) {
	if (unicodeIfZawgyi(text) !== null) {
		throw new AppError('bad_request', `${what} looks like Zawgyi. Write it in Unicode Myanmar; the form offers to convert it.`);
	}
}

/**
 * @typedef {{ q: string, kind: string, zawgyi?: { typed: string, as: string } }} AnyReading
 */

/**
 * Reads a query; a Myanmar one that finds no entry and looks like Zawgyi is
 * read again in Unicode. That reading is kept when it finds an entry, or
 * whatever it finds when the query is surely Zawgyi, and says so in
 * `zawgyi`: what was typed, and what it was read as.
 * @template {AnyReading} R
 * @param {string} q
 * @param {(q: string) => Promise<R>} read
 * @returns {Promise<R>}
 */
export async function zawgyiReading(q, read) {
	const typed = await read(q);
	if (typed.kind === 'entry' || typed.kind === 'phrase') return typed;
	const p = zawgyiProbability(q);
	if (!(p >= ZAWGYI_LIKELY)) return typed;
	const as = zawgyiToUnicode(q);
	if (as === q) return typed;
	const unicode = await read(as);
	if (unicode.kind === 'entry' || p >= ZAWGYI_SURE) return { ...unicode, zawgyi: { typed: q, as } };
	return typed;
}
