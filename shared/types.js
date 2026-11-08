// @ts-check
/**
 * Data shapes passed between the worker and the app.
 * Types only; nothing here runs.
 *
 * The lookup result is produced by shared/search/search.mjs, which comes from
 * the dataset; these types describe it for the app.
 */

/**
 * One English → Myanmar sense.
 * @typedef {object} EnglishSense
 * @property {string} word     Headword spelling the sense belongs to.
 * @property {string} type     Part of speech name, e.g. "Noun".
 * @property {string} kind     Review state or label, e.g. "Active", "Draft",
 *                             "Checked: awaiting native review".
 * @property {string} sense    Myanmar gloss, with dataset markup.
 * @property {string | null} example
 */

/**
 * A word and how it relates: [spelling, part of speech, form], e.g.
 * ["went", "verb", "past"].
 * @typedef {[string, string, string]} FormRow
 */

/**
 * @typedef {object} EnglishResult
 * @property {string} query
 * @property {'en'} language
 * @property {EnglishSense[]} entries      In display order.
 * @property {string[]} variant_of         Headwords this spelling is a variant of (color → colour).
 * @property {FormRow[]} forms_of          Roots this word is a form of (went → go).
 * @property {Record<string, number>} root_senses  Senses per root, to know which roots have entries.
 * @property {FormRow[]} forms             Forms of this word (go → went, gone).
 * @property {string[]} synonyms
 * @property {string[]} similar
 * @property {string[]} broader
 * @property {string[]} opposite
 * @property {string[]} related
 */

/**
 * One Myanmar → English sense.
 * @typedef {object} MyanmarSense
 * @property {string} type
 * @property {string} sense    English gloss, with dataset markup.
 * @property {string | null} example  `~` stands for the headword.
 * @property {string | null} etymology
 */

/**
 * @typedef {object} MyanmarResult
 * @property {string} query
 * @property {'my'} language
 * @property {[string, string] | null} pronunciation  [IPA, MLC transcription].
 * @property {MyanmarSense[]} entries
 */

/** @typedef {EnglishResult | MyanmarResult} LookupResult */

/**
 * @typedef {object} Suggestions
 * @property {string} q
 * @property {import('./validate.js').Lang} lang
 * @property {string[]} words  Headwords starting with `q`.
 */

/**
 * @typedef {object} Spelling
 * @property {string} q
 * @property {string[]} words  Headwords one edit away from `q`, the most used first.
 */

/**
 * One part of a phrase as found: `word` is the headword used, `note` says
 * how it was found when not as typed.
 * @typedef {object} PhrasePart
 * @property {string} term
 * @property {string} word
 * @property {'form' | 'spelling' | null} note
 * @property {EnglishSense[]} entries  The word's senses, every spelling found (God, god).
 * @property {number} fit  Index in entries of the sense that fits the phrase, or -1.
 * @property {EnglishSense | null} sense  That sense.
 */

/**
 * @typedef {object} Phrase
 * @property {string} q
 * @property {'of' | 'pair' | null} pattern  null: not a phrase this reads.
 * @property {number} [head]  Index of the part the phrase is about.
 * @property {string | null} myanmar  Made from the parts, in Myanmar order.
 * @property {PhrasePart[]} parts
 */

export {};
