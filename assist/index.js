import * as anchor from "./anchor/index.js";

export const { language, glossary, visits, speech, thuddar, search } = anchor;

export const { translation, definition, suggestion } = anchor.clue;
export const config = anchor.config.setting;

// export {suggestion,definition,translation} from './dictionary.js';
// export {search} from './search.js'

// export {default as config} from './config.js';
// export {language,information,suggestion} from './dictionary.js';
// export {search} from './search.js';
// export {visits} from './visits.js';
// export {speech} from './speech.js';
// export * as grammar from './grammar.js';

// NOTE: info
// export const getInfo = dictionary.information;

// NOTE: lang
// export const getLangDefault = dictionary.language.default;
// export const getLangByName = dictionary.language.byName;
// export const getLangById =  dictionary.language.byId;
// export const getLangList = dictionary.language.list;
// export const getLangCount = dictionary.language.count;

// NOTE: visits
// export const visits = snap;

// NOTE: grammar
// export const grammarMain = grammar.main;
// export const grammarPos = grammar.pos;

// NOTE: mean
// exports.suggestion = async (e,l) => await dictionary.suggestion(e,l);
// exports.definition = async (e) => dictionary.definition(e);
// exports.translation = async (e,l) => dictionary.translation(e,l);
// export const lookup = search;

// const dictionary = require('./dictionary');
// const orthography = require('./orthography');
// const thesaurus = require("thesaurus");
// const pluralize = require("pluralize");
// const grammar = require("./grammar");

// // NOTE: mean
// exports.suggestion = async (e,l) => await dictionary.suggestion(e,l);
// exports.definition = async (e) => dictionary.definition(e);
// exports.translation = async (e,l) => dictionary.translation(e,l);
// exports.search = require('./search');

// // NOTE: lang
// exports.getLangDefault = () => dictionary.lang.default;
// exports.getLangByName = dictionary.lang.byName;
// exports.getLangById =  dictionary.lang.byId;
// exports.getLangList = () => dictionary.lang.list;
// exports.getLangCount = () => dictionary.lang.count;

// // exports.getLangDefault = () => dictionary.getLangDefault;
// // exports.getLangByName = dictionary.getLangByName;
// // exports.getLangById = dictionary.getLangById;
// // exports.getLangList = () => dictionary.getLangList;
// // exports.getLangCount = () => dictionary.getLangCount;
// exports.getGrammar = async () => dictionary.grammar();
// exports.getInfo = dictionary.information;

// // NOTE: visits
// exports.visits = require('./visits');

// // NOTE: grammar
// exports.grammarMain = grammar.main;
// exports.grammarPos = grammar.pos;

// // NOTE: myanmar Orthgraphy, etymology
// exports.orthCharacter = orthography.character;
// exports.orthWord = orthography.word;
// exports.orthSense = orthography.sense;
// exports.orthSyllable = orthography.syllable;
// exports.orthBreak = orthography.break;

// // NOTE: speech
// exports.speech = require('./speech');

// // NOTE: thesaurus
// exports.thesaurus = async (e) => thesaurus.find(e);

// // NOTE: pluralize
// exports.plural = async (e) => pluralize.plural(e);
// exports.singular = async (e) => pluralize.singular(e);
// exports.isPlural = async (e) => pluralize.isPlural(e);
// exports.isSingular = async (e) => pluralize.isSingular(e);
