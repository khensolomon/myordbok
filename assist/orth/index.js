import { syllable } from "./base.js";

/**
 * Syllable break
 * param {string} str
 * @param {string} str
 */
export function wordSyllable(str) {
	var offset = 0,
		result = [];

	while (offset < str.length) {
		// var output = syllable(str);
		var output = syllable(str, str.length, offset);
		// var type = output[0];
		var next = output[1];

		result.push(str.substring(offset, next));
		offset = next;
	}

	return result;
}
