import core from "lethil";

/**
 * import * as env from "./env.js"; access both default individual
 * import env from "./env.js"; only accessible export [method, const, type]
 */

/**
 * @typedef {{src:string, tar:string}} TypeOfSearchLanguage
 *
 * @typedef {{title:string, description:string; keywords:string}} TypeOfSearchMeta
 *
 * @typedef {Object} TypeOfSearchQuery
 * @property {string} input - original input query
 * @property {string} word - selected search keyword
 * @property {string[]} sentence - exploded space
 * @property {boolean} status - is sentence
 *
 * @typedef {Object} TypeOfSearchResult
 * @property {TypeOfSearchQuery} query
 * @property {Object} meta
 * @property {string} meta.searchQuery
 * @property {string} meta.q
 * @property {string} meta.type
 * @property {string} meta.name
 * @property {{name:string, list?:string[]}[]} meta.msg
 * @property {{name:string, list?:string[]}[]} meta.todo
 * @property {{name:string, list?:string[]}[]} meta.sug
 * @property {TypeOfSearchLanguage} result.lang
 * @property {string} title - page title
 * @property {string} description - page description
 * @property {string} keywords - page keywords
 * @property {string} revised - page last modified date
 * @property {string} revised_version - page modified version number
 * @property {string} pageClass - page classname
 * @property {any[]} data
 *
 * @typedef { {w:number, v:string, d:number, t:number} } TypeOfSynmap
 * ```js
 * {"w":1, "v":"0s", "d":1, "t":0}
 * ```
 * @typedef { {w:number, v:string} } TypeOfSynset - {"w":1, "v":"0"}
 * ```js
 * {"w":1, "v":"0"}
 * ```
 * @typedef { {i:number, w:number, t:number, v:string} } TypeOfSense - definition
 * ```js
 * {"i":1, "w":"0", "t":1, "v":"0s"}
 * ```
 * @typedef { {i:number, v:string} } TypeOfUsage - example
 *
 * @typedef { {w:number, v:string} } RowOfLangTar - English
 * @typedef { {v:string, e:string[]} } RowOfLangSrc - Other than english
 *
 * typedef { {id?:number, pos:string, term:string, type:string, v:string, exam:string[], kind:string[]} } RowOfMeaning - data.clue.meaning.pos.?
 *
 * @typedef {Object} RowOfMeaning  - data.clue.meaning.pos.?
 * @property {number} [id]
 * @property {string} pos
 * @property {string} term
 * @property {string} type
 * @property {string} cast - how to be shown in html [exam_meaning, exam_thesaurus]
 * @property {string[]} kind
 * @property {string} v
 * @property {string[]} exam
 *
 * @typedef { Object<string,RowOfMeaning[]> } RowOfClue - { meaning; suggestion }
 * @typedef { {word:string, clue:Object<string,RowOfClue>} } RowOfDefinition - { word: term, clue: {} }
 * @typedef { {word:string, clue:RowOfDefinition[]} } RowOfTranslation - { }
 *
 * @typedef {Object} TypeOfMeaning - each word clue
 * @property {boolean} status
 * @property {string} version - used in cache control
 * @property {number} id - 0:default 1:match 2:synset
 * @property {string[]} msg
 * @property {RowOfMeaning[]} row
 *
 * @typedef { {name:string, shortname:string} } PosOfSynset
 * @typedef { {id:number, type:number, name:string} } PosOfSynmap
 */
/**
 *@type {TypeOfSearchMeta}
 */
export const meta = {
	title: '"*" definition and meaning in Myanmar',
	description: "The definition of * in Myanmar, Burmese.",
	keywords: "*, definition | meaning, myanmar, burma, MyOrdbok"
};

/**
 *@type {TypeOfSearchResult}
 */
export const result = {
	query: {
		input: "",
		word: "",
		sentence: [],
		status: false
	},
	meta: {
		searchQuery: "",
		q: "",
		type: "",
		name: "",
		msg: [],
		todo: [],
		sug: []
	},
	lang: {
		tar: "",
		src: ""
	},

	title: "",
	description: "",
	keywords: "",
	revised: "",
	revised_version: "",
	pageClass: "definition",
	data: []
};
/**
 * @type { PosOfSynset[] }
 */
export const synset = [
	{ name: "Noun", shortname: "n" },
	{ name: "Verb", shortname: "v" },
	{ name: "Adjective", shortname: "adj" },
	{ name: "Adverb", shortname: "adv" },
	{ name: "Preposition", shortname: "prep" },
	{ name: "Conjunction", shortname: "conj" },
	{ name: "Pronoun", shortname: "pron" },
	{ name: "Interjection", shortname: "int" },
	{ name: "Abbreviation", shortname: "abb" },
	{ name: "Prefix", shortname: "" },
	{ name: "Combining form", shortname: "" },
	{ name: "Phrase", shortname: "phra" },
	{ name: "Contraction", shortname: "" },
	{ name: "Punctuation", shortname: "punc" },
	{ name: "Particle", shortname: "part" },
	{ name: "Post-positional Marker", shortname: "ppm" },
	{ name: "Acronym", shortname: "" },
	{ name: "Article", shortname: "" },
	{ name: "Number", shortname: "tn" }
];

