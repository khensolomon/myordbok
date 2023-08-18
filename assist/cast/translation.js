import {
	mysql,
	seed,
	table,
	dictionaries,
	percentageTranslation
} from "./base.js";
// import * as base from "./base.js";

/**
 * export translation [ar, da, de, el ...]
 * @returns {Promise<any>}
 */
export async function doExport() {
	for (const continental of dictionaries) {
		for (const lang of continental.lang) {
			if (!lang.hasOwnProperty("default")) {
				let wordSource = new seed.wordSource({
					lang: lang.id,
					cache: false
				});
				let ifd = new seed.infoDict({ lang: lang.id });

				await ifd.read();

				let infoRaw = ifd.raw;
				// var infoFile = base.glossary.info(lang.id);
				// const infoRaw = await base.info_read(infoFile);

				infoRaw.dated = Date.now();

				// const raw = await base.mysql.query(
				// 	"SELECT word AS v, sense AS e FROM ?? WHERE word IS NOT NULL AND sense IS NOT NULL AND sense <> '';",
				// 	[base.table.other.replace("0", lang.id)]
				// 	);

				wordSource.raw = await mysql.query(
					"SELECT word AS v, sense AS e FROM ?? WHERE word IS NOT NULL AND sense IS NOT NULL AND sense <> '';",
					[table.other.replace("0", lang.id)]
				);

				// var _wi = base.glossary.word(lang.id);
				// base.json.write(_wi, raw);
				// console.info(" >", lang.id, raw.length, _wi);

				let _wst = wordSource.raw.length;
				await wordSource.write();
				// console.info(" >", lang.id, _wst, wordSource.file);
				console.info(" >", `Glossary (${lang.id}: ${_wst}):`, ifd.file);

				// const totalSense = raw.length;
				const percentage = await percentageTranslation(_wst);
				infoRaw.info.progress.map(e => {
					if (e.id) {
						if (e.id == "word") {
							e.status = _wst;
						}
						if (e.id == "progress") {
							e.status = percentage;
						}
					}
				});
				// infoRaw.info.progress.map(e => {
				// 	if (e.name) {
				// 		if (e.name.toLowerCase() == "word") {
				// 			e.status = _wst;
				// 		}
				// 		if (e.name.toLowerCase() == "completion") {
				// 			e.status = percentage;
				// 		}
				// 	}
				// });

				// await base.json.write(infoFile, infoRaw, 2);
				// console.log("  +", infoFile);

				await ifd.write({ space: 2 });
				// console.log("  +", ifd.file);
				console.log("  ", "Info (updated):", ifd.file);
			} else {
				console.info(" >", lang.id, "skip");
			}
		}
	}
	// return Object.keys(base.json.data).length;
	return "done";
}
