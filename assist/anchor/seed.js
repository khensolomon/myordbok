import { seek, db, parse, check, fire } from "lethil";

import myanmarNotation from "myanmar-notation";
import thesaurus from "word-thesaurus";
import numberToWords from "number-to-words";

import * as wordbreak from "../wordbreak/index.js";

import * as env from "./env.js";
import { primary } from "./language.js";
import * as makeup from "./makeup.js";

/**
 * format keyword
 * "1.2.3.4".replace(/[.](?=.*[.])/g, "");
 * @param {string} str
 * @returns {env.TypeOfSearchQuery}
 * @example goat
 * goat~0
 * goat me~1
 * goat me
 * goat~me~1 ???
 * goat~me~string ???
 */
export function query(str) {
	var str = str || "";
	/**
	 * type {env.TypeOfSearchQuery}
	 */
	// const res = {
	// 	input: str,
	// 	word: "",
	// 	wordbreak: [],
	// 	sentence: [],
	// 	result: [],

	// 	status: false
	// };

	let res = Object.assign({}, env.result.query, {
		input: str
		// word: "",
		// wordbreak: [],
		// sentence: [],
		// result: [],
		// status: false
	});

	const raw = str
		.toString()
		.replace(/,/g, " ")
		.replace(/[~](?=.*[~])/g, " ")
		.split("~");
	if (raw.length == 2) {
		// const kList = raw[0].split(" ");
		const kIndex = raw[1];
		res.input = raw[0];
		res.sentence = parse.explode(raw[0]);
		const abcsfe = res.sentence.indexOf(kIndex);
		if (abcsfe > -1) {
			res.word = res.sentence[abcsfe];
		} else if (check.isNumber(kIndex)) {
			var index = Number(raw[1]);
			if (res.sentence[index]) {
				res.word = res.sentence[index];
			} else {
				res.word = res.sentence[0];
			}
		} else {
			res.word = res.sentence[0];
		}
	} else {
		res.sentence = parse.explode(str);
		res.word = res.sentence[0];
	}
	if (res.sentence.length > 1) {
		res.status = true;
	}

	// let abc = wordbreak.default(res.word);
	// res.wordbreak = [];
	res.wordbreak = wordbreak.default(res.word);
	// let abc = res.word;
	return res;
}

/**
 * provide read and write [fileList]
 * responsibility for all the filters
 */

/**
 * @type {Object.<string,string>}
 */
const fileList = {
	// word: "glossary/EN.json",
	word: "./docs/word/EN.json",
	sense: "glossary/sense.json", // definition (not in production)
	usage: "glossary/usage.json", // example (not in production)
	synset: "glossary/synset.json", // words (not in production)
	synmap: "glossary/synmap.json", //derives (not in production)
	// zero: "glossary/zero/EN.csv", //no result
	info: "./docs/info/EN.json",
	// thesaurus: "glossary/thesaurus.json",
	cache: "./cache/page/lang/query.json",
	// sqlite: "glossary/tmp-sqlite.db",

	// mew: "glossary/med/words.json",
	mew: "./docs/word/my.json",
	med: "glossary/med/definitions.json"
};

/**
 * MED - Myanmar-English definition
 * @typedef {{word:string}} TypeMedWord
 * typedef {{id:number, word:string, ipa:env.TypeStrNull, mlc:env.TypeStrNull}} TypeMedWord
 */
class medClass {
	/**
	 * @type {{word:string, reference:string, sense:string, thesaurus:string}} - of table
	 */
	mtb = {
		word: "med_word",
		reference: "med_reference",
		sense: "med_sense",
		thesaurus: "med_thesaurus"
	};

	/**
	 * @type {TypeMedWord[]}
	 */
	_wl = [];
	// constructor() {}

	/**
	 * Read all word from db
	 * @returns{Promise<TypeMedWord[]>}
	 */
	async words() {
		if (this._wl.length == 0) {
			this._wl = await db.mysql.query("SELECT word FROM ??;", [this.mtb.word]);
		}
		return this._wl;
	}

	/**
	 * Search sense
	 * @returns {Promise<any[]>}
	 * @param {string} word
	 */
	async searchSense(word) {
		return db.mysql.query(
			"SELECT * FROM ?? AS w JOIN ?? AS s ON s.wrid=w.id WHERE w.word = ?",
			[this.mtb.word, this.mtb.sense, word]
		);
	}

