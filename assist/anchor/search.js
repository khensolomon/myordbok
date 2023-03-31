import { check, fire } from "lethil";
// import pluralize from "pluralize";
// import { evaluate } from "mathjs";

import * as env from "./env.js";
import { primary } from "./language.js";
import * as grammar from "./grammar.js";
// import * as save from "./save.js";
import * as clue from "./clue.js";
import { Cache } from "./glossary.js";

/**
 * 1. check unordinary - myanmar, number, symbol
 * 2. check definition exists
 * 3. check if sentence - hello world
 * 4. suggest - wordbreak, thesaurus, synonyms or related
 */

/**
 *
 * @typedef {{word:string, lang:string}} TypeOfCacheController
 *
 * @typedef {Object} SearchSettings - SearchOfSetting SettingOfSearch
 * @property {env.TypeOfSearchLanguage} lang
 * @property {string[]} type
 * @property {any} meta
 * @property {env.TypeOfSearchResult} result
 *
 *
 * @property {(word:string, lang:string)=>Cache} cacheController
 */

/**
 * @type {SearchSettings} settings
 */
const settings = {
	lang: {
		tar: "en",
		get src() {
			return primary.id;
		}
	},
	type: ["notfound", "pleaseenter", "result", "definition", "translation"],
	meta: {
		auto: {
			title: env.meta.title,
			description: env.meta.description,
			keywords: env.meta.keywords
		},
		derive: {
			title: "derived " + env.meta.title,
			description: "derived " + env.meta.description,
			keywords: "derived " + env.meta.keywords
		}
	},

	result: env.result,
	cacheController(word, lang) {
		return new Cache("definition", word, lang);
	}

	// get cache() {
	// 	return new Cache("definition", this.result.meta.q, this.result.lang.tar);
	// }
	// get cache() {
	// 	return new Cache("definition", this.result.meta.q, this.result.lang.tar);
	// }
};

/**
 * set page
 * @param {env.TypeOfSearchResult} raw
 * @param {number} id
 * @example
 * setPageProperty(0) -> notfound
 * setPageProperty(1) -> pleaseenter
 * setPageProperty(2) -> result
 * setPageProperty(3) -> definition
 * setPageProperty(4) -> translation
 */
function setPageProperty(raw, id) {
	if (raw.meta.type == settings.type[0]) {
		if (settings.type[id]) {
			raw.meta.type = settings.type[id];
			if (id > 2) {
				// NOTE: Used in pug
				raw.meta.type = settings.type[2];
				raw.meta.name = settings.type[id];
			}
		}
	}
}

/**
 * unwarrantable
 * @typedef {Object.<string, any>} options
 * @param {options} req
 */
export default async function search(req) {
	const keyword = check.isValid(req.query.q || "");

	const raw = Object.assign({}, settings.result, {
		meta: {
			q: keyword,
			type: settings.type[0],
			name: "",
			msg: [],
			todo: [],
			sug: []
		},
		lang: {
			tar: settings.lang.tar,
			src: settings.lang.src
		},
		revised: new Date().toLocaleDateString("en-GB", {
			weekday: "long",
			day: "2-digit",
			month: "long",
			year: "numeric"
		}),
		revised_version: "",
		data: []
	});

	if (req.cookies.solId) {
		raw.lang.tar = req.cookies.solId;
	} else {
		// curl http://localhost:8082/definition?q=love
		// NOTE: possibly attacks
	}

	// NOTE: testing purpose ?language=[no,en,ja]
	if (req.query.language) {
		raw.lang.tar = req.query.language;
	}

	raw.query = clue.query(keyword);

	if (keyword) {
		if (raw.lang.tar == raw.lang.src) {
			// NOTE: to Myanmar
			if (await asDefinition(raw)) {
				raw.query.status = false;
				setPageProperty(raw, 3);
			} else {
				// NOTE: is_sentence?
				if (await asSentence(raw)) {
					setPageProperty(raw, 4);
				}
			}
		} else {
			// NOTE: Translation,
		}
	} else {
		// NOTE: pleaseenter
		setPageProperty(raw, 1);
	}

	// if (keyword) {
	// 	// NOTE: to Myanmar
	// 	if (result.lang.tar == result.lang.src) {
	// 		// NOTE: definition
	// 		// await hasDefinition(result.data, keyword) -> old version
	// 		if (await asDefinition(result)) {
	// 			setPageProperty(3);
	// 		}
	// 	} else {
	// 		// NOTE: translation,
	// 		var t1 = await clue.translation(keyword, result.lang.tar);
	// 		if (t1.length) {
	// 			result.title = "found translation";
	// 			for (const row of t1) {
	// 				var raw = {
	// 					word: row.v,
	// 					clue: []
	// 				};
	// 				for (const word of row.e) {
	// 					if (await hasDefinition(raw.clue, word)) {
	// 						setPageProperty(4);
	// 					}
	// 				}
	// 				result.data.push(raw);
	// 			}
	// 		} else {
	// 			// NOTE: is_sentence?
	// 			var wordlist = parse.explode(keyword);
	// 			if (wordlist.length > 1) {
	// 				// Note: sentence
	// 				for (const word of fire.array.unique(wordlist)) {
	// 					var t2 = await clue.translation(word, result.lang.tar);
	// 					console.log("word", word);
	// 					if (t2.length) {
	// 						for (const row of t2) {
	// 							var raw = {
	// 								word: row.v,
	// 								clue: []
	// 							};
	// 							for (const word of row.e) {
	// 								if (await hasDefinition(raw.clue, word)) {
	// 									setPageProperty(4);
	// 								}
	// 							}
	// 							result.data.push(raw);
	// 						}
	// 					} else if (await hasDefinition(result.data, word)) {
	// 						setPageProperty(4);
	// 					}
	// 				}
	// 			} else if (await hasDefinition(result.data, keyword)) {
	// 				// NOTE: definition from src
	// 				setPageProperty(3);
	// 			}
	// 		}
	// 	}
	// } else {
	// 	// NOTE: pleaseenter
	// 	setPageProperty(1);
	// }

	return raw;
}

