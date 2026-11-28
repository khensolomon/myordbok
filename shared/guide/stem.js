// @ts-check
/**
 * English stemming for the guide's index (Porter's algorithm, 1980): the
 * same word in its forms indexes alike, so "marked" finds "markers" and
 * "examples" finds "example". Words of other scripts, and anything short,
 * pass through unchanged.
 */

const VOWEL = /[aeiou]|y(?![aeiou])/;

/** Measure m of a stem: the count of vowel-consonant runs. @param {string} s */
function measure(s) {
	let m = 0;
	let vowelSeen = false;
	for (let i = 0; i < s.length; i++) {
		const v = isVowel(s, i);
		if (v) vowelSeen = true;
		else if (vowelSeen) {
			m++;
			vowelSeen = false;
		}
	}
	return m;
}

/** @param {string} s @param {number} i */
function isVowel(s, i) {
	const c = s[i];
	if ('aeiou'.includes(c)) return true;
	return c === 'y' && i > 0 && !isVowel(s, i - 1);
}

/** @param {string} s */
function hasVowel(s) {
	for (let i = 0; i < s.length; i++) if (isVowel(s, i)) return true;
	return false;
}

/** Ends in a double consonant. @param {string} s */
function doubleConsonant(s) {
	const n = s.length;
	return n > 1 && s[n - 1] === s[n - 2] && !isVowel(s, n - 1);
}

/** Ends consonant-vowel-consonant, the last not w, x or y. @param {string} s */
function cvc(s) {
	const n = s.length;
	return n > 2 && !isVowel(s, n - 1) && isVowel(s, n - 2) && !isVowel(s, n - 3) && !'wxy'.includes(s[n - 1]);
}

/** @type {[string, string][]} */
const STEP2 = [['ational', 'ate'], ['tional', 'tion'], ['enci', 'ence'], ['anci', 'ance'], ['izer', 'ize'], ['bli', 'ble'], ['alli', 'al'], ['entli', 'ent'], ['eli', 'e'], ['ousli', 'ous'], ['ization', 'ize'], ['ation', 'ate'], ['ator', 'ate'], ['alism', 'al'], ['iveness', 'ive'], ['fulness', 'ful'], ['ousness', 'ous'], ['aliti', 'al'], ['iviti', 'ive'], ['biliti', 'ble'], ['logi', 'log']];
/** @type {[string, string][]} */
const STEP3 = [['icate', 'ic'], ['ative', ''], ['alize', 'al'], ['iciti', 'ic'], ['ical', 'ic'], ['ful', ''], ['ness', '']];
const STEP4 = ['al', 'ance', 'ence', 'er', 'ic', 'able', 'ible', 'ant', 'ement', 'ment', 'ent', 'ion', 'ou', 'ism', 'ate', 'iti', 'ous', 'ive', 'ize'];

/**
 * The stem of an English word, lower case; a word under three letters,
 * or with any character outside a–z, is returned as it is.
 * @param {string} word
 */
export function stem(word) {
	let w = word.toLowerCase();
	if (w.length < 3 || !/^[a-z]+$/.test(w)) return w;
	// 1a: plurals
	if (w.endsWith('sses')) w = w.slice(0, -2);
	else if (w.endsWith('ies')) w = w.slice(0, -2);
	else if (!w.endsWith('ss') && w.endsWith('s')) w = w.slice(0, -1);
	// 1b: -ed, -ing
	if (w.endsWith('eed')) {
		if (measure(w.slice(0, -3)) > 0) w = w.slice(0, -1);
	} else {
		const m = /(ed|ing)$/.exec(w);
		if (m && hasVowel(w.slice(0, -m[1].length))) {
			w = w.slice(0, -m[1].length);
			if (/(at|bl|iz)$/.test(w)) w += 'e';
			else if (doubleConsonant(w) && !/[lsz]$/.test(w)) w = w.slice(0, -1);
			else if (measure(w) === 1 && cvc(w)) w += 'e';
		}
	}
	// 1c: y → i
	if (w.endsWith('y') && hasVowel(w.slice(0, -1))) w = `${w.slice(0, -1)}i`;
	// 2, 3: derivational suffixes
	for (const table of [STEP2, STEP3]) {
		for (const [from, to] of table) {
			if (w.endsWith(from)) {
				const base = w.slice(0, -from.length);
				if (measure(base) > 0) w = base + to;
				break;
			}
		}
	}
	// 4
	for (const suf of STEP4) {
		if (w.endsWith(suf)) {
			const base = w.slice(0, -suf.length);
			if (measure(base) > 1 && (suf !== 'ion' || /[st]$/.test(base))) w = base;
			break;
		}
	}
	// 5a: -e
	if (w.endsWith('e')) {
		const base = w.slice(0, -1);
		const m = measure(base);
		if (m > 1 || (m === 1 && !cvc(base))) w = base;
	}
	// 5b: -ll
	if (measure(w) > 1 && doubleConsonant(w) && w.endsWith('l')) w = w.slice(0, -1);
	return w;
}
