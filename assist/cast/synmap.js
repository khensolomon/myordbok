import { mysql, seed, table } from "./base.js";
// import * as base from "./base.js";

/**
 * needed to enable manually, column have been changed, word into wordid (wrid)
 */
export async function doExport() {
	try {
		let defSynmap = new seed.defSynmap();
		defSynmap.raw = await mysql.query(
			"SELECT id AS w, word AS v, dete AS d, wrte AS t FROM ??;",
			[table.synmap]
		);
		await defSynmap.write();
		console.info(
			" >",
			`synmap (derive:${defSynmap.raw.length}):`,
			defSynmap.file
		);
	} catch (error) {
		console.error(error);
	} finally {
		return "done";
	}
}
