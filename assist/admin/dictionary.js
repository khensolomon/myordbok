import { db } from "lethil";
import { env, json, glossary } from "../anchor/index.js";

const { dictionaries, table } = env.config;

/**
 * @typedef {Object<string,any>} TypeOfInfoProgress
 * @property {string} name
 * @property {string} my
 * @property {number} [percentage] - 87.5
 * @property {string} [id] - word
 * @property {number} [status] - 58497
 *
 * @typedef {Object} TypeOfInfo
 * @property {string} title
 * @property {string} keyword
 * @property {string} description
 * @property {string} description
 * @property {Object} info
 * @property {string} info.header
 * @property {TypeOfInfoProgress[]} info.progress
 * @property {string[]} info.context
 * property {Object} info.progress
 * property {string} info.progress.name
 * property {string} info.progress.my
 * property {string} info.progress.my
 * property {number} [info.progress.percentage] - 87.5
 * property {string} [info.progress.id] - word
 * property {number} [info.progress.status] - 58497
 * property {{name:string,my:string,percentage?:number, id?:string, status?:number}[]} info.progress
 */

/**
 * @param {string} file
 * @returns {Promise<TypeOfInfo>}
 */
function info_read(file) {
	return json.read(file);
}
/**
 * export definition [en, sense, usage]
 * @param {any} req
 */
export async function exportDefinition(req) {
	// NOTE: info record
	const infoFile = glossary.info();

	const infoRaw = await info_read(infoFile);

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
			console.log(" >", "reset wrid");
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
			console.log(" >", "en(word):", raw.length, _wi);
		})
		.catch(e => console.error(e));
	/*
	word:{w:wrid, v:word}
	sense:{i:id,w:wrid,t:wrte,v:sense}
	usage:{i:id,v:exam}
	*/
	await db.mysql
		.query(
			"SELECT id AS i, wrid AS w, wrte AS t, sense AS v FROM ?? WHERE word IS NOT NULL AND sense IS NOT NULL ORDER BY wrte, wseq;",
			[table.senses]
		)
		.then(async raw => {
			var _wi = glossary.sense();
			await json.write(_wi, raw);
			_record_info("sense", raw.length);
			console.log(" >", "sense:", raw.length, _wi);
		})
		.catch(e => console.error(e));
	await db.mysql
		.query(
			"SELECT id AS i, exam AS v FROM ?? WHERE exam IS NOT NULL AND exam <> '' ORDER BY wrte, wseq;",
			[table.senses]
		)
		.then(async raw => {
			var _wi = glossary.usage();
			await json.write(_wi, raw);
			_record_info("usage", raw.length);
			console.log(" >", "usage:", raw.length, _wi);
		})
		.catch(e => console.error(e));
	await json.write(infoFile, infoRaw, 2);
	return "updated " + infoFile;
}

/**
 * export translation [ar, da, de, el ...]
 * @param {any} req
 */
export async function exportTranslation(req) {
	for (const continental of dictionaries) {
		for (const lang of continental.lang) {
			if (!lang.hasOwnProperty("default")) {
				var infoFile = glossary.info(lang.id);
				const infoRaw = await info_read(infoFile);
				await db.mysql
					.query(
						"SELECT word AS v, sense AS e FROM ?? WHERE word IS NOT NULL AND sense IS NOT NULL AND sense <> '';",
						[table.other.replace("0", lang.id)]
					)
					.then(raw => {
						var _wi = glossary.word(lang.id);
						json.write(_wi, raw);
						console.info(" >", lang.id, raw.length, _wi);

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
				console.info(" >", lang.id, "skip");
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
export async function exportWordSynset(req) {
	// NOTE: wait
	await info_read(glossary.info());

	// await db.mysql.connect();
	// id AS w, word AS v, derived AS d  LIMIT 10;
	// throw '...needed to enable manually';
	await db.mysql
		.query("SELECT id AS w, word AS v FROM ??;", [table.synset])
		.then(async raw => {
			var _wi = glossary.synset();
			await json.write(_wi, raw);
			// await json.write('./test/words.json',raw);
			console.info(" >", "words->synset", raw.length, _wi);
		})
		.catch(e => console.error(e));

	return "Done " + table.synset;
}

/**
 * export word [synmap]
 * @param {any} req
 * SELECT root_id AS w, wrid AS v, derived_type AS d, word_type AS t FROM ??;
 * SELECT wrid AS v, dete AS d, wrte AS t FROM ??;
 */
export async function exportWordSynmap(req) {
	// NOTE: wait
	await info_read(glossary.info());
	// throw ' >needed to enable manually, column have been changed, word into wordid (wrid)';
	await db.mysql
		.query("SELECT id AS w, word AS v, dete AS d, wrte AS t FROM ??;", [
			table.synmap
		])
		.then(async raw => {
			var _wi = glossary.synmap();
			await json.write(_wi, raw);
			console.info(" >", "derives->synmap", raw.length, _wi);
		})
		.catch(e => console.error(e));
	return "Done ";
}

/**
 * Development purpose only
 * @param {string} word
 */
export async function search(word) {
	const res = [];

	// return raw.length ? true : false;
	const synmap = await db.mysql.query(
		"SELECT word AS v FROM ?? WHERE LOWER(word) LIKE LOWER(?);",
		[table.synmap, word]
	);
	const sense = await db.mysql.query(
		"SELECT word AS term FROM ?? WHERE LOWER(word) LIKE LOWER(?);",
		[table.senses, word]
	);

	if (synmap.length) {
		if (sense.length == 0) {
			res.push("synmap");
		}
	} else {
		const synset = await db.mysql.query(
			"SELECT word AS v FROM ?? WHERE LOWER(word) LIKE LOWER(?);",
			[table.synset, word]
		);
		if (synset.length && sense.length == 0) {
			res.push("synset");
		}
	}
	// if (sense.length) {
	// 	res.push("sense");
	// }
	return res;
}

/**
 * @param {any} req
 */
export async function testing(req) {
	try {
		const infoFile = glossary.info();
		await info_read(infoFile);

		await db.mysql
			.query("SELECT word AS v FROM ?? WHERE LOWER(word) LIKE LOWER(?);", [
				table.synmap,
				req.params.word
			])
			.then(function(e) {
				console.log(e);
			})
			.catch(function(err) {
				console.log("error-0", err);
			});
	} catch (error) {
		console.log("error-1", error);
	} finally {
		process.exit();
	}
}
