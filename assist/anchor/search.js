import { check, fire, parse } from "lethil";
import pluralize from "pluralize";
// import { evaluate } from "mathjs";

import { primary } from "./language.js";
import * as grammar from "./grammar.js";
import * as save from "./save.js";
import * as clue from "./clue.js";
import { Cache } from "./glossary.js";

/**
 * 1. check unordinary - myanmar, number, symbol
 * 2. check definition exists
 * 3. check if sentence - hello world
 * 4. suggest - wordbreak, thesaurus, synonyms or related
 */

/**
 * @typedef {Object} TypeOfSetting
 * @property {{src:string, tar:string}} lang
 * @property {string[]} type
 * @property {any} showcase
 * @property {Object} result
 * @property {Object} result.meta
 * @property {string} result.meta.searchQuery
 * @property {string} result.meta.q
 * @property {string} result.meta.type
 * @property {string} result.meta.name
 * @property {{name:string, list?:string[]}[]} result.meta.msg
 * @property {{name:string, list?:string[]}[]} result.meta.todo
 * @property {{name:string, list?:string[]}[]} result.meta.sug
 * @property {{src:string, tar:string}} result.lang
 * @property {string} result.title - page title
 * @property {string} result.description - page description
 * @property {string} result.keywords - page keywords
 * @property {string} result.revised - page last modified date
 * @property {string} result.pageClass - page classname
 * @property {any} result.data
 * @property {Cache} cache
 */

/**
 * @type {TypeOfSetting} settings
 */
const settings = {
	lang: {
		tar: "en",
		get src() {
			return primary.id;
		}
	},
	type: ["notfound", "pleaseenter", "result", "definition", "translation"],
	showcase: {
		definition: {
			title: '"*" definition and meaning in Myanmar',
			description: "The definition of * in Myanmar, Burmese.",
			keywords: "*, definition | meaning, myanmar, burma, MyOrdbok"
		}
	},

	result: {
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
		pageClass: "definition",
		data: []
	},
	get cache() {
		return new Cache("definition", this.result.meta.q, this.result.lang.tar);
	}
};

/**
 * set page
 * @param {number} id
 * @example
 * setPageProperty(0) -> notfound
 * setPageProperty(1) -> pleaseenter
 * setPageProperty(2) -> result
 * setPageProperty(3) -> definition
 * setPageProperty(4) -> translation
 */
function setPageProperty(id) {
	if (settings.result.meta.type == settings.type[0]) {
		if (settings.type[id]) {
			settings.result.meta.type = settings.type[id];
			if (id > 2) {
				// NOTE: Used in pug
				settings.result.meta.type = settings.type[2];
				settings.result.meta.name = settings.type[id];
				settings.cache.write(settings.result);
			}
		}
	}
}

/**
 * has_meaning, is_plural, is_number
 * NOTFOUND: humanlike
 * @param {any} raw - settings.result.data
 * @param {string} wordNormal - unfading, netlike
    EXAM: NO -> adelsstand
 * @example ..({},'test')
 */
