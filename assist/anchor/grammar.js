import { fire, utility } from "lethil";

import * as env from "./env.js";
import { searchSynset, derivedSynmap, derivedSynset } from "./seed.js";

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

// /**
//  * org: wordPos
//  * @typedef {{time:any; root:env.TypeOfSynset[]; part:env.TypeOfSynmap[]; form:env.BlockOfMeaning[]; test:boolean}} TypeOfPartOfSpeech
//  * @param {string} keyword
//  * @returns {Promise<TypeOfPartOfSpeech>}
//  */
// export async function main_org(keyword) {
// 	const timeStart = utility.timeCheck();
// 	const synset = new defSynset();
// 	await synset.read();
// 	const synmap = new defSynmap();
// 	await synmap.read();

// 	// const synset = await listSynset();
// 	// const synmap = await listSynmap();
// 	/**
// 	 * @type {TypeOfPartOfSpeech}
// 	 */
// 	const result = {
// 		time: "",
// 		root: [],
// 		part: [],
// 		form: [],
// 		test: false
// 	};

// 	// NOTE: oops -> irregular Verbs ??? /s|ed|ing$/i.test(keyword) &&
// 	if (/less|sing|king$/i.test(keyword) == false) {
// 		// NOTE: loves, fetched
// 		for (let index = 0, len = synmap.raw.length; index < len; index++) {
// 			const elm = synmap.raw[index];
// 			if (elm.t < 10 && check.isMatch(elm.v, keyword)) {
// 				if (!result.root.find(i => i.w == elm.w)) {
// 					var rt = synset.raw.find(i => i.w == elm.w);
// 					if (rt) {
// 						result.root.push(rt);
// 					}
// 				}
// 			}
// 			const se = result.root.find(i => i.w == elm.w);
// 			if (elm.d > 0 && se) {
// 				// var pt = Object.assign({}, elm, {
// 				// 	term: se.v
// 				// });
// 				result.part.push(elm);
// 			}
// 		}
// 	} else {
// 		console.log("?", keyword);
// 		// console.log("synmap", keyword, synmap.raw);
// 	}

// 	result.test = result.root.length > 0;

// 	if (!result.test) {
// 		// NOTE: love, fetch
// 		for (let index = 0, len = synset.raw.length; index < len; index++) {
// 			const elm = synset.raw[index];
// 			if (check.isMatch(elm.v, keyword)) {
// 				result.root.push(elm);
// 				// var pt = synmap.filter(i => i.d > 0 && i.w == elm.w);
// 				var pt = synmap.raw.filter(i => i.w == elm.w && i.d > 0);
// 				result.part.push(...pt);
// 			}
// 		}
// 	}

// 	fire.array
// 		.category(result.part, e => e.w)
// 		.forEach(function(wordList, wordId) {
// 			var wordMain = result.root.find(e => e.w == wordId)?.v;
// 			fire.array
// 				.category(wordList, e => e.t)
// 				.forEach(function(raw, typeId) {
// 					/**
// 					 * @type {env.BlockOfMeaning}
// 					 */
// 					var row = {
// 						term: wordMain || "",
// 						pos: posSynset(typeId).name,
// 						type: "meaning",
// 						kind: ["part-of-speech"],
// 						v: formOfDescription(typeId, raw, wordMain, result.test),

// 						exam: {
// 							type: "examSentence",
// 							value: []
// 						}
// 					};
// 					result.form.push(row);
// 				});
// 		});

// 	result.time = utility.timeCheck(timeStart);

// 	console.log("?", result);
// 	return result;
// }

/**
 * org: wordPos
 * @typedef {{time:any; root:env.TypeOfSynset[]; part:env.TypeOfSynmap[]; form:env.BlockOfMeaning[]; test:boolean}} TypeOfPartOfSpeech
 * @param {string} keyword
 * @returns {Promise<TypeOfPartOfSpeech>}
 */
export async function main(keyword) {
	const timeStart = utility.timeCheck();
	// const synset = new defSynset();
	// await synset.read();
	// const synmap = new defSynmap();
	// await synmap.read();

	// const synset = await listSynset();
	// const synmap = await listSynmap();
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

	let wlst = await searchSynset(keyword);

	if (wlst.length) {
		for (let index = 0, len = wlst.length; index < len; index++) {
			const elm = wlst[index];

			if (elm.derived == 0) {
				let synset = await derivedSynset(keyword);

				if (synset.length) {
					if (!result.root.find(i => i.w == elm.w)) {
						result.root.push(elm);
					}
					for (let index = 0, len = synset.length; index < len; index++) {
						const sn = synset[index];
						// result.part.push({ w: sn.w, v: sn.v, d: sn.d, t: sn.t });
						result.part.push(sn);

						// console.log(sn);
					}
				}
			}
			if (!result.root.length) {
				let synmap = await derivedSynmap(elm.v);

				if (synmap.length) {
					for (let index = 0, len = synmap.length; index < len; index++) {
						const sm = synmap[index];

						if (!result.root.find(i => i.w == sm.w)) {
							result.root.push({ w: sm.w, v: sm.word });
						}
						if (result.root.find(i => i.w == sm.w)) {
							result.part.push(sm);
						}
						// if (sm.d > 0 && se) {
						// 	result.part.push(sm);
						// }
					}
					result.test = result.root.length > 0;
				}
			}
		}
	}

	fire.array
		.category(result.part, e => e.word)
		.forEach(function(wordList, word) {
			// console.log("wordId", wordId);
			// var wordMain = result.root.find(e => e.w == wordId)?.v;
			fire.array
				.category(wordList, e => e.t)
				.forEach(function(raw, typeId) {
					/**
					 * @type {env.BlockOfMeaning}
					 */
					var row = {
						term: word,
						pos: posSynset(typeId).name,
						type: "meaning",
						kind: ["part-of-speech"],
						v: formOfDescription(typeId, raw, word, result.test),
						exam: {
							type: "examSentence",
							value: []
						}
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
	const tmp = "(-~-) {-*-} (?)";
	var res = raw.map(e => {
		return tmp.replace("*", e.v).replace("?", posSynmap(e.d).name);
	});

	// console.log("typeId", raw, test, posSynmap(e.d).name);
	// console.log("typeId", raw, test, posSynset(type).name);

	if (test) {
		// let row = "(-~-) {->-} (?)"
		let row = tmp.replace("*", word).replace("?", posSynset(type).name);
		// if (type == 0) {
		// 	// NOTE: noun
		// 	// (-~-) {-kings-} (plural) forms of {-king-}
		// } else if (type == 1) {
		// 	// NOTE: verb
		// 	// (-~-) {-kings-} (3rd person); (-~-) {-kinged-} (past tense); (-~-) {-kinging-} (present participle) derived forms of {-king-}
		// } else if (type == 2) {
		// 	// NOTE: adjective
		// 	// (-~-) {-happier-} (comparative); (-~-) {-happiest-} (superlative) forms of {-happy-}
		// }

		res.unshift(row);
	}
	return res.join("; ");
}

/**
 * org: partOfSpeech_pos
 * param {string} keyword
 */
export async function pos() {
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
 */
export async function base() {
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
