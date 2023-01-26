import { resolve } from "path";
import { access, createWriteStream, createReadStream } from "fs";
import { createInterface } from "readline";
import { zero } from "./glossary.js";
import config from "./config.js";

/**
 * @param {string} file
 * @param {string} line
 */
function write(file, line) {
	const createStream = createWriteStream(file, {
		flags: "a",
		encoding: "utf8"
	});
	createStream.write(line);
	createStream.write("\n");
	createStream.end();
}

/**
 * @param {string} file
 */
function read(file) {
	return createInterface({
		input: createReadStream(file)
	});
}

/**
 * Save keyword that does not have definition
 * @param {string} keyword
 * @param {string} lang
 */
export async function keyword(keyword, lang) {
	var addWord = true;
	const file = resolve(config.media, zero(lang));
	keyword = keyword.replace(/\W/g, "").toLowerCase();

	access(file, e => {
		if (e) {
			write(file, keyword);
		} else {
			var reader = read(file);
			reader
				.on("line", word => {
					if (word == keyword) {
						addWord = false;
						reader.close();
						reader.removeAllListeners();
					}
				})
				.on("close", () => {
					if (addWord) write(file, keyword);
				});
		}
	});
}