/**
 * @param {string} word
 * @returns {Promise<env.TypeOfMeaning>}
 */
async function asMeaning(word) {
	/**
	 * @type {env.TypeOfMeaning}
	 */
	const res = {
		status: false,
		dated: 0,
		id: 0,
		version: "",
		msg: [],
		row: []
	};

	const cache_controller = settings.cacheController(word, "en");

	const info = await cache_controller.info();
	const caches = await cache_controller.read(res);
	// check.isObject(caches)
	// caches.dated > 0;
	// caches.version == cache_controller.version;
	if (caches.dated > 0) {
		if (caches.dated >= info.dated) {
			return caches;
		}
	}

	res.version = cache_controller.version;
	res.dated = Date.now();

	var row = await clue.definition(word);
	var pos = await grammar.main(word);

	const hasPos = pos.form.length > 0;

	/**
	 * [love] (noun, verb)
	 * [?] (adjective)
	 * [gone] (verb)
	 */
	if (row.length) {
		// EXAM: us britian, britain
		res.status = true;
		res.id = 1;
		if (hasPos) {
			row.push(...pos.form);
		}
	}

	/**
	 * [21] (number)
	 */
	const notation = clue.wordNumber(word);
	if (notation) {
		row.push(notation);
	}

	/**
	 * [loves kings] (plural)
	 * [happier] (adjective)
	 * [went] (verb)
	 */
	if (res.status == false && hasPos) {
		// NOTE: kings
		const words = fire.array.unique(pos.root.map(e => e.v), true);
		for (let index = 0; index < words.length; index++) {
			const elm = words[index];

			const a1 = await clue.definition(elm);
			row.push(...a1);
			if (!notation) {
				const a2 = clue.wordNumber(elm);
				if (a2) {
					row.push(a2);
				}
			}
		}
		row.push(...pos.form);
		res.id = 2;
		res.status = true;
	}

	if (row.length) {
		const thesaurus = clue.wordThesaurus(word);
		if (thesaurus.length) {
			row.push(...thesaurus);
		}
		res.row = row;
		cache_controller.write(res);
	}

	return res;
}

/**
 * requested as direct definition - assume `en > my`, and
 * must be checked `settings.result.lang.tar == settings.result.lang.src`
 * before calling this method
 * @param {env.TypeOfSearchResult} raw
 * @returns {Promise<boolean>}
 */
async function asDefinition(raw) {
	let word = raw.meta.q;
	const res = await asMeaning(word);
	if (res.id == 1) {
		// EXAM: us britian, britain
		raw.title = settings.meta.auto.title.replace(/\*/g, word);
		raw.description = settings.meta.auto.description.replace(/\*/g, word);
		raw.keywords = settings.meta.auto.keywords.replace(/\*/g, word);
	} else if (res.id == 2) {
		raw.title = settings.meta.derive.title.replace(/\*/g, word);
		raw.description = settings.meta.derive.description.replace(/\*/g, word);
		raw.keywords = settings.meta.derive.keywords.replace(/\*/g, word);
	}
	clue.wordCategory(raw.data, res.row);

	return res.status;
}

/**
 * request as direct translation - assume (no,ja etc) en - my
 * @returns {Promise<boolean>}
 */
// async function asTranslation() {
// 	return false;
// }

/**
 * [goat me]1
 * goat me:1
 * goat:1
 * goat~1
 * @param {env.TypeOfSearchResult} raw
 * @returns {Promise<boolean>}
 */
async function asSentence(raw) {
	if (raw.query.sentence.length > 1) {
		// Note: sentence

		// const row = {
		// 	word: raw.meta.q,
		// 	/**
		// 	 * @type {env.RowOfMeaning[]}
		// 	 */
		// 	clue: []
		// };

		// const words = fire.array.unique(wordlist, true);
		// for (let index = 0; index < words.length; index++) {
		// 	const word = words[index];
		// 	console.log("word", word);
		// 	const res = await asMeaning(word);
		// 	if (res.status) {
		// 		// clue.wordCategory(raw.data, res.row);
		// 		// clue.wordCategory(row.clue, res.row);
		// 		// rowClue.push(...res.row);
		// 		for (let i = 0; i < res.row.length; i++) {
		// 			const elm = res.row[i];
		// 			rowClue.push(elm);
		// 		}
		// 	}
		// }
		// raw.meta.row = row;
		const res = await asMeaning(raw.query.word);
		if (res.status) {
			// const data = {
			// 	word: raw.query.word,
			// 	clue: []
			// };
			// raw.data = [row];
			// clue.wordCategory(data.clue, res.row);
			// raw.data.push(data);
			clue.wordCategory(raw.data, res.row);
		}
	}
	return raw.data.length > 0;
}