async function hasDefinition(raw, wordNormal) {
	var status = await getDefinition(raw, wordNormal);
	settings.result.meta.msg.push({ name: "lookup", list: [wordNormal] });
	if (status) {
		// EXAM: NO -> adelsstand
		settings.result.meta.msg.push({ name: "okey" });
	} else if (/[a-zA-Z]+|[0-9]+(?:\.[0-9]+|)/.test(wordNormal)) {
		// EXAM: NO -> Administratortilgang
		// EXAM: wind[2] good!
		// EXAM: 1900th 10times
		// superscripts 1st, 2nd, 3rd, 4th ??
		// var words = wordNormal
		// 	.match(/[a-zA-Z]+|[0-9]+(?:\.[0-9]+|)/g)
		// 	.filter(e => e && e != wordNormal);
		var words = wordNormal.match(/[a-zA-Z]+|[0-9]+(?:\.[0-9]+|)/g);

		if (words && words.length) {
			settings.result.meta.msg.push({ name: "split", list: words });
			for (const word of words) {
				if (await getDefinition(raw, word)) {
					status = true;
					settings.result.meta.msg.push({ name: "partially", list: [word] });
				} else {
					save.keyword(word, settings.result.lang.tar);
					settings.result.meta.msg.push({ name: "save 1 ?" });
					var rowThesaurus = clue.wordThesaurus(word);
					if (rowThesaurus) {
						settings.result.meta.sug.push({
							name: word,
							list: rowThesaurus.v
						});
						settings.result.meta.msg.push({
							name: "* to suggestion".replace("*", word)
						});
					}
				}
			}
		} else {
			// NOTE: single word
			// skillfulness, utile
			// decennary decennium
			// EXAM: adeptness adroitness deftness "facility quickness skillfulness"
			settings.result.meta.msg.push({ name: "save 2 ?" });
			save.keyword(wordNormal, settings.result.lang.tar);
			var rowThesaurus = clue.wordThesaurus(wordNormal);
			if (rowThesaurus) {
				settings.result.meta.sug.push({
					name: wordNormal,
					list: rowThesaurus.v
				});
				settings.result.meta.msg.push({
					name: "0 to suggestion".replace("0", wordNormal)
				});
			}
		}
	} else {
		// NOTE: å ø æ
		settings.result.meta.msg.push({ name: "is this a word?" });
	}
	return status;
}

/**
 * @param {any} raw
 * @param {string} wordNormal - angle, companies
 */
async function getDefinition(raw, wordNormal) {
	var wordBase = {};
	var wordPos = await grammar.main(wordNormal);
	let form = wordPos.form;
	var status = await rowDefinition(raw, wordNormal, form);
	if (!status) {
		if (wordPos.root.length) {
			for (const row of wordPos.root) {
				form = wordPos.kind.filter(e => e.term == row.v);
				if (await rowDefinition(raw, row.v, form)) {
					status = true;
				} else if (form.length) {
					clue.wordCategory(raw, form);
				}
			}
		}
	}
	if (!status) {
		// EXAM: US
		// EXAM: lovings -> loving
		// EXAM: winds -> wound winding
		// EXAM: britains -> britain, lovings -> loving
		var wordSingular = pluralize.singular(wordNormal);
		if (pluralize.isPlural(wordNormal) && wordSingular != wordNormal) {
			settings.result.meta.msg.push({
				name: "pluralize",
				list: [wordSingular]
			});
			wordBase = await grammar.main(wordSingular, true);
			status = await rowDefinition(raw, wordSingular, wordBase.form);
			if (status == false) {
				// EXAM: lovings->loving->love
				for (const row of wordBase.root) {
					form = wordBase.kind.filter(e => e.term == row.v);
					if (await rowDefinition(raw, row.v, form)) {
						status = true;
					}
				}
			}
		}
	}
	// if (status == false) {
	//   settings.result.meta.msg.push({name'save?'});
	//   for (const row of wordPos.root) {
	//     var abc = wordbreak(row.v);
	//     console.log('save?',row.v,abc)
	//   }
	//   settings.result.meta.msg.push({name'root',list:wordPos.root});
	//   // console.log('save?',wordPos,wordBase)
	// }
	return status;
}

/**
 * @param {any[]} raw
 * @param {string} word
 * @param {any[]} other
 */
async function rowDefinition(raw, word, other = []) {
	var status = false;
	// NOTE: force from MySQL
	var rowMeaning = await clue.definition(word, true);
	// NOTE: force from JSON
	// var rowMeaning = await clue.definition(word);
	if (rowMeaning.length) {
		// EXAM: us britian
		var rowTerm = rowMeaning
			.map(e => e.term)
			.filter((v, i, a) => a.indexOf(v) === i);
		var sensitiveThesaurus = rowTerm.length > 1;
		rowTerm.forEach(term => {
			var rowThesaurus = clue.wordThesaurus(term, sensitiveThesaurus);
			if (rowThesaurus) rowMeaning.push(rowThesaurus);
		});

		// rowMeaning = rowMeaning.concat(other);
		rowMeaning.push(...other);
		// clue.wordCategory(raw,rowMeaning.concat(other));
		status = true;
	}
	if (check.isNumber(word)) {
		// EXAM: 10 50
		var rowNumber = clue.wordNumber(word);
		if (rowNumber) {
			// settings.result.meta.todo.push('notation');
			settings.result.meta.msg.push({ name: "notation", list: [word] });
			rowMeaning.push(rowNumber);
			if (!rowMeaning.find(e => e.pos == "thesaurus")) {
				var rowThesaurus = clue.wordThesaurus(word);
				if (rowThesaurus) rowMeaning.push(rowThesaurus);
			}
			status = true;
		}
	}
	// if (status == false) {
	//   var rowThesaurus = clue.wordThesaurus(word);
	//   if (rowThesaurus) rowMeaning.push(rowThesaurus);
	// }

	clue.wordCategory(raw, rowMeaning);

	return status;
}

