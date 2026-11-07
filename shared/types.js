// @ts-check
/**
 * Data shapes passed between the worker and the app.
 * Types only; nothing here runs.
 */

/**
 * @typedef {object} Sense
 * @property {number} id
 * @property {string} sense  Gloss; `<word>` marks a link to another entry.
 * @property {string | null} exam  Example; same link markup.
 */

/**
 * @typedef {object} PartOfSpeech
 * @property {string} name  e.g. "noun", "verb".
 * @property {Sense[]} senses  In display order (wseq).
 */

/**
 * @typedef {object} Entry
 * @property {import('./validate.js').Lang} lang
 * @property {string} word
 * @property {PartOfSpeech[]} pos
 */

/**
 * @typedef {object} SearchResult
 * @property {string} q
 * @property {import('./validate.js').Lang} lang
 * @property {string[]} words  Headwords starting with `q`.
 */

export {};
