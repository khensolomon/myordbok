import * as base from "./base.js";

/**
 * Syllable break
 * param {string} str
 * @param {any} str
 */
export function syllable(str) {
	var offset = 0,
		result = [];

	while (offset < str.length) {
		var output = base.syllable(str, str.length, offset);
		// var type = output[0];
		var next = output[1];

		result.push(str.substring(offset, next));
		offset = next;
	}

	return result;
}

/**
 * Word break
 * param {string} str
 * @param {base.TypeOfQuery} req
 */
export function word(req) {
	var res = [];
	if (typeof req == "object") {
		var str = base.reader(req.file);
		res = wordBreaker(str);
		if (req.hasOwnProperty("save")) {
			// req.file.replace(/\/(?=[^\/]*$)/, "/orth.v0."),
			var file = req.file.replace(/.([^.]*)$/, "-word.v0.$1");
			base.writer(file, res.join(" "));
			return `Saved to ${file}`;
		}
	} else {
		res = wordBreaker(req);
	}
	return res;
}

/**
 * @param {string} str
 */
function wordBreaker(str) {
	let wordThesaurus = base.wordThesaurus.read();
	let wordCommon = base.wordCommon.read();
	let wordStop = base.wordStop.read();

	// Breaking up words to syllable
	let input = syllable(str.replace(/\s/g, "").trim());
	// let input = syllable(str);

	var result = [];
	var offset = 0;

	// Max limit of syllable in each word
	var LIMIT = 6;

	while (offset < input.length) {
		var chunk_end = offset + LIMIT;
		var chunk_found = false;

		// Breakning down a chunk of syllable from input, then
		// checking backward from longest to shortest
		for (var i = chunk_end; i > offset; i--) {
			var chunk = input.slice(offset, i).join("");

			if (
				wordThesaurus.includes(chunk) ||
				wordCommon.includes(chunk) ||
				wordStop.includes(chunk)
			) {
				// Found the word in data
				chunk_found = true;
				result.push(chunk);

				// Resetting offset to resume
				offset = i;
				break;
			}
		}

		// Didn't found the word of any
		// long-short combination in the chunk
		if (!chunk_found) {
			// Now, the current syllable is a word
			result.push(input[offset]);
			offset++;
		}
	}

	return result;
}