	/**
	 * Search thesaurus
	 * @param {number} wrid
	 * @param {number} cate
	 * @returns {Promise<{word:string}[]>}
	 */
	async thesaurusById(wrid, cate) {
		return db.mysql.query(
			"SELECT w.word FROM ?? AS t JOIN ?? AS w ON w.id=t.wlid WHERE t.wrid = ? AND t.cate = ?",
			[this.mtb.thesaurus, this.mtb.word, wrid, cate]
		);
	}
}

export const medCore = new medClass();

/**
 * Seed
 * @example
 * new seed.main()
 */
export default class main {
	/**
	 * @type {string}
	 */
	filePath = "";

	/**
	 * @type {any}
	 */
	fileCache = true;

	/**
	 * @type {any}
	 */
	fileCatch = [];

	/**
	 * langCode
	 */
	fileLang = "";

	/**
	 * used in defCache
	 */
	pageName = "";

	/**
	 * used in defCache
	 */
	keyword = "";

	/**
	 * @type {any}
	 */
	raw = [];

	/**
	 * @typedef {Object} seedQuery
	 * @property {string} [file]
	 * @property {string} [lang]
	 * @property {any} [cache] - doCache
	 * @property {any} [catch] - catchWith
	 * @property {any} [page] - used in defCache
	 * @property {any} [keyword] - used in defCache
	 * @param {seedQuery} [o]
	 * param {Object.<string, any>} [o]
	 */
	constructor(o) {
		if (o) {
			if (o.hasOwnProperty("file") && typeof o.file == "string") {
				this.filePath = o.file;
			}
			if (o.hasOwnProperty("lang") && typeof o.lang == "string") {
				this.fileLang = o.lang;
			}
			if (o.hasOwnProperty("cache")) {
				this.fileCache = o.cache;
			}
			if (o.hasOwnProperty("catch")) {
				this.fileCatch = o.catch;
			}
			if (o.hasOwnProperty("page")) {
				this.pageName = o.page;
			}
			if (o.hasOwnProperty("keyword")) {
				this.keyword = o.keyword;
			}
		}
	}

	/**
	 * Get resolved file path
	 * param {string} file
	 * @param {string} name - keyof fileList or path
	 * @param {string} [lang] - lang || primary.id
	 */
	resolveFile(name, lang) {
		let file = name;
		if (name in fileList) {
			// let file = modifyFileName(fileList[name], lang);
			file = fileList[name];
		}
		file = file.replace(/EN/, lang || primary.id);
		if (file.startsWith("./")) {
			return seek.resolve(file);
		}
		return seek.resolve(env.config.media, file);
	}

	get file() {
		return this.resolveFile(this.filePath, this.fileLang);
	}

	get flat() {
		return new db.flat({
			file: this.file,
			fileCache: this.fileCache,
			fileCatch: this.fileCatch
		});
	}

	/**
	 * Read as JSON
	 * template T
	 * param {T} [raw]
	 * returns {Promise<T|undefined>}
	 */
	async read() {
		this.raw = await this.flat.readJSON();
		return this.raw;
	}

	// /**
	//  * @todo probably not required, but write as JSON
	//  * @param {*} [raw]
	//  * @returns {Promise<boolean>}
	//  */
	// async write(raw) {
	// 	return this.flat.writeJSON({
	// 		raw: raw || this.raw,
	// 		space: 2
	// 	});
	// }

	/**
	 * @todo probably not required, but write as JSON
	 * param {env.WriteOptions} [raw]
	 * @param {{raw?:any, space?:number, suffix?:string}} [options]
	 * @returns {Promise<boolean>}
	 */
	async write(options) {
		let writeOptions = {
			raw: this.raw
		};
		return this.flat.writeJSON(Object.assign(writeOptions, options || {}));
		// return this.flat.writeJSON({
		// 	raw: options.raw || this.raw,
		// 	space: options.space
		// });
	}

	/**
	 * Watch file
	 * NOTE: Use it wisely
	 */
	watch() {
		this.flat.fileWatch(async () => await this.read());
	}
}

/**
 * Words Target: get english words list,
 * lang should not be provided, to avoid types issue
 */
export class wordTarget extends main {
	filePath = fileList.word;

	/**
	 * @type {env.RowOfLangTar[]}
	 */
	raw = [];
}

/**
 * Words Source: If lang is not provided, RowOfLangTar will return
 * @param {string} [lang] - lang || primary.id
 * get other words list, other than english no, sw, fi etc.
 */
export class wordSource extends main {
	filePath = fileList.word;

