import * as base from "./base.js";

/**
 * export translation [ar, da, de, el ...]
 * @returns {Promise<any>}
 */
export async function doExport() {
	for (const continental of base.dictionaries) {
		for (const lang of continental.lang) {
			if (!lang.hasOwnProperty("default")) {
				var infoFile = base.glossary.info(lang.id);
				const infoRaw = await base.info_read(infoFile);

				infoRaw.dated = Date.now();

				const raw = await base.mysql.query(
					"SELECT word AS v, sense AS e FROM ?? WHERE word IS NOT NULL AND sense IS NOT NULL AND sense <> '';",
					[base.table.other.replace("0", lang.id)]
				);

				var _wi = base.glossary.word(lang.id);
				base.json.write(_wi, raw);
				console.info(" >", lang.id, raw.length, _wi);

				const totalSense = raw.length;
				const percentage = await base.percentageTranslation(totalSense);
				infoRaw.info.progress.map(e => {
					if (e.name) {
						if (e.name.toLowerCase() == "word") {
							e.status = totalSense;
						}
						if (e.name.toLowerCase() == "completion") {
							e.status = percentage;
						}
					}
				});

				await base.json.write(infoFile, infoRaw, 2);
				console.log("  +", infoFile);
			} else {
				console.info(" >", lang.id, "skip");
			}
		}
	}
	return Object.keys(base.json.data).length;
}
