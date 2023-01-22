import { db } from "lethil";
import { config, json, glossary } from "../anchor/index.js";

const { dictionaries, table } = config.setting;

/**
 * export definition [en, sense, usage]
 * @param {any} req
 */
export async function definition(req) {
	// NOTE: info record
	var infoFile = glossary.info();
	/**
	 * @type {any}
	 */
	var infoRaw = await json.read(infoFile);
	/**
	 * @param {string} identity
	 * @param {any} digit
	 */
	function _record_info(identity, digit) {
		infoRaw.info.progress.map(e => {
			if (e.id && e.id == identity) {
				e.status = digit;
			}
		});
	}

	// NOTE: reset wrid
	// o = list_sense, i = list_word
	// UPDATE ?? AS o INNER JOIN (select id,word from ?? GROUP BY word ) AS i ON o.word = i.word SET o.wrid = i.id;
	// UPDATE ?? AS o INNER JOIN (select id,word from ?? GROUP BY word ) AS i ON o.word = i.word SET o.wrid = i.id;'
	// UPDATE ?? AS o INNER JOIN (select id, word from ?? GROUP BY word COLLATE UTF8_BIN) AS i ON o.word COLLATE UTF8_BIN = i.word SET o.wrid = i.id;
	await db.mysql
		.query(
			"UPDATE ?? AS o INNER JOIN (select id, word from ?? GROUP BY word) AS i ON o.word = i.word SET o.wrid = i.id;",
			[table.senses, table.senses]
		)
		.then(() => {
			console.log("...", "reset wrid");
		})
		.catch(e => console.error(e));
	// Change wrid AS w to wrid AS k
	await db.mysql
		.query(
			"SELECT wrid AS w, word AS v FROM ?? WHERE word IS NOT NULL GROUP BY wrid ORDER BY word ASC;",
			[table.senses]
		)
		.then(async raw => {
			var _wi = glossary.word();
			await json.write(_wi, raw);
			_record_info("word", raw.length);
			console.log("...", "en(word):", raw.length, _wi);
		})
		.catch(e => console.error(e));
	await db.mysql
		.query(
			"SELECT id AS i, wrid AS w, wrte AS t, sense AS v FROM ?? WHERE word IS NOT NULL AND sense IS NOT NULL ORDER BY wrte, wseq;",
			[table.senses]
		)
		.then(async raw => {
			await json.write(config.setting.glossary.sense, raw);
			_record_info("sense", raw.length);
			console.log("...", "sense:", raw.length, config.setting.glossary.sense);
		})
		.catch(e => console.error(e));
	await db.mysql
		.query(
			"SELECT id AS i, exam AS v FROM ?? WHERE exam IS NOT NULL AND exam <> '' ORDER BY wrte, wseq;",
			[table.senses]
		)
		.then(async raw => {
			await json.write(config.setting.glossary.usage, raw);
			_record_info("usage", raw.length);
			console.log("...", "usage:", raw.length, config.setting.glossary.usage);
		})
		.catch(e => console.error(e));
	await json.write(infoFile, infoRaw, 2);
	return "updated " + infoFile;
}

/**
 * export translation [ar, da, de, el ...]
 * @param {any} req
 */
export async function translation(req) {
	for (const continental of dictionaries) {
		for (const lang of continental.lang) {
			if (!lang.hasOwnProperty("default")) {
				var infoFile = glossary.info(lang.id);
				var infoRaw = await json.read(infoFile);
				await db.mysql
					.query(
						"SELECT word AS v, sense AS e FROM ?? WHERE word IS NOT NULL AND sense IS NOT NULL AND sense <> '';",
						[table.other.replace("0", lang.id)]
					)
					.then(raw => {
						json.write(glossary.word(lang.id), raw);
						console.info("...", lang.id, raw.length);

						infoRaw.info.progress.map(e => {
							if (e.id && e.id == "word") {
								e.status = raw.length;
							}
						});
						// console.info('done',lang.id,raw.length)
					})
					.catch(e => console.error(e));
				await json.write(infoFile, infoRaw, 2);
			} else {
				console.info("...", lang.id, "skip");
			}
		}
	}
	return Object.keys(json.data).length;
}

/**
 * export word [synset]
 * @param {any} req
 * id AS w, word AS v, derived AS d  LIMIT 10;
 */
export async function wordSynset(req) {
	// id AS w, word AS v, derived AS d  LIMIT 10;
	// throw '...needed to enable manually';
	await db.mysql
		.query("SELECT id AS w, word AS v FROM ??;", [table.synset])
		.then(async raw => {
			await json.write(config.setting.glossary.synset, raw);
			// await json.write('./test/words.json',raw);
			console.info("words->synset", raw.length);
		})
		.catch(e => console.error(e));
	return "Done";
}

/**
 * export word [synmap]
 * @param {any} req
 * SELECT root_id AS w, wrid AS v, derived_type AS d, word_type AS t FROM ??;
 * SELECT wrid AS v, dete AS d, wrte AS t FROM ??;
 */
export async function wordSynmap(req) {
	// throw '...needed to enable manually, column have been changed, word into wordid (wrid)';
	await db.mysql
		.query("SELECT id AS w, word AS v, dete AS d, wrte AS t FROM ??;", [
			table.synmap
		])
		.then(async raw => {
			// await json.write('./test/derives.json',raw);
			await json.write(config.setting.glossary.synmap, raw);
			console.info("derives->synmap", raw.length);
		})
		.catch(e => console.error(e));
	return "Done ";
}