	/**
	 * @type {env.RowOfLangSrc[]}
	 */
	raw = [];
}

/**
 * Words Myanmar: get myanmar words list
 */
export class wordMyanmar extends main {
	filePath = fileList.mew;
	// fileCache = false;

	/**
	 * @type {env.RowOfWordMed[]}
	 */
	raw = [];
}

/**
 * Definition myanmar-english
 */
export class defMyanmar extends main {
	filePath = fileList.med;

	/**
	 * @typedef {{mlc:string,ipa:string}} pron
	 * @typedef {{type:string,usage:string}} usg
	 * @typedef {{pos:string,def:string[],exam?:string[], usg?:usg}} sense
	 * @type {{ id?:string, word:string, pron:pron, type:string, sense:sense[], rel:number[], variant?:string[]}[]}
	 */
	raw = [];
}

/**
 * English myanmar sense
 */
export class defSense extends main {
	filePath = fileList.sense;

	/**
	 * @type {env.TypeOfSense[]}
	 */
	raw = [];
}

/**
 * English myanmar usage
 */
export class defUsage extends main {
	filePath = fileList.usage;

	/**
	 * @type {env.TypeOfUsage[]}
	 */
	raw = [];
}

/**
 * English myanmar synset
 */
// export class defSynset extends main {
// 	filePath = fileList.synset;

// 	/**
// 	 * @type {env.TypeOfSynset[]}
// 	 */
// 	raw = [];
// }

/**
 * English myanmar synmap
 */
// export class defSynmap extends main {
// 	filePath = fileList.synmap;

// 	/**
// 	 * @type {env.TypeOfSynmap[]}
// 	 */
// 	raw = [];
// }

/**
 * @param {string} word - any word
 * @typedef {env.TypeOfSynset & {derived:number}} searchSynsetType
 * typedef {env.TypeOfSynmap & {word:string}} derivedSynmapType
 * @returns {Promise<searchSynsetType[]>}
 */
export function searchSynset(word) {
	return db.mysql.query(
		"SELECT id AS w, word AS v, derived FROM ?? WHERE word LIKE ? GROUP BY word;",
		[env.config.table.synset, word]
	);
}

/**
 * @param {string} word - loving, kings, took, loves, fetched
 * @returns {Promise<env.TypeOfSynmap[]>}
 */
export async function derivedSynmap(word) {
	return db.mysql.query(
		"SELECT a.id AS w, a.word AS v, a.dete AS d, a.wrte AS t, b.word FROM ?? AS a JOIN ?? AS b ON a.id = b.id WHERE a.word LIKE ? AND a.wrte < 10;",
		[env.config.table.synmap, env.config.table.synset, word]
	);
}

/**
 *
 * @param {string} word - love, hate, apple
 * @returns {Promise<env.TypeOfSynmap[]>}
 */
export async function derivedSynset(word) {
	return db.mysql.query(
		"SELECT a.id AS w, a.word AS v, a.dete AS d, a.wrte AS t, b.word FROM ?? AS a JOIN ?? AS b ON b.id = a.id WHERE b.word LIKE ? AND a.dete > 0;",
		[env.config.table.synmap, env.config.table.synset, word]
	);
}

/**
 * Dictionary static and context info
 * `{title:string,keyword:string,description:string,info:[],dated:number}`
 * @param {string} lang - language shortname
 */
export class infoDict extends main {
	filePath = fileList.info;

	/**
	 * @type {env.RowOfInfo}
	 */
	raw = {
		title: "",
		keyword: "",
		description: "",
		dated: 0,
		info: {
			header: "",
			progress: [],
			context: []
		}
	};
}

/**
 * definition Cache
 */
export class infoCache extends main {
	filePath = fileList.cache;

	fileCache = false;
	/**
	 * type {any}
	 * @type {env.TypeOfMeaning}
	 */
	raw = {
		word: [],
		status: false,
		dated: 0,
		id: 0,
		version: "",
		msg: [],
		sug: [],
		row: []
	};

	/**
	 * @type {env.TypeOfMeaning}
	 */
	res = {
		word: [],
		status: false,
		dated: 0,
		id: 0,
		version: "",
		msg: [],
		sug: [],
		row: []
	};

	/**
	 * This should come from the Data where it's store, eg.MySQL
	 * @type {string | number | Date}
	 */
	latestUpdate = 0;

	info() {
		return new infoDict({ lang: this.fileLang });
	}

