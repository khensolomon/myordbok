// @ts-check
/**
 * Spellings one common slip away from a Myanmar word: the medials ျ and ြ,
 * the long and short vowels, the tone marks, consonants that sound alike,
 * and finals that sound alike (န် မ် ံ, တ် က် ပ်).
 *
 * Two uses (worker/routes/help.js): a searched word that is not in the
 * dictionary, against the variants that are, makes a spelling question for
 * native readers; a dictionary word, against variants that are not, makes a
 * check question whose right answer is known.
 */

/** Characters often written for each other: each pair goes both ways. */
const PAIRS = [
	['ျ', 'ြ'], // ျ ြ
	['ိ', 'ီ'], // ိ ီ
	['ု', 'ူ'], // ု ူ
	['ါ', 'ာ'], // ါ ာ
	['ဏ', 'န'], // ဏ န
	['ဋ', 'တ'], // ဋ တ
	['ဍ', 'ဒ'], // ဍ ဒ
	['ဓ', 'ဒ'], // ဓ ဒ
	['ဈ', 'ဇ'], // ဈ ဇ
	['ဉ', 'ည'], // ဉ ည
	['ဥ', 'ဉ'], // ဥ ဉ
	['ယ', 'ရ'], // ယ ရ
	['ဘ', 'ဗ'], // ဘ ဗ
];

/** Finals that sound alike: any one written for another. */
const FINALS = [
	['န်', 'မ်', 'ံ'], // န် မ် ံ
	['တ်', 'က်', 'ပ်'], // တ် က် ပ်
];

/** Tone marks that are easily left out. */
const TONES = ['း', '့']; // း ့

/** @type {Map<string, string[]>} */
const SWAPS = new Map();
for (const [a, b] of PAIRS) {
	SWAPS.set(a, [...(SWAPS.get(a) ?? []), b]);
	SWAPS.set(b, [...(SWAPS.get(b) ?? []), a]);
}

/**
 * @param {string} word  In Unicode, NFC.
 * @returns {string[]}  Distinct, without the word itself, in a stable order.
 */
export function variants(word) {
	/** @type {Set<string>} */
	const out = new Set();
	const chars = [...word];
	chars.forEach((c, i) => {
		for (const other of SWAPS.get(c) ?? []) out.add([...chars.slice(0, i), other, ...chars.slice(i + 1)].join(''));
		// A tone mark left out.
		if (TONES.includes(c)) out.add([...chars.slice(0, i), ...chars.slice(i + 1)].join(''));
	});
	for (const group of FINALS) {
		for (const from of group) {
			let at = word.indexOf(from);
			while (at !== -1) {
				for (const to of group) if (to !== from) out.add(word.slice(0, at) + to + word.slice(at + from.length));
				at = word.indexOf(from, at + 1);
			}
		}
	}
	// A visarga added where the word has none at its end.
	if (!/[့း်]$/.test(word)) out.add(`${word}း`);
	out.delete(word);
	return [...out].map((v) => v.normalize('NFC')).filter((v, i, all) => v !== word && all.indexOf(v) === i);
}

/** Whether text is a Myanmar word a variant can be made of: Myanmar letters only, 2 to 30 of them. */
export function variable(/** @type {string} */ text) {
	return /^[က-႟]{2,30}$/.test(text);
}
