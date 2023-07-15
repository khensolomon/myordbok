import { seek } from "lethil";
// import { seed, makeup } from "../anchor/index.js";
import { env, seed, makeup } from "../anchor/index.js";
import { settings } from "./base.js";

/**
 * MED (work, format)
 * @param {any} req
 */
export default async function main(req) {
	// return backup(req);
	return formatTesting(req);
	// return definitionTesting(req);
}

/**
 * MED (work, format)
 * See: ကကြီး
 * @param {any} req
 */
export async function definitionTesting(req) {
	const word = req.query.q;
	const cache = settings.cacheController(word, "my");
	const res = cache.res;
	await cache.read();

	let med = new seed.defMyanmar();
	await med.read();
	let rawMed = med.raw;
	let rawAll = rawMed.filter(o => o.word == word);

	// for (let index = 0; index < rawAll.length; index++) {
	// 	let rawEach = rawAll[index];
	// 	let rawSenseTotal = rawEach.sense.length;
	// }
	for (let index = 0; index < rawAll.length; index++) {
		let rawEach = rawAll[index];
		let rawSenseTotal = rawEach.sense.length;
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
			let abc = env.synset.find(
				e => e.shortname == pos || e.thesaurus.includes(pos)
			);
			if (abc) {
				posName = abc.name;
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
				v: makeup.sense(def),
				type: "meaning",
				kind: ["json"]
				// exam: {
				// 	type: "examSentence",
				// 	// value: rawSense.exam || []
				// 	value: rawSense.exam ? makeup.exam(rawSense.exam.join(";")) : []
				// }
				// usage: {
				// 	type: "usageWord",
				// 	// value: rawRel.find(e => e.pos == pos)?.thes || []
				// 	value: []
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

	// res.row.push(rowSense);
	await seek.WriteJSON("./cache/tmp/-med-definitionTesting.json", res, 2);

	res.status = res.row.length > 0;
	// return res;
	return res.row.length;
}

/**
 * MED (work, format)
 * @param {any} req
 */
export async function formatTesting(req) {
	// let raw =
	// 	"drain [lg:a/b/c] [exam:ထမင်းရည်~-]; strain off; strain out [exam:သောက်ရေ~-]; filter";
	// let raw = "(of knowledge) wide; comprehensive";
	// let raw =
	// 	"deployment [exam:ဓမ္မ~]; display [exam:နယ်ရှစ်ခွင်/နတ်စစ်~ဆင်လို့]";
	let raw =
		"settle; fall; drop; descend; come down [exam:နယ်ရှစ်ခွင်/နတ်စစ်~ဆင်လို့]";
	// let raw =
	// 	"settle [exam:အနည်~-/အထိုင်~-]; fall; drop [exam:အပူချိန်~-]; descend; come down [exam:အဖျား~-]";
	let res = makeup.defBlock(raw, "abc");
	console.log(res);

	await seek.WriteJSON("./cache/tmp/-med-formatTesting.json", res, 2);
	return res.length;
}

/**
 * Backup
 * @param {any} req
 */
export async function backup(req) {
	let med = new seed.defMyanmar();
	await med.read();
	let rawMed = med.raw;

	await med.write({
		raw: rawMed,
		space: 2,
		suffix: "-replace-with-version"
	});
	return "done";
}

/**
 * modifed ref to index
 * remove id
 * @param {any} req
 */
// export async function v1_ref(req) {
// 	let med = new seed.defMyanmar();
// 	await med.read();
// 	let rawMed = med.raw;
// 	let raw_ref = [];
// 	for (let index = 0; index < rawMed.length; index++) {
// 		const element = rawMed[index];

// 		let ref = element.rel.map(e => rawMed.findIndex(i => i.id == e));
// 		element.rel = ref;
// 		let non = ref.filter(e => e < 0);
// 		if (non.length > 0) {
// 			console.log(element.id, "none", non.length);
// 		}
// 		raw_ref.push(element);
// 	}
// 	console.log("modified ref");

// 	let raw = [];
// 	for (let index = 0; index < raw_ref.length; index++) {
// 		const element = raw_ref[index];
// 		delete element.id;
// 		raw.push(element);
// 	}
// 	console.log("remove id");

// 	await med.write({
// 		raw: raw,
// 		space: 2,
// 		suffix: "-v1"
// 	});
// 	return "done";
// }

/**
 * sorted by id of (org)
 * "post":"",
 * [Same as: *] pos.
 * replace unknown chars
 * @param {any} req
 */
// export async function v0_sorting(req) {
// 	let med = new seed.defMyanmar();
// 	await med.read();
// 	let rawMed = med.raw;

// 	let raw = rawMed.sort(function(a, b) {
// 		return a.id.localeCompare(b.id);
// 	});
// 	console.log("Sorted");

// 	await med.write({
// 		raw: raw,
// 		space: 2,
// 		suffix: "-v0"
// 	});
// 	return "done";
// }

/**
 * remove single eg and add exam
 * @param {any} req
 */
export async function hack(req) {
	let med = new seed.defMyanmar();
	await med.read();
	let rawMed = med.raw;

	let raw = [];

	for (let rawIndex = 0; rawIndex < rawMed.length; rawIndex++) {
		const elm = rawMed[rawIndex];

		// let rawElm = Object.assign({}, elm, { sense: [] });
		let senses = elm.sense;
		for (let senseIndex = 0; senseIndex < senses.length; senseIndex++) {
			const sense = senses[senseIndex];
			// let pos = sense.pos;
			let defs = sense.def;
			let defCount = defs.length;

			// let rawSense = Object.assign({}, sense, { def: [] });

			for (let defIndex = 0; defIndex < defCount; defIndex++) {
				const def = defs[defIndex];
				let testMatch = def.match(/\(as in \[eg/g) || [];
				// if (testMatch.length == 1) {
				// 	let egs = def.match(/\(as in \[eg:(.*)\]\)\./);
				// 	if (egs) {
				// 		let egWhole = egs[0];
				// 		let eg = egs[1];

				// 		let definition = def.replace(egWhole, "").trim();
				// 		let exam = eg.split("၊").map(e => e.trim());

				// 		if (defCount == 1) {
				// 			defs[defIndex] = definition;
				// 			sense.exam = exam;
				// 			console.log("def update", definition, elm.id);
				// 		} else {
				// 			let abc = defIndex + 1;
				// 			if (defCount == abc) {
				// 				senses[senseIndex] = {
				// 					pos: sense.pos,
				// 					def: [definition],
				// 					exam: exam
				// 				};
				// 				// delete defs[defIndex];
				// 				// senses.splice(senseIndex, 0, tmp);
				// 				console.log("def add", definition, elm.id);
				// 			} else {
				// 				// defs[defIndex] = definition;
				// 				// sense.exam = exam;
				// 				let tmp = {
				// 					pos: sense.pos,
				// 					def: [definition],
				// 					exam: exam
				// 				};
				// 				senses.push(tmp);
				// 				console.log("def replace", definition, elm.id);
				// 				// delete defs[defIndex];
				// 			}
				// 			// defs.filter(function(el) {
				// 			// 	return el != null;
				// 			// });
				// 			// console.log("has multi def", elm.id);
				// 		}
				// 		// delete defs[defIndex];
				// 		// let abc = defs[defIndex]
				// 		// defs[defIndex].def = [definition];
				// 	}
				// } else if (testMatch.length > 1) {
				// 	console.log("more than 1 eg", elm.id);
				// }

				// if (testMatch.length == 1) {
				// 	let egs = def.match(/\(as in \[eg:(.*)\]\)\./);
				// 	if (egs) {
				// 		let egWhole = egs[0];
				// 		let eg = egs[1];

				// 		let definition = def.replace(egWhole, "").trim();
				// 		let exam = eg.split("၊").map(e => e.trim());
				// 		rawSense.def.push(definition);
				// 		rawSense.exam = exam;
				// 	}
				// }
				// rawElm.sense.push(rawSense);
				if (testMatch.length > 1) {
					console.log("more than 1 eg", elm.id);
					raw.push(elm.word);
				}
			}
		}

		// raw.push(rawElm);
	}

	// let posEach = rawMed.map(e => e.sense.map(o => o.pos));
	// let pos1D = posEach.reduce(function(prev, next) {
	// 	return prev.concat(next);
	// });
	// let raw = [...new Set(pos1D)];

	await med.write({
		raw: raw,
		space: 2,
		suffix: "-v3-eg-2"
	});
	return "done";
}

/**
 * Extract all pos
 * @param {any} req
 */
export async function allPos(req) {
	let med = new seed.defMyanmar();
	await med.read();
	let rawMed = med.raw;

	let posEach = rawMed.map(e => e.sense.map(o => o.pos));
	let pos1D = posEach.reduce(function(prev, next) {
		return prev.concat(next);
	});
	let raw = [...new Set(pos1D)];

	await med.write({
		raw: raw,
		space: 2,
		suffix: "-all-pos"
	});
	return "allPos";
}
