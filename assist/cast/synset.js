import { mysql, seed, table } from "./base.js";

/**
 * ...needed to enable manually
 * id AS w, word AS v, derived AS d  LIMIT 10;
 */
export async function doExport() {
	// await base.mysql
	// 	.query("SELECT id AS w, word AS v FROM ??;", [base.table.synset])
	// 	.then(async raw => {
	// 		var _wi = base.glossary.synset();
	// 		await base.json.write(_wi, raw);
	// 		// await json.write('./test/words.json',raw);
	// 		console.info(" >", "words->synset", raw.length, _wi);
	// 	});

	// return "Done " + base.table.synset;

	try {
		let defSynset = new seed.defSynset();
		defSynset.raw = await mysql.query("SELECT id AS w, word AS v FROM ??;", [
			table.synset
		]);
		await defSynset.write();
		console.info(
			" >",
			`synset (derive:${defSynset.raw.length}):`,
			defSynset.file
		);
	} catch (error) {
		console.error(error);
	} finally {
		return "done";
	}
}
