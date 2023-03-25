import { db, fire, parse } from "lethil";
import * as env from "./env.js";

import thesaurus from "word-thesaurus";

import myanmarNotation from "myanmar-notation";

import * as docket from "./json.js";
import { check } from "lethil";
// import * as chat from "./chat.js";
import * as makeup from "./makeup.js";
import * as language from "./language.js";

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
	/**
	 * @type {env.TypeOfSearchQuery}
	 */
	const res = {
		input: str,
		word: "",
		sentence: [],
		status: false
	};
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
	return res;
}
/**
 * @param {string} word - 50+ ms
 * @param {boolean} watchIt - default value is false
 * @returns {Promise<env.RowOfMeaning[]>}
 */
export async function fromJSON(word, watchIt = false) {
	await docket.getWord();
	await docket.getSense(watchIt);
	await docket.getUsage(watchIt);

	/**
	 * @type {env.RowOfMeaning[]}
	 */
	const res = [];

	var raw = docket.data.en.filter(e => check.isMatch(word, e.v));
	if (raw.length) {
		for (let index = 0; index < docket.data.sense.length; index++) {
			const elm = docket.data.sense[index];
			const rsc = raw.find(e => e.w == elm.w);
			if (rsc) {
				/**
				 * @type {env.RowOfMeaning}
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
				row.cast = "exam_meaning";
				row.kind = ["json"];
				var exam = docket.data.usage
					.filter(m => m.i == elm.i)
					.map(y => makeup.exam(y.v));

				row.exam = exam.flat();
				res.push(row);
			}
		}
	}
	return res;
}

/**
 * @param {string} word - 200+ ms
 * @returns {Promise<env.RowOfMeaning[]>}
 * strSpaces
 * REPLACE(word,' ','') \s-?!,.
 * REPLACE(REPLACE(word,' ',''),'hello','hi')
 */
export async function fromMySQL(word) {
	const raw = await db.mysql.query(
		"SELECT id AS i, word AS term, wrte AS t, sense AS v,exam FROM ?? WHERE LOWER(word) LIKE LOWER(?) ORDER BY wrte, wseq;",
		[env.config.table.senses, word]
	);
	/**
	 * @type {env.RowOfMeaning[]}
	 */
	const res = [];
	if (raw.length) {
		for (let index = 0; index < raw.length; index++) {
			const elm = raw[index];
			/**
			 * @type {env.RowOfMeaning}
			 */
			const row = {};
			row.id = elm.i;
			row.pos = env.synset[elm.t].name;
			row.term = elm.term;
			row.v = makeup.sense(elm.v);
			row.type = "meaning";
			row.cast = "exam_meaning";
			row.kind = ["mysql"];
			row.exam = elm.exam ? makeup.exam(elm.exam) : [];
			res.push(row);
		}
	}
	return res;
}

/**
 * @todo merge to pos
 * @param {string} word
 * returns {env.RowOfMeaning|null}
 * @returns {env.RowOfMeaning[]}
 */
export function wordThesaurus(word, sensitive = false) {
	/**
	 * type {string[]}
	 */
	var row = thesaurus.find(word.toLowerCase());

	const res = [];

	for (let index = 0; index < row.length; index++) {
		const e = row[index];
		const pos = thesaurus.posName(e.pos).toLowerCase();
		const total = e.raw.length.toString();
		res.push({
			term: word,
			type: "meaning",
			cast: "exam_thesaurus",
			// pos: thesaurus.posName(e.pos),
			pos: "Thesaurus",
			kind: ["odd", pos],
			v: "(-~ total-) words related to {-query-} as {-*?-}."
				.replace(/total/, total)
				.replace(/query/, word)
				.replace(/\*\?/, pos),
			exam: e.raw
		});
	}

	return res;

	// return row.map(function(e) {
	// 	const pos = thesaurus.posName(e.pos);
	// 	const total = e.raw.length.toString();
	// 	return {
	// 		term: word,
	// 		type: "meaning",
	// 		cast: "exam_thesaurus",
	// 		// pos: thesaurus.posName(e.pos),
	// 		pos: "Thesaurus",
	// 		kind: ["odd", pos.toLowerCase()],
	// 		v: "(-~ total-) words related to {-query-} as {-*?-}."
	// 			.replace(/total/, total)
	// 			.replace(/query/, word)
	// 			.replace(/\*\?/, pos.toLowerCase()),
	// 		exam: e.raw
	// 	};
	// });

	// row.map(e => e.raw);
	// var a1 = row.map(e => e.raw);
	// // var a2 = [].concat.apply([],a1);
	// // var a2 = a1.reduce(function(prev, next) {
	// // 	return prev.concat(next);
	// // });
	// /**
	//  * @type {string[]}
	//  */
	// var tmpSolution = [];
	// if (a1.length) {
	// 	var a2 = a1.reduce((prev, next) => prev.concat(next));
	// 	tmpSolution = [...new Set(a2)];
	// }
	// // [...new Set()];
	// // const tmpSolution = [...new Set(a2)];

	// if (row.length) {
	// 	// var okey = (sensitive == true && row.find(e => e == word) == null);
	// 	// // us uk goat man?

	// 	return {
	// 		term: word,
	// 		type: "suggestion",
	// 		pos: "thesaurus",
	// 		kind: ["odd"],
	// 		v: "",
	// 		exam: tmpSolution
	// 	};
	// }
	// return null;
}

/**
 * @param {string} word
 * @returns {env.RowOfMeaning|null}
 */
export function wordNumber(word) {
	var rowNotation = myanmarNotation.get(word);
	if (rowNotation.number && rowNotation.number != "NaN") {
		return {
			term: word,
			type: "meaning",
			cast: "exam_meaning",
			pos: "Number",
			kind: ["notation"],
			v: rowNotation.number,
			exam: rowNotation.notation.map(e => e.sense)
		};
	}
	return null;
}

/**
 * @param {env.RowOfDefinition[]} raw
 * @param {env.RowOfMeaning[]} arr
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
 * Used in api -
 * @param {string} word
 * @param {string} [lang]
 * @returns { Promise<string[]>}
 * @example suggestion('love') -> ["love","loves","loved",...]
 */
export async function suggestion(word, lang) {
	const res = [];
	var count = 0;
	const raw = await docket.getWord(lang);
	for (let index = 0; index < raw.length; index++) {
		const elm = raw[index];
		if (elm.v.toLowerCase().startsWith(word.toLowerCase())) {
			res.push(elm.v);
			count++;
		}
		if (count >= 10) {
			break;
		}
	}
	return res;
}

/**
 * translation
 * @param {string} word
 * @param {string} [lang] - default language.primary.id
 * @returns { Promise<env.RowOfLangSrc[]>}
 */
export async function translation(word, lang) {
	/**
	 * @type {env.RowOfLangSrc[]}
	 */
	var res = [];
	if (lang == language.primary.id) return res;

	const raw = await docket.getWord(lang);

	for (let index = 0; index < raw.length; index++) {
		const elm = raw[index];
		if (check.isMatch(word, elm.v)) {
			var i = res.findIndex(
					e => e.hasOwnProperty("v") && check.isMatch(elm.v, e.v)
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
 * definition - OPTION: ...development, ...mysqlConnection
 * @param {string} word
 * @returns {Promise<env.RowOfMeaning[]>}
 */
export async function definition(word) {
	try {
		if (env.config.fromDatabase == "true") {
			// NOTE: force from MySQL
			return await fromMySQL(word);
		} else {
			// NOTE: force from JSON
			return await fromJSON(word, false);
		}
	} catch (error) {
		return [];
	}
}
