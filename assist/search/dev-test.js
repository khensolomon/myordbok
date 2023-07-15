import { seed } from "../anchor/index.js";
import { wordSyllable } from "../orth/index.js";

/**
 * Testing wordbreak
 * @param {any} req
 */
export async function mainTmp(req) {
	let med = new seed.default({ file: "./cache/tmp/myanmar-wordbreak.json" });

	let raw = wordSyllable("ဖျက်ဆီးခြင်း");
	// let raw = [""];

	await med.write({
		raw: raw,
		space: 2
	});
	return "done";
}

/**
 * med v1 modified ref, and remove id
 * @param {any} req
 */
export default async function main(req) {
	let med = new seed.defMyanmar();
	await med.read();
	let rawMed = med.raw;

	await med.write({
		raw: rawMed,
		space: 2,
		suffix: "-v3"
	});
	return "done";
}

/**
 * med v1 modified ref, and remove id
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
 * med v0 Sorting
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
 * Testing defMyanmar
 * @param {any} req
 */
export async function medTesting(req) {
	let med = new seed.defMyanmar();
	await med.read();
	let rawMed = med.raw;

	// let raw = rawMed.map(function(e) {
	// 	return e.sense.map(function(s) {
	// 		let def = s.def;
	// 		let exam = [""];
	// 		s.def = def;
	// 		s.exam = exam;
	// 		return s;
	// 	});
	// });

	let posEach = rawMed.map(e => e.sense.map(o => o.pos));
	let pos1D = posEach.reduce(function(prev, next) {
		return prev.concat(next);
	});
	let raw = [...new Set(pos1D)];

	await med.write({
		raw: raw,
		space: 2,
		suffix: "-pos-all"
	});
	return "done";
}
