import { fire, check, utility } from "lethil";

import * as env from "./env.js";
import * as docket from "./json.js";

/**
 * name of part of speech from config.synset
 * not in used ???
 * @param {number} Id
 * @returns {env.PosOfSynset}
 */
export function posSynset(Id) {
	let has = env.config.synset[Id];
	if (has) {
		return has;
	}
	return env.config.synset[0];
}

/**
 * type of part of speech from config.synmap
 * @param {number} Id
 * @returns {env.PosOfSynmap}
 */
export function posSynmap(Id) {
	let has = env.config.synmap.find(i => i.id == Id);
	if (has) {
		return has;
	}
	return env.config.synmap[0];
}

// export function grammar(){
//   return synmap.map((v,index) =>(v.id=index,v));
// }

/**
 * org: wordPos
 * @typedef {{time:any; root:env.TypeOfSynset[]; part:env.TypeOfSynmap[]; form:env.RowOfMeaning[]; test:boolean}} TypeOfPartOfSpeech
 * @param {string} keyword
 * @returns {Promise<TypeOfPartOfSpeech>}
 */
export async function main(keyword) {
	const timeStart = utility.timeCheck();
	const synset = await docket.getSynset();
	const synmap = await docket.getSynmap();
	/**
	 * @type {TypeOfPartOfSpeech}
	 */
	const result = {
		time: "",
		root: [],
		part: [],
		form: [],
		test: false
	};

	// NOTE: oops -> irregular Verbs ??? /s|ed|ing$/i.test(keyword) &&
	if (/less|sing|king$/i.test(keyword) == false) {
		// NOTE: loves, fetched
		for (let index = 0; index < synmap.length; index++) {
			const elm = synmap[index];
			if (elm.t < 10 && check.isMatch(elm.v, keyword)) {
				if (!result.root.find(i => i.w == elm.w)) {
					var rt = synset.find(i => i.w == elm.w);
					if (rt) {
						result.root.push(rt);
					}
				}
			}
			const se = result.root.find(i => i.w == elm.w);
			if (elm.d > 0 && se) {
				// var pt = Object.assign({}, elm, {
				// 	term: se.v
				// });
				result.part.push(elm);
			}
		}
	}

	result.test = result.root.length > 0;

	if (!result.test) {
		// NOTE: love, fetch
		for (let index = 0; index < synset.length; index++) {
			const elm = synset[index];
			if (check.isMatch(elm.v, keyword)) {
				result.root.push(elm);
				// var pt = synmap.filter(i => i.d > 0 && i.w == elm.w);
				var pt = synmap.filter(i => i.w == elm.w && i.d > 0);
				result.part.push(...pt);
			}
		}
	}

	fire.array
		.category(result.part, e => e.w)
		.forEach(function(wordList, wordId) {
			var wordMain = result.root.find(e => e.w == wordId)?.v;
			fire.array
				.category(wordList, e => e.t)
				.forEach(function(raw, typeId) {
					/**
					 * @type {env.RowOfMeaning}
					 */
					var row = {
						term: wordMain || "",
						pos: posSynset(typeId).name,
						type: "meaning",
						cast: "exam_meaning",
						kind: ["part-of-speech"],
						v: formOfDescription(typeId, raw, wordMain, result.test),
						exam: []
					};
					result.form.push(row);
				});
		});

	result.time = utility.timeCheck(timeStart);
	return result;
}

/**
 * get description of part of speech
 * @param {number} type
 * @param {env.TypeOfSynmap[]} raw
 * @param {string} word
 * @param {boolean} test
 */
function formOfDescription(type, raw, word = "", test = false) {
	// (-~-) {-loves-} (plural)
	// (-~-) {-loves-} (plural) forms of {->-}
	// (-~-) {-loves-} (plural) derived forms of {->-}
	var res = raw.map(e => {
		return "(-~-) {-*-} (?)"
			.replace("*", e.v)
			.replace("?", posSynmap(e.d).name);
	});

	if (test) {
		if (type == 0) {
			// NOTE: noun
			// (-~-) {-kings-} (plural) forms of {-king-}
			res.push("forms of {->-}".replace(">", word));
		} else if (type == 1) {
			// NOTE: verb
			// (-~-) {-kings-} (3rd person); (-~-) {-kinged-} (past tense); (-~-) {-kinging-} (present participle) derived forms of {-king-}
			res.push("derived forms of {->-}".replace(">", word));
		} else if (type == 2) {
			// NOTE: adjective
			// (-~-) {-happier-} (comparative); (-~-) {-happiest-} (superlative) forms of {-happy-}
			res.push("forms of {->-}".replace(">", word));
		}
	}
	return res.join("; ");
}

/**
 * org: partOfSpeech_pos
 * @param {string} keyword
 */
export async function pos(keyword) {
	const timeStart = utility.timeCheck();
	/**
	 * @type {{time:any;root:env.TypeOfSynset[]; part:any;}}
	 */
	const result = {
		time: "",
		root: [],
		part: []
	};

	result.time = utility.timeCheck(timeStart);
	return result;
}

/**
 * org: partOfSpeech_base
 * @param {string} keyword
 */
export async function base(keyword) {
	var start = utility.timeCheck();
	const result = {
		timeEnd: "",
		root: [],
		part: [],
		form: []
	};

	result.timeEnd = utility.timeCheck(start);
	return result;
}
