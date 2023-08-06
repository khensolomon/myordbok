import core from "lethil";

/**
 * import * as env from "./env.js"; access both default individual
 * import env from "./env.js"; only accessible export [method, const, type]
 */

/**
 * @typedef {{src:string, tar:string, srcName:string, tarName:string}} TypeOfSearchLanguage
 *
 * @typedef {{title:string, description:string; keywords:string}} TypeOfSearchMeta
 *
 * @typedef {Object} TypeOfSearchQuery
 * @property {string} input - original input query
 * @property {string} word - selected search keyword
 * @property {string[]} sentence - exploded space
 * @property {boolean} status - is sentence
 * @property {object[]} wordbreak - word breaking
 *
 * @typedef {Object} TypeOfSearchResult
 * @property {TypeOfSearchQuery} query
 * @property {Object} meta
 * @property {string} meta.searchQuery
 * @property {string} meta.q
 * @property {boolean} meta.isMyanmar
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
 * @typedef { {v:string} } RowOfWordMed - English words
 * @typedef { {w:number, v:string} } RowOfLangTar - English words
 * @typedef { {v:string, e:any} } RowOfLangSrc - Other than english words
 *
 * @typedef {{mean:string[]; exam:string[]}} RowOfMean
 *
 * @typedef {Object} RowOfExam - in sense
 * @property {string} type - how to be shown [exam] in html examSentence, examWord
 * @property {string[]} value
 *
 * @typedef {Object} RowOfUsage - Used in [MED] related words, can be used to display [thesaurus]
 * @property {string} type - how to be shown [usage] in html [usageSentence, usageWord]
 * @property {string[]} value - rel usage usage_sentence, usage_word
 *
 * @typedef {Object} BlockOfMeaning  - data.clue.meaning.pos.?
 * @property {number} [id]
 * @property {string} pos - part of speech
 * @property {string} term - Word
 * @property {string} type
 * @property {string[]} kind
 * @property {RowOfMean[]|string} v - meaning
 * @property {RowOfMean[]} [mean]
 * @property {RowOfExam} [exam]
 * @property {RowOfUsage} [usage]
 *
 * @typedef { Object<string,BlockOfMeaning[]> } RowOfClue - { meaning; suggestion }
 * @typedef { {word:string, clue:Object<string,RowOfClue>} } RowOfDefinition - { word: term, clue: {} }
 * @typedef { {word:string, clue:RowOfDefinition[]} } RowOfTranslation - { }
 *
 * @typedef {Object} TypeOfMeaning - each word clue
 * @property {boolean} status
 * @property {number} dated - timestamp `new Date(?).getTime()`
 * @property {number} id - 0:default 1:match 2:synset
 * @property {string} version - used in cache control
 * @property {string[]} msg
 * @property {BlockOfMeaning[]} row
 *
 * @typedef { {id:number, name:string, shortname:string, thesaurus:string[] } } PosOfSynset
 * @typedef { {id:number, type:number, name:string} } PosOfSynmap
 *
 * @typedef {Object<string,any>} RowOfInfoProgress
 * @property {string} name
 * @property {string} my
 * @property {number} [percentage] - 87.5
 * @property {string} [id] - word
 * @property {number} [status] - 58497
 *
 * @typedef {Object} RowOfInfo
 * @property {string} title
 * @property {string} keyword
 * @property {string} description
 * @property {number} dated
 * @property {Object} info
 * @property {string} info.header
 * @property {RowOfInfoProgress[]} info.progress
 * @property {string[]} info.context
 * property {Object} info.progress
 * property {string} info.progress.name
 * property {string} info.progress.my
 * property {string} info.progress.my
 * property {number} [info.progress.percentage] - 87.5
 * property {string} [info.progress.id] - word
 * property {number} [info.progress.status] - 58497
 * property {{name:string,my:string,percentage?:number, id?:string, status?:number}[]} info.progress
 * typedef {{word:string, lang:string}} TypeOfCacheController
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
		wordbreak: [],
		sentence: [],
		status: false
	},
	meta: {
		searchQuery: "",
		q: "",
		isMyanmar: false,
		type: "",
		name: "",
		msg: [],
		todo: [],
		sug: []
	},
	lang: {
		tar: "",
		tarName: "",
		src: "",
		srcName: ""
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
	{ id: 0, name: "noun", shortname: "n", thesaurus: [] },
	{ id: 1, name: "verb", shortname: "v", thesaurus: [] },
	{
		id: 2,
		name: "adjective",
		shortname: "adj",
		thesaurus: ["adj & adv"]
	},
	{
		id: 3,
		name: "adverb",
		shortname: "adv",
		thesaurus: []
	},
	{
		id: 4,
		name: "preposition",
		shortname: "prep",
		thesaurus: []
	},
	{
		id: 5,
		name: "conjunction",
		shortname: "conj",
		thesaurus: []
	},
	{
		id: 6,
		name: "pronoun",
		shortname: "pron",
		thesaurus: ["pron & adj"]
	},
	{
		id: 7,
		name: "interjection",
		shortname: "int",
		thesaurus: ["pron & int"]
	},
	{
		id: 8,
		name: "abbreviation",
		shortname: "abb",
		thesaurus: ["abbr"]
	},
	{ id: 9, name: "Prefix", shortname: "", thesaurus: [] },
	{
		id: 10,
		name: "combining form",
		shortname: "",
		thesaurus: []
	},
	{
		id: 11,
		name: "phrase",
		shortname: "phra",
		thesaurus: ["exp"]
	},
	{ id: 12, name: "contraction", shortname: "", thesaurus: [] },
	{
		id: 13,
		name: "punctuation",
		shortname: "punc",
		thesaurus: []
	},
	{
		id: 14,
		name: "particle",
		shortname: "part",
		thesaurus: []
	},
	{
		id: 15,
		name: "postpositional marker",
		shortname: "ppm",
		thesaurus: []
	},
	{ id: 16, name: "suffix", shortname: "", thesaurus: [] },
	{ id: 17, name: "acronym", shortname: "", thesaurus: [] },
	{ id: 18, name: "article", shortname: "", thesaurus: [] },
	{ id: 19, name: "number", shortname: "tn", thesaurus: [] }
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
	 * custom
	 */
	speechUrl: "",

	table: {
		senses: "list_sense",
		other: "ord_0",
		synset: "list_word",
		synmap: "map_derive",
		thesaurus: "map_thesaurus",
		/**
		 * log_keyword
		 */
		keyword: "log_keyword"
	},
	dictionaries: dictionaries,
	synset: synset,
	synmap: synmap,
	// fileName: fileName,
	/**
	 * if "true" get search result from Database
	 * if not get data from JSON
	 */
	fromDatabase: "false",
	cacheDefinition: "false"
});

// to get latest merge, config must be used
export default config;
