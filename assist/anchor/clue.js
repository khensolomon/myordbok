import { db, fire, config } from "lethil";

// @ts-ignore
import modThesaurus from "thesaurus";
import myanmarNotation from "myanmar-notation";

import { setting } from "./config.js";
import * as docket from "./json.js";
import * as glossary from "./glossary.js";
import * as chat from "./chat.js";
import * as makeup from "./makeup.js";
import * as language from "./language.js";

const { fileName, synset } = setting;

/**
 * @param {string} word
 * @param {boolean} watchIt - default value is false
 */
export async function fromJSON(word, watchIt = false) {
	// console.log("fromJSON", "JSON");
	// await docket.get(fileName.word,_watchData);
	await docket.get(glossary.word("en"), watchIt);
	await docket.get(fileName.sense, watchIt);
	await docket.get(fileName.usage, watchIt);

	var raw = docket.data.en.filter(e => chat.compare(word, e.v));
	if (raw.length) {
		return docket.data.sense
			.filter(o => raw.find(e => e.w == o.w))
			.map(function(o) {
				// console.log("row.id", o.id, o);
				var row = {};
				row.id = o.i;
				row.pos = synset[o.t].name;
				row.term = raw.find(e => e.w == o.w).v;
				row.v = makeup.sense(o.v);
				row.type = "meaning";
				var exam = docket.data.usage
					.filter(m => m.i == o.i)
					.map(y => makeup.exam(y.v));
				row.exam = [].concat.apply([], exam);
				return row;
			});
	}
	return [];
}

/**
 * @param {string} word
 * strSpaces
  REPLACE(word,' ','')
  \s-?!,.
  REPLACE(REPLACE(word,' ',''),'hello','hi')
  console.log('sql',word)
 */
export async function fromMySQL(word) {
	// console.log("fromMySQL", raw, setting.table.senses, word);
	const raw = await db.mysql.query(
		"SELECT id, word AS term, wrte AS pos, sense AS v,exam FROM ?? WHERE LOWER(word) LIKE LOWER(?) ORDER BY wrte, wseq;",
		[setting.table.senses, word]
	);
	if (raw.length) {
		return raw.map(function(o) {
			o.pos = synset[o.pos].name;
			o.v = makeup.sense(o.v);
			o.type = "meaning";
			o.exam = o.exam ? makeup.exam(o.exam) : [];
			return (({ id, term, v, pos, type, exam }) => ({
				id,
				term,
				v,
				pos,
				type,
				exam
			}))(o);
		});
	}
	return [];
}

/**
 * @param {string} word
 */
export function wordThesaurus(word, sensitive = false) {
	/**
	 * @type {string[]}
	 */
	var row = modThesaurus.find(word.toLowerCase());

	if (row.length) {
		// var okey = (sensitive == true && row.find(e => e == word) == null);
		// // us uk goat man?

		return {
			term: word,
			type: "suggestion",
			pos: "thesaurus",
			kind: ["odd"],
			v: row
		};
	}
	return null;
}

/**
 * @param {string} word
 */
export function wordNumber(word) {
	var rowNotation = myanmarNotation.get(word);
	if (rowNotation.number) {
		return {
			term: word,
			type: "meaning",
			pos: "Number",
			kind: ["notation"],
			v: rowNotation.number,
			exam: rowNotation.notation.map(e => e.sense)
		};
	}
	return null;
}

/**
 * @param {Array<any>} raw
 * @param {Array<any>} arr
 */
export function wordCategory(raw, arr) {
	// term.replace(/\[.*\]/g, ''),
	fire.array
		.category(arr, o => o.term)
		.forEach((row, term) => {
			var data = { word: term, clue: {} };
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
 * @param {string} lang
 * @example suggestion('love') -> ["love","loves","loved",...]
 */
export async function suggestion(word, lang) {
	return await docket
		.get(glossary.word(lang))
		.then(e =>
			e
				.filter(e => e.v.toLowerCase().startsWith(word.toLowerCase()))
				.map(e => e.v)
				.slice(0, 10)
		)
		.catch(() => []);
}

const lID = language.primary.id;

/**
 * translation
 * @param {string} word
 * @param {string} lang - default language.primary.id
 */
export async function translation(word, lang = lID) {
	var raw = [];
	if (lang == lID) return raw;
	const row = await docket.get(glossary.word(lang));

	row
		.filter(e => chat.compare(word, e.v))
		.forEach(function(w) {
			var i = raw.findIndex(
					e => e.hasOwnProperty("v") && chat.compare(w.v, e.v)
				),
				src = w.e.split(";");
			if (i >= 0) {
				raw[i].e = fire.array.unique(raw[i].e.concat(src));
			} else {
				raw.push({ v: w.v, e: fire.array.unique(src) });
			}
		});
	return raw;
}

/**
 * definition - OPTION: ...development, ...mysqlConnection
 * @param {string} word
 * @param {boolean} [useMySQL]
 */
export async function definition(word, useMySQL) {
	try {
		if (useMySQL == true) {
			return await fromMySQL(word);
		} else {
			return await fromJSON(word, false);
		}
	} catch (error) {
		return [];
	}
	// try {
	// 	if (setting.development && live == true) {
	// 		return await fromMySQL(word);
	// 	} else {
	// 		return await fromJSON(word, false);
	// 	}
	// } catch (error) {
	// 	return [];
	// }
}
