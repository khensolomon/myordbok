// import { re } from "mathjs";
import { env } from "../anchor/index.js";
/**
 * @typedef {{needle:string, hay:string}} TypeCertainWord - Replace certain symbol with word
 * ctw
 */

/**
 * regex link
 * @param {string} str
 * @param {TypeCertainWord?} [rcw] - Replace certain character with word, not symbol
 * @example When using TypeCertainWord [making ~] to [making {TypeCertainWord}]
 */
export function link(str, rcw) {
	const plain_name = ["list", "exam"];
	// let needle = new RegExp(rcw.needle, "g");

	str = str.replace(/\<(.+?)\>/g, (_, v) =>
		v
			.split("/")
			.map((/** @type {string} */ w) => "{-*-}".replace(/\*/g, w))
			.join(", ")
	);

	const brackets_regx = /\[(.*?)\]/g;
	// /\[(.*?)\]/g;
	// /\[.*?[^\)]\]/g;
	// NOTE: all [.*]
	let brackets = str.match(brackets_regx);
	if (brackets && brackets.length) {
		str = str.replace(brackets_regx, function(s, t) {
			var [name, v] = t.split(":");
			// NOTE: [also:creative]
			if (t) {
				if (v && typeof v == "string") {
					// NOTE: seperator
					let seperator = "/";
					if (name == "with") {
						seperator = " ";
					}

					// let ltes = v.match(/\<(.+?)\>/g);
					// if (ltes) {
					// 	return v;
					// } else {
					// 	// NOTE: containing none of <>
					// 	const links = v
					// 		.split(seperator)
					// 		.map(word => "{-*-}".replace(/\*/, word));
					// 	let href = links.join(", ");
					// 	if (rcw) {
					// 		href = href.replace(new RegExp(rcw.needle, "g"), rcw.hay);
					// 	}

					// 	if (name == "" || name == null || plain_name.includes(name)) {
					// 		// NOTE: [:creative] [list:creative] [exam:creative]
					// 		return href;
					// 	} else if (name == "with") {
					// 		// NOTE: informal esp US, [link:informal esp US] (~ [link:informal esp US])
					// 		return links.join(" ");
					// 	} else if (name == "type") {
					// 		// NOTE: type (law, medical, physic, religion, grammar, biology, dated etc)
					// 		return "[1]".replace("1", href);
					// 	} else if (name == "user") {
					// 		// NOTE: type (suggestion, correction)
					// 		return "[1]".replace("1", href);
					// 	} else {
					// 		// NOTE: type (~, other)
					// 		if (rcw && rcw.needle == name) {
					// 			return "(-rcwNde-) 1".replace("1", href);
					// 		}
					// 		return "(-0-) 1".replace("0", name).replace("1", href);
					// 	}
					// }

					const links = v
						.split(seperator)
						.map(word => "{-*-}".replace(/\*/g, word));
					let href = links.join(", ");
					if (rcw) {
						href = href.replace(new RegExp(rcw.needle, "g"), rcw.hay);
					}

					if (name == "" || name == null || plain_name.includes(name)) {
						// NOTE: [:creative] [list:creative] [exam:creative]
						return href;
					} else if (name == "with") {
						// NOTE: informal esp US, [link:informal esp US] (~ [link:informal esp US])
						return links.join(" ");
					} else if (name == "etc") {
						// NOTE: a love of [etc:learning/adventure/nature].
						// a love of learning, adventure or nature etc.
						return "* etc"
							.replace("*", href)
							.replace(/,(?=[^,]+$)/, " or")
							.trim();
					} else if (name == "type") {
						// NOTE: type (law, medical, physic, religion, grammar, biology, dated etc)
						return "[*]".replace("*", href);
					} else if (name == "user") {
						// NOTE: type (suggestion, correction)
						return "[*]".replace("*", href).replace(/,(?=[^,]+$)/, " and");
					} else {
						// NOTE: type (~, other)
						if (rcw && rcw.needle == name) {
							return "(-rcwNde-) 1".replace("1", href);
						}
						return "(-0-) 1".replace("0", name).replace("1", href);
					}
				} else {
					return s;
				}
			} else {
				return "<span class='bracket square'>-</span>";
			}
		});
	}
	if (rcw) {
		let hayLink = "{-*-}".replace(/\*/, rcw.hay);
		// str = str
		// 	.replace(new RegExp(rcw.needle, "g"), hayLink)
		// 	.replace(/rcwNde/g, rcw.needle);

		if (rcw.needle == "~") {
			str = str.replace(/\~(?![^{]*})/g, hayLink);
		}
		str = str
			.replace(new RegExp(rcw.needle, "g"), rcw.hay)
			.replace(/rcwNde/g, rcw.needle);
	}

	str = str.replace(/\(\)/, "<span class='bracket round parenthesis'>-</span>");
	// str = str.replace(/\[\]/, "<span class='bracket square'>-</span>");
	str = str.replace(/\<\>/, "<span class='bracket angle'>-</span>");
	str = str.replace(/\{\}/, "<span class='bracket curly'>-</span>");

	return str;
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
 * @param {string} by - split by, default is semicolon (;)
 * @param {TypeCertainWord?} [rcw] - Replace certain character with word
 */
export function exam(str, by = ";", rcw = null) {
	return link(str, rcw)
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
		// let testExam = row.match(/\[exam:/g) || [];
		// let testExam = row.match(/\[:/g) || [];
		const regxExamBlock = /\[:(.+?)\]/g;
		let egs = row.match(regxExamBlock);

		let lastIndex = res.length - 1;
		let last = res[lastIndex];
		/*
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
			// let egs = row.match(/\[exam:(.*)\]/);
			let egs = row.match(/\[:(.*)\]/);
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
		*/
		if (egs) {
			let definition = row.replace(regxExamBlock, "").trim();
			let mean = sense(definition);

			// let exam = egs
			// 	.map(e => e.replace(/~/g, "[" + word + "]"))
			// 	.join(", ")
			// 	.replace(regxExamBlock, "$1");
			// let eg = egs.map(e =>
			// 	e
			// 		.replace(regxExamBlock, "$1")
			// 		.replace(/~/g, "[" + word + "]")
			// 		.trim()
			// );

			// let example = egs
			// 	.map(e => e.replace(/~/g, "[" + word + "]"))
			// 	.join(";")
			// 	.replace(regxExamBlock, "$1");
			// let eg = exam(example);
			let example = egs
				.join(";")
				.replace(/~/g, "[" + word + "]")
				.replace(regxExamBlock, "$1");
			let eg = exam(example);

			// let eg = egs
			// 	.map(e =>
			// 		e.replace(regxExamBlock, "$1").replace(/~/g, "[" + word + "]")
			// 	)
			// 	.map(e => exam(e));

			if (last && !last.exam.length) {
				last.mean.push(mean);
				last.exam.push(...eg);
			} else {
				res.push({
					mean: [mean],
					exam: eg
				});
			}
		} else {
			let mean = sense(row);
			if (last && !last.exam.length) {
				last.mean.push(mean);
			} else {
				res.push({
					mean: [mean],
					exam: []
				});
			}
		}
	}
	return res;
}
