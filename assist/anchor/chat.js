/**
 * remove non alphanumeric
 * idiom caseContext
 * @param {string} str
 */
export function removeNoneAlphanumeric(str) {
	return str.replace(/[\s-?!,.]+/g, "").toLowerCase();
}

/**
 * @param {string} str
 * @param {string} other
 */
export function compare(str, other) {
	return removeNoneAlphanumeric(str) == removeNoneAlphanumeric(other);
}

/**
 * @param {string} str
 */
export function stripString(str) {
	return str
		.replace(/\(\s+?/g, "(")
		.replace(/\s+?\)/g, ")")
		.replace(/\[\s+?/g, "[")
		.replace(/\s+?\]/g, "]")
		.replace(/\t/g, " ")
		.replace(/\s\s+/g, " ")
		.trim();
}

/**
 * @param {string} str
 */
export function upperCaseFirstString(str) {
	return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * replace space with dot and lowercase
 * @param {string} str
 */
export function replaceSpaceWithDot(str) {
	return (str.match(/[a-zA-Z]+|[0-9]+(?:\.[0-9]+|)/g) || [])
		.join(".")
		.toLowerCase();
}

// export const chat = {
//   spaces:strSpaces,
//   compare:hasWordMatch,
//   strip:trimString,
//   toUpperCaseFirst:upperCaseString
// }
