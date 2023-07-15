import { seed } from "./base.js";

/**
 * Myanmar-English Words
 */
export async function doExport() {
	let mew = new seed.wordMyanmar();
	let med = new seed.defMyanmar();
	await med.read();
	let rawMed = med.raw;

	// /**
	//  * @type {env.RowOfWordMed[]}
	//  */
	// let wordlist = [];

	for (let index = 0; index < rawMed.length; index++) {
		let row = rawMed[index];

		let word = row.word.trim();

		if (mew.raw.findIndex(e => e.v == word) == -1) {
			mew.raw.push({
				v: word
			});
		}
	}

	// 	let raw = rawMed.sort(function(a, b) {
	// 		return a.id.localeCompare(b.id);
	// 	});
	mew.raw.sort(function(a, b) {
		return a.v.localeCompare(b.v);
	});

	await mew.write();

	console.info(" >", `myanmar (word:${mew.raw.length}):`, mew.file);

	// console.info(
	// 	" >",
	// 	`synmap (derive:${defSynmap.raw.length}):`,
	// 	defSynmap.file
	// );
	// try {
	// 	let defSynmap = new seed.defSynmap();
	// 	defSynmap.raw = await mysql.query(
	// 		"SELECT id AS w, word AS v, dete AS d, wrte AS t FROM ??;",
	// 		[table.synmap]
	// 	);
	// 	await defSynmap.write();
	// 	console.info(
	// 		" >",
	// 		`synmap (derive:${defSynmap.raw.length}):`,
	// 		defSynmap.file
	// 	);
	// } catch (error) {
	// 	console.error(error);
	// } finally {
	// 	return "done";
	// }
}
