/**
 * regex link
 * @param {string} str
 */
export function link(str) {
	return str.replace(/\[(.*?)\]/g, function(s, t) {
		var [name, e] = t.split(":");
		// NOTE: [also:creative]
		if (e && typeof e == "string") {
			var href = e
				.split("/")
				.map(word => "{-*-}".replace(/\*/g, word))
				.join(", ");
			if (name == "list") {
				return href;
			} else {
				return "(-0-) 1".replace("0", name).replace("1", href);
			}
		} else {
			return s;
		}
	});
}

/**
 * format definition
 * @param {string} str
 */
export function sense(str) {
	return link(str);
}

/**
 * format usage/example
 * @param {string} str
 */
export function exam(str) {
	return link(str)
		.split("\r\n")
		.map(e => e.trim());
}

// export default {sense, exam};
