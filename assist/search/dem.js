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
	let word = raw.meta.q;
	const res = await asMeaning(word);
	if (res.id == 0) {
		raw.title = "Help us with * definition".replace(/\*/g, word);
		raw.description = "No definition for * at this moment".replace(/\*/g, word);
		raw.keywords = word;

		let suggestion = await seed.wordSuggestion(word);
		if (suggestion.length) {
			raw.keywords = suggestion.join(",");
			raw.meta.sug.push({
				name: "suggestion", //similarity
				list: suggestion
			});
		}
	} else if (res.id == 1) {
		// EXAM: us britian, britain
		raw.title = settings.meta.auto.title.replace(/\*/g, word);
		raw.description = settings.meta.auto.description.replace(/\*/g, word);
		raw.keywords = settings.meta.auto.keywords.replace(/\*/g, word);
	} else if (res.id == 2) {
		raw.title = settings.meta.derive.title.replace(/\*/g, word);
		raw.description = settings.meta.derive.description.replace(/\*/g, word);
		raw.keywords = settings.meta.derive.keywords.replace(/\*/g, word);
	}
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
	res.version = cache.version;
	res.dated = cache.now;
	var row = await seed.definition(word);

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
	const notation = seed.wordNumber(word);
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

			const a1 = await seed.definition(elm);
			row.push(...a1);
			if (!notation) {
				const a2 = seed.wordNumber(elm);
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
		const thesaurus = seed.wordThesaurus(word);
		if (thesaurus.length) {
			row.push(...thesaurus);
		}
		row.push(
			...[
				{
					term: word,
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
		res.row = row;
		cache.write(res);
	}

	return res;
}