/**
 * @type {PosOfSynmap[]}
 */
export const synmap = [
	{ id: 0, type: 1, name: "past and past participle" }, //er/ly??
	{ id: 1, type: 0, name: "plural" },
	{ id: 2, type: 1, name: "3rd person" },
	{ id: 3, type: 1, name: "past tense" },
	{ id: 4, type: 1, name: "past participle" },
	{ id: 5, type: 1, name: "present participle" },
	{ id: 6, type: 2, name: "comparative" },
	{ id: 7, type: 2, name: "superlative" },
	{ id: 8, type: 1, name: "1st person" },
	{ id: 9, type: 1, name: "2nd person" },
	{ id: 10, type: 1, name: "plural past" }
];

/**
 * @typedef { {id:string; name:string; my:string; default?:boolean}} TypeOfDictionariesLang
 * @typedef { {name:string; my:string; lang:TypeOfDictionariesLang[]}} TypeOfDictionaries
 * @type {TypeOfDictionaries[]}
 */
export const dictionaries = [
	{
		name: "International",
		my: "အပြည်ပြည်ဆိုင်ရာ",
		lang: [
			{
				id: "en",
				name: "English",
				my: "အင်္ဂလိပ်",
				default: true
			},
			{ id: "iw", name: "Hebrew", my: "ဟေဗြဲ" },
			{ id: "el", name: "Greek", my: "ဂရိ" },
			{ id: "pt", name: "Portuguese", my: "ပေါ်တူဂီ" },
			{ id: "fr", name: "French", my: "ပြင်သစ်" },
			{ id: "nl", name: "Dutch", my: "ဒတ်ချ်" },
			{ id: "ar", name: "Arabic", my: "အာရဗီ" },
			{ id: "es", name: "Spanish", my: "စပိန်" }
		]
	},
	{
		name: "Europe",
		my: "ဥရောပ",
		lang: [
			{ id: "no", name: "Norwegian", my: "နော်ဝေ" },
			{ id: "fi", name: "Finnish", my: "ဖင်လန်" },
			{ id: "ro", name: "Romanian", my: "ရိုမေးနီးယား" },
			{ id: "pl", name: "Polish", my: "ပိုလန်" },
			{ id: "sv", name: "Swedish", my: "ဆွီဒင်" },
			{ id: "da", name: "Danish", my: "ဒိန်းမတ်" },
			{ id: "de", name: "German", my: "ဂျာမန်" },
			{ id: "ru", name: "Russian", my: "ရုရှ" }
		]
	},
	{
		name: "Asia",
		my: "အာရှ",
		lang: [
			{ id: "ja", name: "Japanese", my: "ဂျပန်" },
			{ id: "zh", name: "Chinese", my: "တရုတ်" },
			{ id: "ko", name: "Korean", my: "ကိုရီးယား" },
			{ id: "ms", name: "Malay", my: "မလေးရှား" },
			{ id: "tl", name: "Filipion", my: "ဖိလစ်ပိုင်" },
			{ id: "vi", name: "Vietnamese", my: "ဗီယက်နမ်" },
			{ id: "th", name: "Thai", my: "ယိုးဒယား" },
			{ id: "hi", name: "Hindi", my: "ဟိန္ဒီ" }
		]
	}
];

export const fileName = {
	word: "glossary/EN.json",
	sense: "glossary/sense.json", // definition
	usage: "glossary/usage.json", // example
	synset: "glossary/synset.json", // words
	synmap: "glossary/synmap.json", //derives
	zero: "glossary/zero/EN.csv", //no result
	info: "glossary/info/EN.json",
	thesaurus: "glossary/thesaurus.json",
	// cache: "./cache/version/page-lang-query.json",
	cache: "./cache/page/lang-query.json",
	sqlite: "glossary/tmp-sqlite.db"
};

export const grammar = {
	live: "grammar/_live.json",
	pos: "grammar/pos-*.json",
	structure: "grammar/structure.json"
	// context:'grammar/*.json'
};

export const orthography = {
	character: "orthography/character.json",
	word: "orthography/word.json",
	sense: "orthography/sense.json"
};

export const config = core.config.merge({
	name: "MyOrdbok",
	// description: 'package.description',
	// version: 'package.version',
	locale: [
		{ id: "en", name: "English", default: true }
		// {id:'no',name:'Norwegian'},
		// {id:'my',name:'Myanmar'},
		// {id:'zo',name:'Zolai'}
	],
	/**
	 * apple
	 */
	speechUrl: "",

	table: {
		senses: "list_sense",
		other: "ord_0",
		synset: "list_word",
		synmap: "map_derive",
		thesaurus: "map_thesaurus"
	},
	dictionaries: dictionaries,
	synset: synset,
	synmap: synmap,
	fileName: fileName,
	grammar: grammar,
	orthography: orthography,
	/**
	 * if "true" get search result from Database
	 * if not get data from JSON
	 */
	fromDatabase: "true"
});

// to get latest merge, config must be used
export default config;
