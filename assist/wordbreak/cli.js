import { seek } from "lethil";
import wordbreak from "./index.js";

/**
 * Wordbreak
 * @param {any} req
 * @example
 * node run wordbreak
 * node run wordbreak loving
 * node run wordbreak -- file ./assist/wordbreak/word/.csv save true
 */
export default async function main(req) {
	if (req.params.word) {
		return wordbreak(req.params.word);
	} else if (req.query.file) {
		return file(req.query);
	} else {
		return noTask(req);
	}
}

/**
 * @param {any} query
 */
async function file(query) {
	// var raw = reader(query.file).split("\r\n");
	var raw = reader(query.file).split(/\r?\n|\r|\n/g);
	var res = [];
	for (let index = 0; index < raw.length; index++) {
		const word = raw[index];
		var row = wordbreak(word);
		res.push(row);
	}
	if (query.save) {
		var file = query.file.replace(/.([^.]*)$/, "-output.v0.$1");
		writer(file, JSON.stringify(res, null, 2));
		return `Saved to ${file} ${query.save}`;
	} else {
		return res;
	}
}

/**
 * @param {any} req
 */
function noTask(req) {
	if (req.params.task) {
		return `Wordbreak has no such task '${req.params.task}' name!`;
	}
	return `Provide a task name for Wordbreak!`;
}

/**
 * @param {string} file
 */
function reader(file) {
	return seek.readSync(file).toString();
}
/**
 * @param {string} file
 * @param {string | NodeJS.ArrayBufferView} raw
 */
function writer(file, raw) {
	return seek.writeSync(file, raw);
}
