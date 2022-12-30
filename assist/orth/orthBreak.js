const app = require("..");
const path = require("path");
const fs = require("fs");

const main = require("./orthography");

const { orthography } = app.Config;

const readCSV = async file =>
	await fs.promises
		.readFile(path.join(orthography.root, file))
		.then(e => e.toString().split("\n"))
		.catch(() => []);
const removeSpace = e => e.replace(/\s/g, "").trim();

module.exports = async str => {
	var result = [];
	var offset = 0;

	// NOTE: Breaking up words to syllable
	var input = await main.syllable(removeSpace(str));
	var dict_words = await readCSV("syllable-dict.csv");
	var stop_words = await readCSV("syllable-stop.csv");
	var common_words = await readCSV("syllable-common.csv");

	// Max limit of syllable in each word
	var LIMIT = 6;

	while (offset < input.length) {
		var chunk_end = offset + LIMIT;
		var chunk_found = false;

		// Breakning down a chunk of syllable from input, then checking backward from longest to shortest
		for (var i = chunk_end; i > offset; i--) {
			var chunk = input.slice(offset, i).join("");

			if (
				dict_words.includes(chunk) ||
				common_words.includes(chunk) ||
				stop_words.includes(chunk)
			) {
				// Found the word in data
				chunk_found = true;
				result.push(chunk);

				// Resetting offset to resume
				offset = i;
				break;
			}
		}

		// Didn't found the word of any long-short combination in the chunk
		if (!chunk_found) {
			// Now, the current syllable is a word
			result.push(input[offset]);
			offset++;
		}
	}

	return result;
};
