import * as base from "./base.js";

/**
 * needed to enable manually, column have been changed, word into wordid (wrid)
 */
export async function doExport() {
	await base.mysql
		.query("SELECT id AS w, word AS v, dete AS d, wrte AS t FROM ??;", [
			base.table.synmap
		])
		.then(async raw => {
			var _wi = base.glossary.synmap();
			await base.json.write(_wi, raw);
			console.info(" >", "derives->synmap", raw.length, _wi);
		})
		.catch(e => console.error(e));
	return "Done ";
}
