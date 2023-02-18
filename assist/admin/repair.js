// import * as fs from 'fs';
import path from "path";
// import util from 'util';

import { db } from "lethil";
import { env, json, chat } from "../anchor/index.js";

const { table } = env.config;

// import {table,docket,makeup,fileName,chat,language,information} from './dictionary.Config.js';

// import orthography from './orthography.js';
// import * as partOfSpeech from './dictionary.pos.js';

/*
TODO
forming compound adjs
*/
var raw = [
	{ sense: "(also <b>airmail letter/Aerogramme</b>) လေယာဉ်စာ။ လေကြောင်းစာ။" },
	{ sense: "လေယာဉ်။ (also <b>airplane</b>/<b>helicopter</b>)" },
	{
		sense:
			"ဗျာသင့်သူတို့အတွက် ပြန်ကြားချက်က။ (also <b>advice column</b>)(Brit.)"
	}
];

export default async function(q) {
	// `sense` NOT LIKE '% %' AND `sense` NOT LIKE '%[%' AND `sense` LIKE '%a%'
	// sense LIKE ? '%whatever%'
	// sense NOT LIKE ? AND sense NOT LIKE ? AND sense LIKE ? ['% %','%[%','%a%']
	// sense NOT LIKE ? AND sense NOT LIKE ? AND sense REGEXP ? ['% %','%[%','[a-zA-Z]']
	raw = await db.mysql
		.query("SELECT id, word, sense FROM ?? WHERE sense LIKE ?;", [
			table.senses,
			"%\t%"
		])
		.then(e => e)
		.catch(e => {
			console.error("---", e.message);
			return [];
		});

	for (let row of raw) {
		// = -> n, v
		// =  PRAYING MANTIS
		// row.sense = row.sense.replace(/=[\s+]?/g,'[=:').replace(/ n/gi,']');
		// row.sense = row.sense.replace(/=[\s+]?/g,'[=:').replace(/$/gi,']');
		// row.sense = row.sense.replace(/^.[\s+]?/g,'(=<b>').replace(/\s.$/gi,'</b>)');
		// row.sense = row.sense.replace(/^.[\s+]?/g,'(=<b>').replace(/$/gi,'</b>)');

		// var wordPos = await partOfSpeech.admin_base(row.word);
		// if (wordPos.root.length){
		//   await update2NULL(row);
		// } else {
		//   row.id = null;
		//   console.log('-- no reset:',row.word)
		// }

		// row.sense = row.sense.replace(/~\s?\(/g,'(~ ');
		// row.sense = row.sense.replace(/~\s?/g,'(~ ');
		// row.sense = row.sense.replace(/\)\s?\(/g,'; ~ ').replace(/;\s?\(~/g,'; ~ ');
		// row.sense = createParenthesisWithBold(row.sense.replace(/\./g,'').replace(/\s?:\s?$/,''));
		row.sense = createParenthesisWithBold(
			row.sense
				.replace(/\t/g, " ")
				.replace(/\s\s/g, " ")
				.replace(/\s?\/\s?/g, "/")
		);

		// NOTE: replace []->()
		// row.sense = row.sense.replace(/\[/g,'(').replace(/\]/g,')');
		// NOTE: remove (<b>*</b>)
		// row.sense = row.sense.replace(/\(<b[^>]*>(.+?)<\/b>\)/g,'');
		row.sense = chat.stripString(formatParenthesisWithBold(row.sense));
		// row.test = await orthography.break(row.sense);
		// if (row.id && q == 'update') await updateSense(row);
	}

	var rawFile = path.join("./test", "_test_makeup_result.json");
	await json.write(rawFile, raw, 2);
	return [rawFile, raw.length];
}

