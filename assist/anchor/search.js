import { check, fire, parse } from "lethil";
import pluralize from "pluralize";
// import { evaluate } from "mathjs";

import { primary } from "./language.js";
import * as grammar from "./grammar.js";
import * as save from "./save.js";
import * as clue from "./clue.js";

/**
 * @typedef {Object.<string, any>}} settings
 * @property {Object.<string, any>} result
 * @property {Object.<string, any>} result.meta
 * @property {Object.<string, any>} result.meta.msg
 * @property {Object.<string, any>} result.sug
 * @property {Object.<string, any>[]} result.data
 * property {object} result
 * property {Object.<string, any>} result.msg
 * @type {settings} settings
 */
const settings = {
	lang: {
		tar: "en",
		// src: primary.id
		get src() {
			// @ts-ignore
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
		pageClass: "definition",
		data: []
	}
};

/**
 * set page
 * @param {number} id
 */
function setPageProperty(id) {
	if (settings.result.meta.type == settings.type[0]) {
		if (settings.type[id]) {
			settings.result.meta.type = settings.type[id];
			if (id > 2) {
				// NOTE: Used in pug
				settings.result.meta.type = settings.type[2];
				settings.result.meta.name = settings.type[id];
			}
		}
	}
}

/**
 * has_meaning, is_plural, is_number
 * NOTFOUND: humanlike
 * @param {any} raw
 * @param {string} wordNormal - unfading, netlike
    EXAM: NO -> adelsstand
 * @example ..({},'test')
 */
async function hasDefinition(raw, wordNormal) {
	var status = false;
	settings.result.meta.msg.push({ msg: "lookup", list: [wordNormal] });
	if (await getDefinition(raw, wordNormal)) {
		// EXAM: NO -> adelsstand
		settings.result.meta.msg.push({ msg: "okey" });
		status = true;
	} else if (/[a-zA-Z]+|[0-9]+(?:\.[0-9]+|)/.test(wordNormal)) {
		// EXAM: NO -> Administratortilgang
		// EXAM: wind[2] good!
		// EXAM: 1900th 10times
		// superscripts 1st, 2nd, 3rd, 4th ??
		var words = wordNormal
			.match(/[a-zA-Z]+|[0-9]+(?:\.[0-9]+|)/g)
			.filter(e => e && e != wordNormal);
		if (words.length) {
			settings.result.meta.msg.push({ msg: "split", list: words });
			for (const word of words) {
				if (await getDefinition(raw, word)) {
					status = true;
					settings.result.meta.msg.push({ msg: "partially", list: [word] });
				} else {
					save.keyword(word, settings.result.lang.tar);
					settings.result.meta.msg.push({ msg: "save 1 ?" });
					var rowThesaurus = clue.wordThesaurus(word);
					if (rowThesaurus) {
						settings.result.meta.sug.push({
							word: word,
							list: rowThesaurus.v
						});
						settings.result.meta.msg.push({
							msg: "0 to suggestion".replace("0", word)
						});
					}
				}
			}
		} else {
			// NOTE: single word
			// skillfulness, utile
			// decennary decennium
			// EXAM: adeptness adroitness deftness "facility quickness skillfulness"
			settings.result.meta.msg.push({ msg: "save 2 ?" });
			save.keyword(wordNormal, settings.result.lang.tar);
			var rowThesaurus = clue.wordThesaurus(wordNormal);
			if (rowThesaurus) {
				settings.result.meta.sug.push({
					word: wordNormal,
					list: rowThesaurus.v
				});
				settings.result.meta.msg.push({
					msg: "0 to suggestion".replace("0", wordNormal)
				});
			}
		}
	} else {
		// NOTE: å ø æ
		settings.result.meta.msg.push({ msg: "is this a word?" });
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
	if (status == false) {
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
	if (status == false) {
		// EXAM: US
		// EXAM: lovings -> loving
		// EXAM: winds -> wound winding
		// EXAM: britains -> britain, lovings -> loving
		var wordSingular = pluralize.singular(wordNormal);
		if (pluralize.isPlural(wordNormal) && wordSingular != wordNormal) {
			settings.result.meta.msg.push({ msg: "pluralize", list: [wordSingular] });
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
	//   settings.result.meta.msg.push({msg:'save?'});
	//   for (const row of wordPos.root) {
	//     var abc = wordbreak(row.v);
	//     console.log('save?',row.v,abc)
	//   }
	//   settings.result.meta.msg.push({msg:'root',list:wordPos.root});
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
	// var rowMeaning = await clue.definition(word, true);
	// NOTE: force from JSON
	var rowMeaning = await clue.definition(word);
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
			settings.result.meta.msg.push({ msg: "notation", list: [word] });
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
 * get has row
 * @param {any} e
 */
export default async function search(e) {
	/**
	 * @typedef options
	 * @property {Object.<string, string>} options.query
	 */
	let options = {
		/**
		 * type {Object.<string, any>
		 */
		query: {
			/**
			 * @property
			 */
			_localSearch: "",
			get q() {
				return check.isValid(this._localSearch);
			},
			/**
			 * @param {string} str
			 */
			set q(str) {
				this._localSearch = str;
			},
			language: ""
		},
		cookies: {
			solId: ""
		},
		originalUrl: ""
	};

	if (e) {
		if (check.isObject(e)) {
			// NOTE: gui
			options = e;
		} else if (check.isString(e)) {
			// NOTE: cli
			options.query.q = e;
		}
	}

	if (options.query.q) {
		// NOTE: since its already built!
		// TODO: if the language change, settings.result.lang.tar = options.cookies.solId;
		if (options.query.q == settings.result.meta.q) {
			return settings.result;
		}
	}

	settings.result = {
		meta: {
			q: options.query.q,
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
		data: []
	};

	if (options.cookies.solId) {
		settings.result.lang.tar = options.cookies.solId;
	} else {
		// NOTE: possibly attacks
	}

	// NOTE: test purpose ?language=no,en,ja
	if (options.query.language) {
		settings.result.lang.tar = options.query.language;
	}

	var keyword = settings.result.meta.q;
	// settings.result.mathjstest = evaluate("12%20/%20(2.3%20+%200.7)");
	if (check.isMyanmarText(keyword)) {
		// NOTE: from Myanmar
		settings.result.meta.unicode = true;
	} else if (keyword) {
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
