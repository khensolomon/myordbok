import { env } from "../anchor/index.js";

/**
 * regex link
 * @param {string} str
 */
export function link(str) {
	return str.replace(/\[(.*?)\]/g, function(s, t) {
		var [name, e] = t.split(":");
		// NOTE: [also:creative]
		if (e && typeof e == "string") {
			// NOTE: seperator
			let seperator = "/";
			if (name == "with") {
				seperator = " ";
			}

			var links = e.split(seperator).map(word => "{-*-}".replace(/\*/g, word));
			var href = links.join(", ");
			if (name == "list") {
				return href;
			} else if (name == "with") {
				// NOTE: informal esp US, [link:informal esp US] (~ [link:informal esp US])
				return links.join(" ");
			} else if (name == "type") {
				// NOTE: type (law, medical, physic, religion, grammar, biology, dated etc)
				return "[1]".replace("1", href);
			} else if (name == "user") {
				// NOTE: type (suggestion, correction)
				return "[1]".replace("1", href);
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
 * replacing \r\n to ;
 * @param {string} str
 * @param {string} by - default is dash -
 */
export function exam(str, by = ";") {
	return link(str)
		.split(by)
		.map(e => e.trim());
}

/**
 * @param {string} str
 * @param {string} word
 * @returns {env.RowOfMean[]|string}
 */
export function defBlock(str, word, by = ";") {
	let raw = str.split(by).map(e => e.trim());

	// if (raw.length == 1) {
	// 	return str;
	// }

	let res = [];

	for (let index = 0; index < raw.length; index++) {
		const row = raw[index];
		let testExam = row.match(/\[exam:/g) || [];

		let lastIndex = res.length - 1;
		let last = res[lastIndex];

		if (testExam.length == 0) {
			let mean = sense(row);
			if (last && !last.exam.length) {
				last.mean.push(mean);
			} else {
				res.push({
					mean: [mean],
					exam: []
				});
			}
		} else if (testExam.length == 1) {
			let egs = row.match(/\[exam:(.*)\]/);
			if (egs) {
				let egWhole = egs[0];
				let eg = egs[1];
				let definition = row.replace(egWhole, "").trim();
				let example = eg.split("/").map(e => e.trim());
				// meanBlock.push(makeup.sense(definition));
				// examBlock.type = "examSentence";
				// examBlock.value = makeup.exam(eg, "/");
				let mean = sense(definition);
				// let exam = example;
				let exam = example.map(e => e.replace(/~/g, "[" + word + "]"));

				if (last && !last.exam.length) {
					last.mean.push(mean);
					last.exam.push(...exam);
					console.log("push", mean);
				} else {
					res.push({
						mean: [mean],
						exam: exam
					});
				}
			}
		}
	}
	return res;
}
