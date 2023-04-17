import { JSDOM } from "jsdom";

import { alphabets, codeToString } from "./base.js";

/**
 * Get all the alphabets
 * Request alphabets
 * Manually Trigger
 * @param {any} req
 */
export async function doRequest(req) {
	const dom = await JSDOM.fromURL(alphabets.url);
	var imgs = dom.window.document.querySelectorAll("img");
	for (const img of imgs) {
		var codeString = img
			.getAttribute("onclick")
			?.replace("insert('", "")
			.replace("');", "")
			.replace(/\\u/g, "-")
			.replace(/-/, "");
		/**
		 * @type {any}
		 */
		var code = codeString ? codeString.split("-") : [];

		var title = (img.getAttribute("title") || "").split(":");
		if (title.length == 2) {
			var des = title[1]
				.toLowerCase()
				.replace("myanmar", "")
				.trim();
			let row = {
				char: codeToString(code),
				des: des,
				code: code
			};
			// let symbolTest = /^letter ([i,u,e,o,au,great sa]{1,2})$/;
			let symbolTest = /^letter (i|u|e|o|au|great sa){1,2}$/;
			if (des.startsWith("letter")) {
				if (des.endsWith("subscript")) {
					alphabets.raw.subscript.push(row);
				} else if (des.endsWith("form")) {
					alphabets.raw.vowel.push(row);
				} else if (symbolTest.test(des)) {
					alphabets.raw.symbol.push(row);
				} else {
					alphabets.raw.letter.push(row);
				}
			} else if (des.includes("sign")) {
				alphabets.raw.sign.push(row);
			} else if (des.includes("symbol") || des.endsWith("genitive")) {
				alphabets.raw.symbol.push(row);
			} else if (des.includes("consonant")) {
				alphabets.raw.symbol.push(row);
			} else if (des.includes("vowel")) {
				alphabets.raw.vowel.push(row);
			} else {
				alphabets.raw.digit.push(row);
			}

			// if (des.includes("letter")) {
			// 	if (des.endsWith("subscript")) {
			// 		alphabets.raw.subscript.push({
			// 			char: codeToString(code),
			// 			des: des,
			// 			code: code
			// 		});
			// 	} else {
			// 		alphabets.raw.letter.push({
			// 			char: codeToString(code),
			// 			des: des,
			// 			code: code
			// 		});
			// 	}
			// }
			// if (des.includes("vowel")) {
			// 	alphabets.raw.vowel.push({
			// 		char: codeToString(code),
			// 		des: des,
			// 		code: code
			// 	});
			// }
			// if (des.includes("digit")) {
			// 	alphabets.raw.digit.push({
			// 		char: codeToString(code),
			// 		des: des,
			// 		code: code
			// 	});
			// }
			// if (des.includes("sign")) {
			// 	alphabets.raw.sign.push({
			// 		char: codeToString(code),
			// 		des: des,
			// 		code: code
			// 	});
			// }
			// if (des.includes("symbol") || des.endsWith("genitive")) {
			// 	alphabets.raw.symbol.push({
			// 		char: codeToString(code),
			// 		des: des,
			// 		code: code
			// 	});
			// }
		}
	}

	alphabets.write();
	return alphabets.file;
}
