// @ts-check
/**
 * A phrase that is not an entry, read from the entries of its words:
 *
 *   king of Denmark  → king (the thing) + Denmark (whose) → ဒိန်းမတ် ဘုရင်
 *   big house        → big (describes) + house           → ကြီးသော အိမ်
 *   school bus       → school + bus                      → ကျောင်း ဘတ်စ်ကား
 *
 * Only these patterns are put together; anything else is read one word at
 * a time. The Myanmar line is made from the entries' own glosses in Myanmar
 * word order, and is shown as made, never as an entry.
 */

/** Words that are never a part of their own. */
const ARTICLES = new Set(['a', 'an', 'the']);

/** Words that make two words a clause or a list, not a phrase. */
const LINKING = new Set(['is', 'are', 'was', 'were', 'be', 'and', 'or', 'but', 'to', 'in', 'on', 'at', 'for', 'with', 'by', 'from', 'i', 'you', 'he', 'she', 'it', 'we', 'they']);

/** Most words a phrase may have; longer text is a sentence. */
export const PHRASE_WORDS = 4;

/**
 * @typedef {object} PhrasePlan
 * @property {'of' | 'pair'} pattern
 * @property {string[]} terms  The parts in typed order, articles left out.
 * @property {number} head     Index of the part the phrase is about.
 */

/**
 * The parts of a phrase and how they combine, or null when it is not one of
 * the patterns.
 * @param {string} text
 * @returns {PhrasePlan | null}
 */
export function planPhrase(text) {
	const words = text.normalize('NFC').trim().split(/\s+/).filter(Boolean);
	if (words.length < 2 || words.length > PHRASE_WORDS + 2 || /[က-႟]/.test(text)) return null;
	if (words.some((w) => !/^[\p{L}][\p{L}'’-]*$/u.test(w))) return null;
	const of = words.findIndex((w) => w.toLowerCase() === 'of');
	if (of === 0) return null;
	if (of > 0) {
		const before = content(words.slice(0, of));
		const after = content(words.slice(of + 1));
		if (!before.length || !after.length || before.length + after.length > PHRASE_WORDS) return null;
		return { pattern: 'of', terms: [before.join(' '), after.join(' ')], head: 0 };
	}
	const parts = content(words);
	// Two words joined by a little word ("love is") are a sentence, not a phrase.
	if (parts.length !== 2 || parts.some((w) => LINKING.has(w.toLowerCase()))) return null;
	return { pattern: 'pair', terms: parts, head: 1 };
}

/** @param {string[]} words */
function content(words) {
	return words.filter((w) => !ARTICLES.has(w.toLowerCase()));
}

/**
 * The plain Myanmar of a sense, for putting words together: no labels, no
 * notes in brackets, the first of several glosses.
 * @param {string} sense  With dataset markup.
 */
export function plainGloss(sense) {
	return sense
		.replace(/\[[^\]]*\]/g, ' ')
		.replace(/<([^>]*)>/g, '$1')
		.replace(/\([^)]*\)/g, ' ')
		.split(/[;၊]/)[0]
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * @typedef {object} SenseRow
 * @property {string} type  Part of speech, e.g. "Noun".
 * @property {string} kind  Review state or label, e.g. "Country".
 * @property {string} sense
 * @property {string | null} example
 */

/**
 * The sense of a word that fits the phrase: one whose example uses the same
 * pattern ("the King of Norway" for "king of Denmark"), else the first of
 * the expected part of speech that is not a draft, else the first.
 * @template {SenseRow} S
 * @param {S[]} senses
 * @param {{ word: string, pattern: 'of' | 'pair', role: 'head' | 'modifier', proper?: boolean }} where
 *   `proper`: the part after "of" is a name (a country, a capitalised word),
 *   so an example with a name after "of" fits best: "the King of Spain", not
 *   "the king of jazz".
 * @returns {S | null}
 */
export function bestSense(senses, where) {
	if (!senses.length) return null;
	const usable = senses.filter((s) => plainGloss(s.sense));
	if (!usable.length) return senses[0];
	if (where.pattern === 'of' && where.role === 'head') {
		const like = new RegExp(`\\b${escape(where.word)}s? of (?:the )?(\\S)`, 'i');
		const shows = usable.filter((s) => s.example && like.test(s.example));
		const named = (/** @type {SenseRow} */ s) => {
			const m = like.exec(/** @type {string} */ (s.example));
			return !!m && m[1] !== m[1].toLowerCase();
		};
		const shown = shows.find((s) => named(s) === !!where.proper) ?? shows[0];
		if (shown) return shown;
	}
	const want = where.role === 'head' || where.pattern === 'of' ? ['Noun'] : ['Adjective', 'Noun'];
	return usable.find((s) => want.includes(s.type) && s.kind !== 'Draft') ?? usable.find((s) => s.kind !== 'Draft') ?? usable[0];
}

/** @param {string} text */
function escape(text) {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Kinds of sense that name one place. */
export const PROPER_KINDS = Object.freeze(['Country', 'Capital city']);

/**
 * Whether a part names something: written with a capital or, as a sense, a
 * country or capital city.
 * @param {string} word
 * @param {SenseRow | null} sense
 */
export function isProper(word, sense) {
	return /^\p{Lu}/u.test(word) || (!!sense && PROPER_KINDS.includes(sense.kind));
}

/**
 * The phrase in Myanmar from the chosen senses, in Myanmar order: the
 * whose-part first (ဒိန်းမတ် ဘုရင်), a describing word with သော first
 * (ကြီးသော အိမ်). A country's နိုင်ငံ is dropped when it describes.
 * @param {PhrasePlan} plan
 * @param {Array<SenseRow | null>} chosen  One per term, in plan order.
 * @returns {string | null}  null when a part has no sense.
 */
export function composeMyanmar(plan, chosen) {
	if (chosen.some((s) => !s)) return null;
	const senses = /** @type {SenseRow[]} */ (chosen);
	const gloss = senses.map((s, i) => {
		const g = plainGloss(s.sense);
		return i !== plan.head && s.kind === 'Country' ? g.replace(/\s*နိုင်ငံ$/, '') : g;
	});
	if (gloss.some((g) => !g)) return null;
	if (plan.pattern === 'of') return `${gloss[1]} ${gloss[0]}`;
	return `${gloss[0]} ${gloss[1]}`;
}