const createParenthesisWithBold = function(str) {
	// not between: \{\{[^\}]*\}\}
	// match words: (\w+\s?\/?\-?\w+\s?\w+\s?\w+)
	// match word but not between: \b(?<!\[)[(\w+\s?\/?\-?\w+\s?\w+\s?\w+)]+(?!\])\b
	// (\w+\s?\/?\-?\w+\s?\-?\w+\s?\w+)
	// var roundBracket = /\((.+)\)/g;
	// var squareBracket = /\[(.+)\]/g;
	// var curlyBracket = /\{(.+)\}/g;
	// [~:often] [~:[~:the screen]][[~:sing]]
	var testBracket = [
		[/\((.+)\)/, "round"],
		[/\[(.+)\]/, "square"],
		[/\{(.+)\}/, "curly"]
	];
	var noteRound = " (~ $1) ";
	var brackets = {
		round: function(str, reg) {
			// TODO: ??
			console.log("round", str);
			if (/\~/.test(str)) {
				// ) (
				str = str
					.replace(/\~/, "")
					.replace(/\((.+)\)/g, "$1;")
					.replace(/\)\s?\(/g, "; ")
					.replace(/\(/g, "")
					.replace(/\)/g, "; ")
					.replace(/\;$/, "");
				// return ' (~ ?) '.replace('?',s);
				return str.replace(/(.*)/, noteRound);
			} else {
				return str;
			}
		},
		square: function(str, reg) {
			// console.log('square',str)
			if (/[:~]/.test(str)) {
				// NOTE: nothing todo
				return str.toLowerCase();
				// return str.replace(reg,' (makeup~ $1) ')
			} else {
				// EXAM: [fml] -> (~ fml)
				// console.log('square',str)
				// return str.replace(/\~/,'(~').replace(/\[/,') [').replace(reg,noteRound)
				return str.replace(reg, noteRound);
			}
		},
		curly: function(str, reg) {
			// TODO: ??
			console.log("curly", str);
			return str;
		},
		makeup: function(str, keyName) {
			if (/\~/.test(str)) {
				// ~ A (on/to B); ~ A and B
				// return '??'+str
				return " (?) "
					.replace("?", str.trim())
					.replace(/\(\(/, "(")
					.replace(/\)\)/, ")");
			} else if (/compare\s/i.test(str)) {
				// console.log('compare',str,str.replace(/^compare\s/i,''))
				str = str
					.replace(/compare\s/i, "")
					.replace(/\./g, "")
					.split(/[\,\;\/]/)
					.filter(e => e.trim())
					.map(e => e.trim().toLowerCase())
					.join("/");
				return " [compare:?] ".replace("?", str);
			} else if (/see also /i.test(str)) {
				// console.log('compare',str,str.replace(/^compare\s/i,''))
				str = str
					.replace(/see also /i, "")
					.replace(/\./g, "")
					.split(/[\,\;\/]/)
					.filter(e => e.trim())
					.map(e => e.trim().toLowerCase())
					.join("/");
				return " [see:?] ".replace("?", str);
			} else if (keyName) {
				return " [~:?] ".replace("~", keyName).replace(
					"?",
					str
						.replace(/\./g, "")
						.trim()
						.toLowerCase()
				);
			} else {
				return " [~:?] ".replace(
					"?",
					str
						.replace(/\./g, "")
						.trim()
						.toLowerCase()
				);
			}
		}
	};
	// str = str.replace(/see also/gi,'');
	// return str.replace(/(\w+(\s|\/|\-|,)?\w+(\s|\/|\-|,)?\w+(\s|\/|\-|,)?\w+)/g,'(<b>$1</b>)');
	// ([\[\(\{]?(~:|~\s?)?\w+[\s\/\-\,~\:\.\']?[\]\)\}]?)+
	return str.replace(
		/([\[\(\{]?(\s|;|;\s?~|~:|~\s?|-)?\w+[\s\/\-\,~\:\;\.\']?[\]\)\}]?)+/g,
		fullMatch => {
			// if (hasParenthesis.test(fullMatch)){}
			var hackedString = null;

			var testString = testBracket.filter(
				// e => e[0].test(fullMatch)
				e => new RegExp(e[0]).test(fullMatch)
			);
			if (testString.length) {
				hackedString = testString
					.map(e => brackets[e[1]](fullMatch, e[0]))
					.join("");
			} else {
				hackedString = brackets.makeup(fullMatch);
				// hackedString='none- '+fullMatch;
			}
			// testBracket.forEach(s=>{
			//   // hackedString = brackets[e[1]](e)
			//   if (s[0].test(fullMatch)){
			//     hackedString = brackets[s[1]](fullMatch,s[0])
			//     // console.log(fullMatch)
			//   }
			// });
			return hackedString;
		}
	);
};

/**
 *
 * @param {string} str
 */
const formatParenthesisWithBold = function(str) {
	// Array<(string | RegExp)[]>.filter(predicate: (value: (string | RegExp)[], index: number, array: (string | RegExp)[][]) => unknown, thisArg?: any): (string | RegExp)[][]

	/**
	 * @type {(string | RegExp)[][]} abc
	 */
	var abc = [
		[/ ns[\:\.]?(\s|\,|\))/gi, " N$1"],

		[/ verbs[\:\.]?(\s|\,|\))/gi, " V$1"],

		[/ vs[\:\.]?(\s|\,|\))/gi, " V$1"],

		[/ adjs[\:\.]?(\s|\,|\))/gi, " Adj$1"],
		[/ advs[\:\.]?(\s|\,|\))/gi, " Adv$1"],
		[/ ADV /gi, " Adv "],
		[/ adj /gi, " Adj "],
		[/ prep /gi, " Prep "],
		[/ preps[\:\.]?(\s|\,|\))/gi, " Prep$1"],

		[/US also/gi, "US"],
		[/brit also/gi, "Brit"],

		[/Brit.\)/g, "Brit)"],
		[/Brit.,/g, "Brit;"],
		[/Brit\./g, "Brit;"],
		[/informal/g, "infml"],
		[/formal/g, "fml"],
		[/\s?\/\s?/g, "/"],
		[/\(\s+?/g, "("],
		[/\s+?\)/g, ")"],
		[/\s(။)/g, "$1"],
		[/\s(၊)/g, "$1 "]
	];

	abc
		.filter(e => new RegExp(e[0]).test(str))
		.forEach(function(e) {
			str = str.replace(e[0], e[1].toString());
		});

	// NOTE: formal Parenthesis with Bold tag
	return str.replace(/\((.+?)\)/g, (fullMatch, e) => {
		var pattern = /<b[^>]*>(.+?)<\/b>/g;
		// var pattern = /<\/?b>/;
		if (pattern.test(e)) {
			if (/<b>-/.test(e)) {
				return "";
			}
			var name = fullMatch.match(/\((.+?)<b/);
			var tpl = "[~:?]";
			if (name) {
				name = formatNameKey(name[1].replace(/\./g, "").trim());
				if (name) {
					tpl = tpl.replace("~", name.toString());
				}
			}
			var value = e
				.match(pattern)
				.map(a => a.replace(/<\/?b>/g, "").trim())
				.filter((v, i, a) => a.indexOf(v) === i)
				.join("/")
				.split(",")
				.map(e => e.trim())
				.join("/")
				.split("/")
				.map(
					// e=>chat.toUpperCaseFirst(e.trim())
					e => e.trim().toLowerCase()
				)
				.join("/");

			return tpl.replace("?", value);
			// return '?'
		} else {
			return fullMatch;
		}
	});
};

