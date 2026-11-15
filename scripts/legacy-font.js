// @ts-check
/**
 * Converts Burmese text typed in the legacy Arlarwade/Amyanmar fonts (the
 * encoding of the Myanmar Language Commission's 2013 မြန်မာသဒ္ဒါ PDF) to
 * Unicode. Node standard library only.
 *
 *   node scripts/legacy-font.js extracted.txt          one legacy line in, one Unicode line out
 *   pdftotext -raw book.pdf - | node scripts/legacy-font.js
 *   node scripts/legacy-font.js --lenient extracted.txt
 *
 * Input is text already pulled out of the PDF in content-stream order (for
 * example by `pdftotext -raw`). Two private-use markers carry what an
 * extractor knows about fonts and the converter cannot see:
 *
 *   U+E001             the ellipsis glyph of the Gautami font (written "...")
 *   U+E010 … U+E011    text set in a Latin font, passed through unchanged
 *
 * A character outside the mapping stops the run with its line and column,
 * so an unknown glyph is never written out as Latin text. --lenient passes
 * such characters through instead.
 *
 * Mark order follows the thuddar data: asat before dot-below (င့်).
 */
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

/** Legacy glyph code → Unicode. U+E000 marks kinzi, placed after its consonant. */
export const GLYPHS = new Map(Object.entries({
	// consonants
	k: 'က', K: 'ခ', g: 'ဂ', G: 'ဃ', c: 'င', s: 'စ', S: 'ဆ', z: 'ဇ', Z: 'ဈ', 'ˆ': 'ဉ', v: 'ည',
	F: 'ဋ', '!': 'ဋ', '@': 'ဌ', '#': 'ဍ', $: 'ဎ', '*': 'ဏ', t: 'တ', T: 'ထ', d: 'ဒ', D: 'ဓ',
	n: 'န', N: 'န', p: 'ပ', P: 'ဖ', b: 'ဗ', B: 'ဘ', m: 'မ', y: 'ယ', r: 'ရ', R: 'ရ', l: 'လ',
	w: 'ဝ', q: 'သ', h: 'ဟ', L: 'ဠ', A: 'အ', Q: 'ဿ',
	// independent vowels and symbols
	I: 'ဣ', 'È': 'ဤ', U: 'ဥ', E: 'ဧ', 'É': 'ဦ', 'ñ': 'ဩ', j: '၍', f: '၏', 'Ò': '၌', '&': '၎',
	// dependent vowels and signs
	a: 'ာ', 'å': 'ါ', 'Å': 'ါ်', i: 'ိ', '^': 'ီ', u: 'ု', o: 'ု', '¨': 'ူ', 'ø': 'ူ', e: 'ေ',
	'´': 'ဲ', M: 'ံ', '˜': 'ိံ', '\\': '်', ';': 'း', '.': '့', '>': '့', 'Ï': '့', 'Ó': '့',
	// medials
	'¥': 'ျ', '®': 'ြ', 'Â': 'ြ', '”': 'ြ', '“': 'ြ', X: 'ွ', x: 'ှ', H: 'ှ', W: 'ွှ', Y: 'ျှ',
	'Á': 'ျွ', O: 'ှု',
	// kinzi, and kinzi with ီ
	'ç': '', 'Ç': 'ီ',
	// lower halves of stacked consonants
	'¶': '္က', 'ƒ': '္ခ', '©': '္ဂ', 'Ì': '္ဃ', 'ß': '္စ', 'Í': '္ဆ', '«': '္ဇ', 'Û': '္ဈ',
	'|': '္တ', 'î': '္တ', 'Ê': '္ထ', '»': '္ဒ', 'Î': '္ဓ', '~': '္န', J: '္ပ', 'Ä': '္ဖ',
	'`': '္ဗ', '±': '္ဘ', 'µ': '္မ', '¬': '္လ', 'œ': '',
	// whole stacked pairs
	'¡': 'ဋ္ဋ', '£': 'ဍ္ဍ', '•': 'ဏ္ဏ', '™': 'ဋ္ဌ', '¤': 'ဏ္ဌ', '§': 'ဏ္ဋ', '‹': 'ဏ္ဍ', '¢': 'ဍ္ဎ',
	// digits and punctuation
	0: '၀', 1: '၁', 2: '၂', 3: '၃', 4: '၄', 5: '၅', 6: '၆', 7: '၇', 8: '၈', 9: '၉',
	'"': '။', "'": '၊', '{': "'", '}': "'", '<': "'", '‰': "'", '…': '...', '': '...',
	'́': '',
	// passed through as they are
	' ': ' ', '(': '(', ')': ')', '+': '+', '=': '=', '-': '-', '/': '/', '_': '_', ',': ',',
	'?': '?', '%': '%', '\t': ' ',
}));

const KINZI = '';
const CONSONANTS = new Set('ကခဂဃငစဆဇဈဉညဋဌဍဎဏတထဒဓနပဖဗဘမယရလဝသဟဠအဿဣဤဥဧဩ၎');
const PREFIXES = new Set(['ေ', 'ြ']);
/** Unicode storage order of the signs inside one cluster. */
const RANK = new Map([
	[KINZI, 0], ['ျ', 3], ['ြ', 4], ['ွ', 5], ['ှ', 6], ['ေ', 7], ['ိ', 8], ['ီ', 9], ['ု', 10],
	['ူ', 11], ['ဲ', 12], ['ါ', 13], ['ာ', 13], ['ံ', 14], ['်', 15], ['့', 16], ['း', 17],
]);
const VIRAMA = '္';

