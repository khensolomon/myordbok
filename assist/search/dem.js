import { fire } from "lethil";
import { env, seed, grammar } from "../anchor/index.js";
import { settings } from "./base.js";

/**
 * requested as direct definition - assume `en > my`, and
 * must be checked `settings.result.lang.tar == settings.result.lang.src`
 * before calling this method
 * @param {env.TypeOfSearchResult} raw
 * @returns {Promise<boolean>}
 */
export async function asDefinition(raw) {
	let searchWord = raw.query.input;
	const res = await asMeaning(searchWord);
	if (res.id == 0) {
		raw.title = "Help us with * definition".replace(/\*/g, searchWord);
		raw.description = "No definition for * at this moment".replace(
			/\*/g,
			searchWord
		);
		raw.keywords = searchWord;

		let suggestion = await seed.wordSuggestion(searchWord);
		if (suggestion.length) {
			raw.keywords = suggestion.join(",");
			raw.meta.sug.push({
				name: "suggestion", //similarity
				list: suggestion
			});
		}
	} else {
		let word = res.word.join(", ");

		raw.meta.identity = res.id;

		if (res.id == 1) {
			// EXAM: us britian, britain
			raw.title = settings.meta.auto.title.replace(/\*/g, word);
			raw.description = settings.meta.auto.description.replace(/\*/g, word);
			raw.keywords = settings.meta.auto.keywords.replace(/\*/g, word);
		} else if (res.id == 2) {
			// NOTE: loved, kings
			raw.title = settings.meta.derive.title.replace(/\*/g, word);
			raw.description = settings.meta.derive.description.replace(/\*/g, word);
			raw.keywords = settings.meta.derive.keywords.replace(/\*/g, word);
		}
	}
	raw.query.result = res.word;
	raw.meta.sug = res.sug;
	seed.wordCategory(raw.data, res.row);

	return res.status;
}

/**
 * [goat me]1
 * goat me:1
 * goat:1
 * goat~1
 * @param {env.TypeOfSearchResult} raw
 * @returns {Promise<boolean>}
 */
export async function asSentence(raw) {
	if (raw.query.sentence.length > 1) {
		let res = await asMeaning(raw.query.word);
		if (res.status) {
			seed.wordCategory(raw.data, res.row);
		}
		raw.meta.identity = res.id;
	}
	return raw.data.length > 0;
}

/**
 * @param {string} word
 * @returns {Promise<env.TypeOfMeaning>}
 */
async function asMeaning(word) {
	const cache = settings.cacheController(word, "en");

	const res = cache.res;

	await cache.read();

	const cacheData = cache.raw;

	if (cache.raw.dated > 0) {
		if (cache.expired) {
			return cacheData;
		}

		let row = await seed.fromMYSQLLastChange(word);
		if (row.length) {
			cache.latestUpdate = row[0].dated;
			if (cache.updateAvailable == false) {
				if (cache.shouldExtend) {
					cacheData.dated = cache.now;
					cache.write(cacheData);
				}
				return cacheData;
			}
		}
	}

	res.word = [];
	res.version = cache.version;
	res.dated = cache.now;
	const defMain = await seed.definition(word);

	/**
	 * @type {grammar.TypeOfPartOfSpeech|null}
	 */
	var pos = null;
	var hasPos = false;

	/**
	 * [love] (noun, verb)
	 * [?] (adjective)
	 * [gone] (verb)
	 */
	if (defMain.row.length) {
		// EXAM: us britian, britain
		res.status = true;
		res.id = 1;
		res.word = defMain.ord;
		word = res.word[0];

		pos = await grammar.main(word);
		hasPos = pos.form.length > 0;
		if (hasPos) {
			/**
			 * love loved loving
			 */
			defMain.row.push(...pos.form);
			// res.sug.push(...defMain.sug);
		}
	}

	/**
	 * [21] (number)
	 */
	const notation = seed.wordNumber(word);
	if (notation) {
		defMain.row.push(notation);
	}

	/**
	 * [loves kings] (plural)
	 * [happier] (adjective)
	 * [went] (verb)
	 */
	if (res.status == false) {
		pos = await grammar.main(word);
		hasPos = pos.form.length > 0;
		if (hasPos) {
			// NOTE: kings
			const words = fire.array.unique(pos.root.map(e => e.v), true);

			for (let index = 0; index < words.length; index++) {
				const elm = words[index];

				const defDerived = await seed.definition(elm);

				defMain.row.push(...defDerived.row);
				// res.sug.push(...defDerived.sug);
				if (!notation) {
					const a2 = seed.wordNumber(elm);
					if (a2) {
						defMain.row.push(a2);
					}
				}
			}
			if (defMain.row.length) {
				res.id = 2;
			} else {
				res.id = 3;
			}
			defMain.row.push(...pos.form);

			// res.word = [];

			res.status = true;
		}
	}

	/**
	 * [god's, king's] (spelling)
	 * Did you mean?
	 * Or you might interested in
	 */
	if (res.status == false) {
		const spelling = await seed.wordSpelling(word);
		if (spelling.length) {
			word = spelling[0];
			const defSpelling = await seed.definition(word);
			if (defSpelling.row.length) {
				// EXAM: us britian, britain
				res.status = true;
				res.id = 1;
				res.word = defSpelling.ord;
				word = res.word[0];

				defMain.row.push(...defSpelling.row);

				pos = await grammar.main(word);
				hasPos = pos.form.length > 0;
				if (hasPos) {
					defMain.row.push(...pos.form);
					// res.sug.push(...defMain.sug);
				}
				if (spelling.length > 1) {
					res.sug.push({
						name: "spelling",
						list: spelling.filter(e => e != word)
					});
				}
			}
		}
	}

	if (defMain.row.length) {
		let antonym = await seed.wordAntonym(word);
		if (antonym) {
			defMain.row.push(...antonym);
		}
	}

	if (defMain.row.length) {
		res.word = wordUnique(defMain.row);
		// let termThesaurus = word;
		// const thesaurus = seed.wordThesaurus(word);
		let termThesaurus = res.word[0];
		const thesaurus = seed.wordThesaurus(termThesaurus);
		if (thesaurus.length) {
			defMain.row.push(...thesaurus);
		}
		defMain.row.push(
			...[
				{
					// term: word,
					term: termThesaurus,
					type: "help", //meaning
					// pos: thesaurus.posName(e.pos),
					pos: "improve",
					kind: ["odd"],
					v: "what is this",
					// exam: ["a","b"],
					exam: {
						type: "examWord",
						value: ["a", "b"]
					}
					// examCast: "exam_thesaurus"
				}
			]
		);
		res.row = defMain.row;
		cache.write(res);
	}

	return res;
}

/**
 * Create resultWord list unique
 * @param {env.BlockOfMeaning[]} raw
 * @returns {string[]}
 */
function wordUnique(raw) {
	if (raw && raw.length) {
		// var resultWord = raw.map(e => e.term.toLowerCase());
		var resultWord = raw.map(e => e.term);
		return [...new Set(resultWord)];
	}
	return [];
}
