// import { env, clue, seed } from "../anchor/index.js";
import { env, seed, makeup } from "../anchor/index.js";
import { settings } from "./base.js";

/**
 * Threat as regular word
 * @param {env.TypeOfSearchResult} raw
 * @returns {Promise<boolean>}
 */
export async function asDefinition(raw) {
	let word = raw.meta.q;
	const res = await asMeaning(word);
	// if (res.id == 1) {
	// 	// EXAM: us britian, britain
	// 	raw.title = settings.meta.auto.title.replace(/\*/g, word);
	// 	raw.description = settings.meta.auto.description.replace(/\*/g, word);
	// 	raw.keywords = settings.meta.auto.keywords.replace(/\*/g, word);
	// } else if (res.id == 2) {
	// 	raw.title = settings.meta.derive.title.replace(/\*/g, word);
	// 	raw.description = settings.meta.derive.description.replace(/\*/g, word);
	// 	raw.keywords = settings.meta.derive.keywords.replace(/\*/g, word);
	// }

	seed.wordCategory(raw.data, res.row);

	return res.status;
}

/**
 * Threat as sentence
 *
 * [goat me]1
 * goat me:1
 * goat:1
 * goat~1
 * @param {env.TypeOfSearchResult} raw
 * @returns {Promise<boolean>}
 */
export async function asSentence(raw) {
	return false;
}

/**
 * @param {string} word
 * @returns {Promise<env.TypeOfMeaning>}
 */
async function asMeaning(word) {
	const cache = settings.cacheController(word, "my");

	const res = cache.res;

	await cache.read();

	// const cacheData = cache.raw;

	let med = new seed.defMyanmar();
	await med.read();
	let rawMed = med.raw;
	let rawAll = rawMed.filter(o => o.word == word);

	for (let index = 0; index < rawAll.length; index++) {
		let rawEach = rawAll[index];
		let rawSenseTotal = rawEach.sense.length;
		// let rawRel = rawEach.rel.map(e =>
		// 	rawMed.filter(function(o) {
		// 		return o.id == e;
		// 	})
		// );
		// let rawRel = rawEach.rel.map(function(id) {
		// 	return rawMed.find(o => o.id == id);
		// });
		// let rawRel = rawEach.rel.map(function(id) {
		// 	return rawMed.filter(e => e.id == id);
		// });

		/**
		 * @type {{pos:string, thes:string[]}[]}
		 */
		let rawRel = [];
		for (let index = 0; index < rawEach.rel.length; index++) {
			const id = rawEach.rel[index];

			// let rawPos = rawMed.find(o => o.id == id);
			let rawPos = rawMed[id];
			if (rawPos) {
				// let abc = rawPos.sense.map(e => e.pos);
				let posCat = [...new Set(rawPos.sense.map(e => e.pos))];

				for (const pos of posCat) {
					let posIndex = rawRel.findIndex(e => e.pos == pos);
					if (posIndex >= 0) {
						rawRel[posIndex].thes = rawRel[posIndex].thes.concat(rawPos.word);
					} else {
						rawRel.push({
							thes: [rawPos.word],
							pos: pos
						});
					}
				}
			}
		}

		/**
		 * @type {Object.<string,string[]>}
		 */
		let previousUsage = {};
		for (let index = 0; index < rawSenseTotal; index++) {
			const rawSense = rawEach.sense[index];
			let pos = rawSense.pos;
			var posName = "";
			let posCheck = env.synset.find(
				e => e.shortname == pos || e.thesaurus.includes(pos)
			);
			if (posCheck) {
				posName = posCheck.name;
			}
			let def = rawSense.def.join("\n").replace(/^postpositional marker/, "");
			// let thes = rawRel.find(e=>e.pos == pos);
			// thes?.thes||[]

			let currentUsage = rawRel.find(e => e.pos == pos)?.thes || [];

			/**
			 * @type {env.BlockOfMeaning}
			 */
			let rowSense = {
				pos: posName,
				term: rawEach.word,
				// v: makeup.sense(def),
				// mean: [],
				// mean: block.defOfBlock(def),
				v: makeup.defBlock(def, rawEach.word),
				type: "meaning",
				kind: ["json", "med"]
				// exam: {
				// 	type: "examSentence",
				// 	// value: rawSense.exam || []
				// 	value: rawSense.exam ? makeup.exam(rawSense.exam.join(";")) : []
				// },
				// usage: {
				// 	type: "usageWord",
				// 	value: rawRel.find(e => e.pos == pos)?.thes || []
				// }
			};

			if (rawSense.exam) {
				rowSense.usage = {
					type: "examSentence",
					value: makeup.exam(rawSense.exam.join(";"))
				};
			}
			if (currentUsage.length) {
				if (previousUsage.hasOwnProperty(pos)) {
					let b = previousUsage[pos];
					var tst = currentUsage
						.filter(x => !b.includes(x))
						.concat(b.filter(x => !currentUsage.includes(x)));
					if (tst.length) {
						previousUsage[pos].push(...tst);
					}
				} else {
					tst = currentUsage;
					previousUsage[pos] = currentUsage;
				}

				if (tst.length) {
					rowSense.usage = {
						type: "usageWord",
						value: tst
					};
				}
			}

			res.row.push(rowSense);
		}
	}

	let notation = seed.wordNumber(word);
	if (notation) {
		res.row.push(notation);
	}
	res.status = res.row.length > 0;
	return res;
}