const formatNameKey = function(str) {
	// brit -> Brit/UK
	var upperCase = ["uk", "us"];
	var replaceCase = [
		["reporting verb", "reporting V"],
		["often n", "often N"],
		["often as n", "often N"],
		["often adj", "often ADJ"],
		["often as adj", "often ADJ"],
		["usu as adj", "usu ADJ"],
		["usu as n", "usu N"],
		["symbol", "symb"],
		["female", "fem"],
		["usu passive", "usu Passive"],

		["also esp US", "esp US"],
		["abbrs", "abbr"],
		["also informal", "also infml"],
		["us also", "US"],

		["also US", "US"],
		["also US informal", "US infml"],
		["US informal", "US fml"],
		["also US formal", "US fml"],
		["also infml esp US", "US infml"],

		["brit also", "brit"],
		["also brit", "brit"],
		["also brit informal", "brit infml"],
		["brit informal", "brit fml"],
		["also brit formal", "brit fml"]
	];
	if (!str) return null;
	var strMatch = str.match(/\w+/g);
	if (strMatch) {
		str = strMatch
			.map(e => {
				if (upperCase.indexOf(e.toLowerCase()) >= 0) {
					return e.toUpperCase();
				} else {
					return e.toLowerCase();
				}
			})
			.join(" ");
	}
	str = str.trim();
	replaceCase.forEach(i => {
		str = str.replace(i[0], i[1]);
	});
	return str;
};

const updateSense = async function(row) {
	await db.mysql
		.query("UPDATE ?? SET sense = ? WHERE id = ?;", [
			table.senses,
			row.sense,
			row.id
		])
		.then(() => console.log("--- updated:", row.word))
		.catch(e => console.error(e.message));
};

const update2NULL = async function(row) {
	// UPDATE `senses` SET `tid` = 0, `sense` = NULL, `exam` = NULL, `seq` = 0, `kid` = 0, `wid` = 0 WHERE `word` IS NULL;
	return await db.mysql
		.query(
			"UPDATE ?? SET word = NULL, tid = 0, sense = NULL, exam = NULL, seq = 0, kid = 0, wid = 0 WHERE `word` LIKE ?;",
			[table.senses, row.word]
		)
		.then(() => console.log("-- to reset:", row.word))
		.catch(e => console.error(e.message));
};
