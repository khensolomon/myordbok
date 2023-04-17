import * as base from "./base.js";

/**
 * Development purpose only
 * @param {string} word
 */
export async function doSynmap(word) {
	const res = [];

	// return raw.length ? true : false;
	const synmap = await base.mysql.query(
		"SELECT word AS v FROM ?? WHERE LOWER(word) LIKE LOWER(?);",
		[base.table.synmap, word]
	);
	const sense = await base.mysql.query(
		"SELECT word AS term FROM ?? WHERE LOWER(word) LIKE LOWER(?);",
		[base.table.senses, word]
	);

	if (synmap.length) {
		if (sense.length == 0) {
			res.push("synmap");
		}
	} else {
		const synset = await base.mysql.query(
			"SELECT word AS v FROM ?? WHERE LOWER(word) LIKE LOWER(?);",
			[base.table.synset, word]
		);
		if (synset.length && sense.length == 0) {
			res.push("synset");
		}
	}
	// if (sense.length) {
	// 	res.push("sense");
	// }

	console.log("word", word);
	return res;
}

/**
 * Development purpose only
 * @param {*} req
 */
export async function doSynset(req) {
	return req;
}