/**
 * unwarrantable
 * @typedef {Object.<string, any>} options
 * @param {options} req
 */
export default async function search(req) {
	const keyword = check.isValid(req.query.q);
	if (keyword) {
		// NOTE: since its already built!
		// TODO: if the language change, settings.result.lang.tar = options.cookies.solId;
		if (keyword == settings.result.meta.q) {
			return settings.result;
		}
	}

	Object.assign(settings.result, {
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
		data: []
	});

	if (req.cookies.solId) {
		settings.result.lang.tar = req.cookies.solId;
	} else {
		// curl http://localhost:8082/definition?q=love
		// NOTE: possibly attacks
	}

	// NOTE: test purpose ?language=[no,en,ja]
	if (req.query.language) {
		settings.result.lang.tar = req.query.language;
	}

	const cacheResult = await settings.cache.read();
	if (cacheResult && Object.keys(cacheResult).length) {
		console.log("from cache", settings.result.meta.q);
		return cacheResult;
	}

	if (keyword) {
		// NOTE: to Myanmar
		if (settings.result.lang.tar == settings.result.lang.src) {
			// NOTE: definition
			if (await hasDefinition(settings.result.data, keyword)) {
				// settings.result.title = `${settings.result.meta.q} definition in Myanmar`;
				// settings.result.description = `the definition of ${
				// 	settings.result.meta.q
				// } in Myanmar`;
				// settings.result.keywords = `${
				// 	settings.result.meta.q
				// }, definition and meaning, myanmar, burma, MyOrdbok`;
				settings.result.title = settings.showcase.definition.title.replace(
					/\*/g,
					settings.result.meta.q
				);
				settings.result.description = settings.showcase.definition.description.replace(
					/\*/g,
					settings.result.meta.q
				);
				settings.result.keywords = settings.showcase.definition.keywords.replace(
					/\*/g,
					settings.result.meta.q
				);

				setPageProperty(3);
			}
		} else {
			// NOTE: translation,
			var t1 = await clue.translation(keyword, settings.result.lang.tar);
			if (t1.length) {
				settings.result.title = "found translation";
				for (const row of t1) {
					var raw = {
						word: row.v,
						clue: []
					};
					for (const word of row.e) {
						if (await hasDefinition(raw.clue, word)) {
							setPageProperty(4);
						}
					}
					settings.result.data.push(raw);
				}
			} else {
				// NOTE: is_sentence?
				var wordlist = parse.explode(keyword);
				if (wordlist.length > 1) {
					// Note: sentence
					for (const word of fire.array.unique(wordlist)) {
						var t2 = await clue.translation(word, settings.result.lang.tar);
						console.log("word", word);
						if (t2.length) {
							for (const row of t2) {
								var raw = {
									word: row.v,
									clue: []
								};
								for (const word of row.e) {
									if (await hasDefinition(raw.clue, word)) {
										setPageProperty(4);
									}
								}
								settings.result.data.push(raw);
							}
						} else if (await hasDefinition(settings.result.data, word)) {
							setPageProperty(4);
						}
					}
				} else if (await hasDefinition(settings.result.data, keyword)) {
					// NOTE: definition from src
					setPageProperty(3);
				}
			}
		}
	} else {
		// NOTE: pleaseenter
		setPageProperty(1);
	}

	return settings.result;
}
