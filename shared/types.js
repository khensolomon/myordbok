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

export {};
