import { default as base } from "./base.js";

/**
 * Myanmar-English translation/definition
 * @param {any} req
 * @example
 * node run ome word suggest --q=?
 * node run ome word size
 * node run ome word list
 */
export default async function main(req) {
	switch (req.params.task) {
		case "word":
			// return await doWords(req).then(e => e(req.query));
			return await doWords(req);
		default:
			return noTask(req);
	}
}

/**
 * @param {any} req
 */
async function doWords(req) {
	switch (req.params.name) {
		case "suggest":
			// return base.suggestWord;
			return base.suggestWord(req.query);
		// case "size":
		// 	return words.size;
		// case "list":
		// 	return words.list;
		default:
			return noName;
	}
}

/**
 * @param {any} req
 */
function noTask(req) {
	return [];
}

/**
 * @param {any} req
 */
function noName(req) {
	return [];
}
