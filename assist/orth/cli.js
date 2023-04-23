// import fs from "fs";
/**
 * orthography request
 * @param {any} req
 * @example
 * file or sentence
 * node run orth
 * node run orth break syllable
 * node run orth break word -- file ./docs/tmp/orth.txt save true
 */

export default async function main(req) {
	switch (req.params.task) {
		case "break":
			return await doBreak(req.params.name).then(e => e(req.query));
		// fs.writeFileSync(
		// 	`./docs/tmp/orth-break-${req.params.name}.csv`,
		// 	res.toString()
		// );
		// return "done";
		default:
			return noTask(req);
	}
}

/**
 * @param {string} [name]
 */
async function doBreak(name) {
	switch (name) {
		case "syllable":
			return (await import("./break.js")).syllable;
		case "word":
			return (await import("./break.js")).word;
		default:
			return noName;
	}
}

/**
 * @param {any} req
 */
function noTask(req) {
	if (req.params.task) {
		return `Orth has no such task '${req.params.task}' name!`;
	}
	return `Provide a task name for Orth!`;
}

/**
 * @param {any} req
 */
function noName(req) {
	return `What to ${req.params.task} from ${req.params.name} of Orth?`;
}