/**
 * Glyph codes → Unicode characters, still in visual order.
 * @param {string} line
 * @param {{ lenient?: boolean }} [opts]
 * @returns {string}
 */
export function mapGlyphs(line, opts = {}) {
	let out = '';
	let latin = false;
	let col = 0;
	for (const ch of line) {
		col += 1;
		if (ch === '') { latin = true; continue; }
		if (ch === '') { latin = false; continue; }
		if (latin) { out += ch; continue; }
		const u = GLYPHS.get(ch);
		if (u !== undefined) out += u;
		else if (opts.lenient) out += ch;
		else throw new Error(`legacy-font: no mapping for "${ch}" (U+${ch.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')}) at column ${col}`);
	}
	return out;
}

/**
 * Visual order → Unicode logical order, one consonant cluster at a time:
 * prefixed ေ and ြ move after their consonant, kinzi moves before it, and
 * the signs are sorted into storage order with duplicates (from fake bold)
 * dropped.
 * @param {string} text
 */
export function reorder(text) {
	const chars = [...text];
	let out = '';
	/** @type {string[]} */
	let pending = [];
	/** @type {{ base: string[], marks: string[] } | null} */
	let cluster = null;

	const flush = () => {
		if (!cluster) return;
		const kinzi = cluster.marks.includes(KINZI);
		const marks = [...new Set(cluster.marks.filter((m) => m !== KINZI))]
			.sort((a, b) => /** @type {number} */ (RANK.get(a)) - /** @type {number} */ (RANK.get(b)));
		out += (kinzi ? 'င်္' : '') + cluster.base.join('') + marks.join('');
		cluster = null;
	};
	const baseFollows = (/** @type {number} */ i) => {
		let j = i + 1;
		while (j < chars.length && PREFIXES.has(chars[j])) j += 1;
		return j < chars.length && CONSONANTS.has(chars[j]);
	};

	for (let i = 0; i < chars.length; i += 1) {
		const ch = chars[i];
		if (PREFIXES.has(ch)) {
			if (!cluster || baseFollows(i)) {
				flush();
				pending.push(ch);
			} else cluster.marks.push(ch);
		} else if (CONSONANTS.has(ch)) {
			if (cluster && cluster.base.at(-1) === VIRAMA) cluster.base.push(ch);
			else {
				flush();
				cluster = { base: [ch], marks: pending };
				pending = [];
			}
		} else if (ch === VIRAMA) {
			if (cluster) cluster.base.push(ch);
			else out += ch;
		} else if (RANK.has(ch)) {
			if (cluster) cluster.marks.push(ch);
			else out += ch;
		} else if (ch === ' ' && cluster && i + 1 < chars.length
			&& ((RANK.has(chars[i + 1]) && !PREFIXES.has(chars[i + 1])) || chars[i + 1] === VIRAMA)) {
			// a gap the extractor put inside a cluster
		} else {
			flush();
			out += pending.join('') + ch;
			pending = [];
		}
	}
	flush();
	return out + pending.join('');
}

/**
 * Spellings the font draws with a look-alike letter.
 * @param {string} text
 */
export function normalize(text) {
	return text
		.replaceAll('ဦ', 'ဦ')
		.replaceAll('ဥ်', 'ဉ်')
		.replaceAll(`ဥ${VIRAMA}`, `ဉ${VIRAMA}`)
		.replaceAll('ကျွနု်ပ်', 'ကျွန်ုပ်')
		.replaceAll('ေဩာ်', 'ဪ')
		.replace(/\(\s*([က-အ]{1,2}(?:\s?[က-အ])?)\s*\)/g, (_, m) => `(${m.replace(' ', '')})`)
		.replace(/ {2,}/g, ' ')
		.trim();
}

/**
 * @param {string} line  Legacy-encoded text.
 * @param {{ lenient?: boolean }} [opts]
 */
export function convert(line, opts) {
	return normalize(reorder(mapGlyphs(line, opts)));
}

async function main() {
	const args = process.argv.slice(2);
	const lenient = args.includes('--lenient');
	const files = args.filter((a) => !a.startsWith('--'));
	const unknown = args.filter((a) => a.startsWith('--') && a !== '--lenient');
	if (unknown.length) throw new Error(`legacy-font: unknown option ${unknown.join(', ')}`);
	if (files.length > 1) throw new Error('legacy-font: give one input file, or none to read standard input');

	let text = '';
	if (files.length) text = await readFile(files[0], 'utf8');
	else for await (const chunk of process.stdin) text += chunk;

	const lines = text.replace(/\r\n/g, '\n').split('\n');
	const out = lines.map((line, i) => {
		try {
			return convert(line, { lenient });
		} catch (err) {
			throw new Error(`${/** @type {Error} */ (err).message}, line ${i + 1}`);
		}
	});
	process.stdout.write(out.join('\n'));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	main().catch((err) => {
		console.error(err.message);
		process.exit(1);
	});
}