	get file() {
		let fileName = this.filePath
			// .replace("version", this.version)
			.replace("page", this.pageName)
			.replace("lang", this.fileLang)
			.replace(
				"query",
				this.keyword
					.replace(/\\/g, "")
					.replace(/\//g, "")
					.replace(/\s+/g, "_")
					.trim()
			);
		return this.resolveFile(fileName, this.fileLang);
	}

	get version() {
		return env.config.version.replace(/\./g, "");
	}

	get enable() {
		// @ts-ignore
		return env.config.cacheDefinition == "true";
	}

	/**
	 * `Date.now()`
	 */
	get now() {
		return Date.now();
	}

	/**
	 * how old the cache by day `(date.now - cache.dated) / (1000 * 3600 * 24)`
	 */
	get dayOld() {
		return (this.now - this.raw.dated) / (1000 * 3600 * 24);
	}

	/**
	 * is cache expired, `23:59` hours, calc `(dayOld < 1)` day
	 */
	get expired() {
		return this.dayOld < 1;
	}

	/**
	 * check if there is a new update using `latestUpdate`
	 * @returns {boolean}
	 */
	get updateAvailable() {
		let lastModified = new Date(this.latestUpdate).getTime();
		return lastModified > this.raw.dated;
	}

	/**
	 * gets the day of the week from `latestUpdate`
	 * @returns {number}
	 */
	get updateWeekDay() {
		return new Date(this.latestUpdate).getDay();
	}

	/**
	 * Used to extend cache one more day, if the `updateWeekDay` is `[monday-friday 1-5]`,
	 * if not and on `[saturday, sunday 6,0]`  looking for update
	 * using `updateWeekDay == 6 || updateWeekDay == 0`
	 * shouldExtend
	 */
	get shouldExtend() {
		return this.updateWeekDay == 6 || this.updateWeekDay == 0;
	}

	/**
	 * 2023-04-02 03:46:01
	 * template T
	 * param {T} [raw]
	 * returns {Promise<T|undefined>}
	 */
	async read() {
		if (this.enable) {
			this.raw = await this.flat.readJSON();
		} else {
			this.raw = this.res;
		}
	}

	/**
	 * @param {*} raw
	 * NOTE: Cache write disabled and enabled is filtered by the [enable] method
	 * @returns {Promise<boolean>}
	 */
	async write(raw) {
		if (this.enable) {
			return this.flat.writeJSON({ raw: raw, space: 2 });
		}
		return false;
	}
}

/**
 * NOTE: Internal
 * @param {string} word - 50+ ms
 * @param {boolean} watchIt - default value is false
 * @returns {Promise<env.BlockOfMeaning[]>}
 */
export async function fromJSON(word, watchIt = false) {
	let wt = new wordTarget();
	await wt.read();

	let sense = new defSense();
	await sense.read();

	let usage = new defUsage();
	await usage.read();

	// await docket.wordTarget();
	// await docket.getSense(watchIt);
	// await docket.getUsage(watchIt);

	/**
	 * @type {env.BlockOfMeaning[]}
	 */
	const res = [];

	// var raw = wt.raw.filter(e => check.isMatch(word, e.v));
	var raw = wt.raw.filter(e => check.isMatch(word, e.v));
	if (raw.length) {
		for (let index = 0; index < sense.raw.length; index++) {
			const elm = sense.raw[index];
			const rsc = raw.find(e => e.w == elm.w);
			if (rsc) {
				/**
				 * @type {env.BlockOfMeaning}
				 */
				const row = {};
				row.id = elm.i;
				row.pos = env.synset[elm.t].name;
				var term = raw.find(e => e.w == elm.w);
				if (term) {
					row.term = term.v;
				}
				row.v = makeup.sense(elm.v);
				row.type = "meaning";
				row.kind = ["json"];
				var exam = usage.raw
					.filter(m => m.i == elm.i)
					.map(y => makeup.exam(y.v));

				row.exam = {
					type: "examSentence",
					value: exam.flat()
				};
				res.push(row);
			}
		}
	}
	return res;
}

/**
 * SELECT id AS i, word AS term, wrte AS t, sense AS v,exam, dated FROM ?? WHERE LOWER(word) LIKE LOWER(?) ORDER BY wrte, wseq;
 * @param {string} word
 * @returns {Promise.<any[]>}
 */
export async function fromMySQL(word) {
	return db.mysql.query(
		"SELECT id AS i, word AS term, wrte AS t, sense AS v, exam FROM ?? WHERE word = ? ORDER BY wrte, wseq;",
		[env.config.table.senses, word]
	);
}

/**
 * Used to check cached data, to compare
 * @param {string} word
 * @returns {Promise.<any[]>}
 */
export async function fromMYSQLLastChange(word) {
	return db.mysql.query(
		"SELECT dated FROM ?? WHERE word = ? ORDER BY dated DESC LIMIT 1;",
		[env.config.table.senses, word]
	);
}

/**
 * Used to check cached data, to compare
 * @param {string} word
 * @returns {Promise.<any[]>}
 */
export async function fromMYSQLSuggestionSoundex(word) {
	return db.mysql.query(
		"SELECT word, wrte FROM ?? where SOUNDEX(word) LIKE SOUNDEX(?)",
		[env.config.table.senses, word]
	);
}

/**
 * Used to check cached data, to compare
 * @param {string} word
 * @returns {Promise.<any[]>}
 */
async function fromMYSQLSpelling(word) {
	return db.mysql.query(
		"SELECT suggest FROM ?? where SOUNDEX(word) LIKE SOUNDEX(?);",
		[env.config.table.spelling, word]
	);
}

/**
 * antonyme
 * @param {string} word
 * @returns {Promise.<{opposite:string}[]>}
 */
async function _fromDBAntonym(word) {
	return db.mysql.query(
		"SELECT opposite FROM view_antonym  WHERE word LIKE ?",
		[word]
	);
}

/**
 * NOTE: Internal
 * @param {any[]} raw
 * @returns {Promise<env.BlockOfMeaning[]>}
 */
async function fromMySQLMakeup(raw) {
	/**
	 * @type {env.BlockOfMeaning[]}
	 */
	const res = [];
	if (raw.length) {
		for (let index = 0; index < raw.length; index++) {
			const elm = raw[index];
			/**
			 * @type {env.BlockOfMeaning}
			 */
			const row = {};
			row.id = elm.i;
			row.pos = env.synset[elm.t].name;
			row.term = elm.term;
			// row.v = makeup.sense(elm.v);
			row.v = makeup.defBlock(elm.v, elm.term);
			row.type = "meaning";
			row.kind = ["mysql"];
			row.exam = {
				type: "examSentence",
				value: elm.exam ? makeup.exam(elm.exam) : []
			};

			res.push(row);
		}
	}
	return res;
}

/**
 * NOTE: Internal
 * just responsible for looking up sense
 * definition - OPTION: ...development, ...mysqlConnection
 * @param {string} word
 *
 * @returns {Promise<env.TypeOfDefinition>}
 */
export async function definition(word) {
	/**
	 * @type {env.TypeOfDefinition}
	 */
	let res = {
		ord: [],
		row: []
	};

	try {
		// @ts-ignore
		if (env.config.fromDatabase == "true") {
			// NOTE: from MySQL
			let raw = await fromMySQL(word);
			if (raw.length) {
				res.row = await fromMySQLMakeup(raw);
				res.ord = wordUnique(res.row);
			}
		} else {
			// NOTE: from JSON
			res.row = await fromJSON(word);
		}
	} catch (error) {
		// NOTE: error
	}

	return res;
}

/**
 * NOTE: Internal
 * translation
 * @param {string} word
 * @param {string} [lang] - default primary.id
 * @returns { Promise<env.RowOfLangSrc[]>}
 */
export async function translation(word, lang) {
	/**
	 * type {env.RowOfLangSrc[]}
	 */
	if (!lang || lang == primary.id) return [];

	/**
	 * @type {env.RowOfLangSrc[]}
	 */
	var res = [];

	let ws = new wordSource({ lang: lang });
	await ws.read();

	// const raw = await docket.wordSource(lang);

	for (let index = 0; index < ws.raw.length; index++) {
		const elm = ws.raw[index];
		if (check.isMatch(word, elm.v)) {
			var i = res.findIndex(
					o => o.hasOwnProperty("v") && check.isMatch(elm.v, o.v)
				),
				src = elm.e.split(";");
			if (i >= 0) {
				res[i].e = fire.array.unique(res[i].e.concat(src));
			} else {
				res.push({
					v: elm.v,
					e: fire.array.unique(src)
				});
			}
		}
	}
	return res;
}

/**
 * @todo merge to pos
 * @param {string} word
 * returns {env.BlockOfMeaning|null}
 * @returns {env.BlockOfMeaning[]}
 */
export function wordThesaurus(word, sensitive = false) {
	/**
	 * type {string[]}
	 */
	var row = thesaurus.find(word);
	const res = [];
	for (let index = 0; index < row.length; index++) {
		const e = row[index];
		const pos = thesaurus.posName(e.pos);
		const count = e.raw.length.toString();
		const wCount = count == "1" ? "a" : count;
		const wForm = count == "1" ? "word" : "words";
		res.push({
			term: word,
			type: "meaning",
			pos: "thesaurus",
			kind: ["odd", "anth", pos],
			v: "(-~-) wCount wForm related to {-wSouce-} as {-*?-}."
				.replace(/wCount/, wCount)
				.replace(/wForm/, wForm)
				.replace(/wSouce/, word)
				.replace(/\*\?/, pos),

			exam: {
				type: "examWord",
				value: e.raw
			}
		});
	}
	return res;
}

/**
 * @todo merge to pos
 * @param {string} word
 * returns {env.BlockOfMeaning|null}
 * @returns {Promise<env.BlockOfMeaning[]>}
 */
export async function wordAntonym(word) {
	let row = await _fromDBAntonym(word);

	const res = [];
	const total = row.length;
	if (total) {
		let wForm = total == 1 ? "word" : "words";
		let wCount = total == 1 ? "a" : total.toString();
		res.push({
			term: word,
			type: "meaning",
			pos: "antonym",
			kind: ["odd", "anth"],
			v: "(-~-) wCount wForm opposite to {-wName-}."
				.replace(/wCount/, wCount)
				.replace(/wForm/, wForm)
				.replace(/wName/, word),
			exam: {
				type: "examWord",
				value: row.map(e => e.opposite)
			}
		});
	}
	return res;
}

/**
 * @param {string} word
 * @returns {env.BlockOfMeaning|undefined}
 */
export function wordNumber(word) {
	var rowNotation = myanmarNotation.get(word);
	if (rowNotation.number && rowNotation.number != "NaN") {
		let eng = numberToWords.toWords(rowNotation.digit);
		if (eng) {
			// rule, size, list;
			rowNotation.notation.push({ sense: eng, rule: 0, size: 0, list: [] });
		}
		return {
			term: word,
			type: "meaning",
			pos: "number",
			kind: ["notation"],
			v: rowNotation.number,
			exam: {
				type: "examSentence",
				value: rowNotation.notation.map(e => e.sense)
			}
		};
	}
	return undefined;
}

/**
 * @param {env.RowOfDefinition[]} raw
 * @param {env.BlockOfMeaning[]} arr
 */
export function wordCategory(raw, arr) {
	// term.replace(/\[.*\]/g, ''),
	fire.array
		.category(arr, o => o.term)
		.forEach((row, term) => {
			/**
			 * @type {env.RowOfDefinition}
			 */
			var data = {
				word: term,
				clue: {}
			};
			fire.array
				.category(row, o => o.type)
				.forEach((row, type) => {
					data.clue[type] = fire.array.group(row, "pos", true);
				});
			raw.push(data);
		});
}

/**
 * fromMYSQLSuggestionSoundex and makeup
 * @param {string} word
 * @returns {Promise<string[]>}
 */
export async function wordSuggestion(word) {
	var raw = await fromMYSQLSuggestionSoundex(word);
	var lst = raw.map(e => e.word);
	return [...new Set(lst)];
}

/**
 * fromMYSQLSuggestionSoundex and makeup
 * @param {string} word
 * @returns {Promise<string[]>}
 */
export async function wordSpelling(word) {
	var raw = await fromMYSQLSpelling(word);
	var lst = raw.map(e => e.suggest);
	return [...new Set(lst)];
}

/**
 * Create resultWord list unique
 * @param {env.BlockOfMeaning[]} raw
 * @returns {string[]}
 */
export function wordUnique(raw) {
	if (raw && raw.length) {
		var resultWord = raw.map(e => e.term.toLowerCase());
		// var resultWord = raw.map(e => e.term);
		return [...new Set(resultWord)];
	}
	return [];
}

/**
 * Log keyword in db
 * @param {string} word - keyword
 * @param {string} lang - [en, no, my]
 * @param {number} [status] - 0 or more
 * @returns {Promise<void>}
 */
export async function logKeyword(word, lang, status) {
	if (typeof status != "number") {
		status = 0;
	}
	db.mysql.query(
		"INSERT INTO ?? SET word=?, status=?, lang=? ON DUPLICATE KEY UPDATE view = view + 1, status=?, lang=?;",
		[env.config.table.keyword, word, status, lang, status, lang]
	);
}
