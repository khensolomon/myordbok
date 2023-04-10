import { JSDOM } from "jsdom";
// import { seek } from "lethil";

import * as base from "./base.js";

const definitions = base.definitions;
const keywords = base.keywords;

let taskId = "";
/**
 * @typedef {Object} TypeOfRequests
 * @property {Object} params
 * @property {string?} params.task
 * @property {number?} params.name
 * @property {Object} query
 * @property {string?} query.identify - [unsuccess,block,all,none]
 * @property {number?} query.timeout - [2000]
 */

/**
 * Get definitions
 * Manually Trigger
 * @param {TypeOfRequests} req - {query:{identify?:string, timeout?:number}}
 */
export async function request(req) {
	// taskId = req.params.identify;
	if (req.query.identify) {
		taskId = req.query.identify;
	}
	let timeout = req.query.timeout;
	if (typeof timeout != "number") {
		timeout = 2000;
	}

	await keywords.read();
	await definitions.read();

	const totalDefBefore = definitions.raw.length;

	const task = keywords.raw.filter(taskFilter);
	const taskTotal = task.length;

	for (let index = 0; index < task.length; index++) {
		let row = task[index];
		const indexWord = keywords.raw.findIndex(e => e.word == row.word);
		try {
			await taskTimer(timeout);
			await scanner(row.word);
			console.log(index, "of", taskTotal, "in", indexWord);
		} catch (error) {
			keywords.raw[indexWord].status = 1;
			console.log(indexWord, error);
		}
	}

	const totalDefAfter = definitions.raw.length;
	console.log("before", totalDefBefore, "after", totalDefAfter);
	return "done";
}

/**
 * Keywords filter [unsuccess, block, none, all]
 * @param {base.TypeOfKeywords} row
 * @example
 * await timer(3000);
 */
function taskFilter(row) {
	if (taskId == undefined || taskId == "") {
		return row.status == 0 && row.block == 0;
	} else if (taskId == "unsuccess") {
		return row.status == 1 && row.block == 0;
	} else if (taskId == "error") {
		return row.status == 1;
	} else if (taskId == "block") {
		return row.status == 0 && row.block > 0;
	} else if (taskId == "none") {
		return row.status == 0;
	} else if (taskId == "all") {
		return true;
	}

	return false;
}

/**
 * @param {number | undefined} ms
 * @example
 * await timer(3000);
 */
function taskTimer(ms) {
	return new Promise(res => setTimeout(res, ms));
}

/**
 * Scan definitions
 * @param {string} word
 * param {number} indexWord
 */
async function scanner(word) {
	const url = new URL(definitions.url);
	url.searchParams.append("dict", "burmese");
	url.searchParams.append("hasFocus", "orth");
	url.searchParams.append("approx", "");
	url.searchParams.append("orth", word);
	url.searchParams.append("phone", "");
	url.searchParams.append("def", "");
	url.searchParams.append("matchEntry", "any");
	url.searchParams.append("matchLength", "word");
	url.searchParams.append("matchPosition", "any");
	url.searchParams.append("anon", "on");
	url.searchParams.append("approxBurmese", "1");
	url.searchParams.append("ety", "");
	url.searchParams.append("pos", "");
	url.searchParams.append("usage", "");
	url.searchParams.append("subject", "");
	url.searchParams.append("useTags", "1");
	const dom = await JSDOM.fromURL(url.href, { referrer: url.href });
	// const dom = await JSDOM.fromFile("./docs/sea/med/ka.html");
	// const dom = await JSDOM.fromFile("./docs/sea/med/mon-n.html");
	// const dom = await JSDOM.fromFile("./docs/sea/med/myan-n.html");
	// const dom = await JSDOM.fromFile("./docs/sea/med/test.html");

	var body = dom.window.document.querySelector("body");

	if (body) {
		/**
		 * @type {number}
		 */
		let indexEntry = -1;
		for (const e of body.children) {
			if (checkEntry(e)) {
				indexEntry = await generate(e, -1);
			}
			if (e.tagName == "DIV") {
				for (const i of e.children) {
					if (checkEntry(i)) {
						await generate(i, indexEntry);
					}
				}
			}
		}
		await keywords.write();
		await definitions.write();
	} else {
		throw "body not found";
	}
}

let indexWordBlock = -1;
/**
 * @param {Element} e
 * @param {number} indexEntry
 * @returns {Promise<number>} - Index
 */
async function generate(e, indexEntry) {
	let row = tagENTRY(e);
	if (indexEntry > -1) {
		// add id to relevant
		if (definitions.raw[indexEntry].rel.includes(row.id) == false) {
			definitions.raw[indexEntry].rel.push(row.id);
		}
	}
	// if (indexWord > -1) {
	// 	keywords.raw[indexWord].status++;
	// }

	const indexWord = keywords.raw.findIndex(e => e.word == row.word);
	if (indexWord > -1) {
		if (indexWordBlock != indexWord) {
			indexWordBlock = indexWord;
			// keywords.raw[indexWord].status++;
			keywords.raw[indexWord].status = 2;
		}
	} else {
		keywords.raw.push({ word: row.word, block: 0, status: 1 });
	}

	let index = definitions.raw.findIndex(e => e.id == row.id);
	if (index < 0) {
		return definitions.raw.push(row) - 1;
	}
	definitions.raw[index] = row;
	return index;
}

/**
 * TagName entry|subentry
 * formx: orth, [pron], phr?
 * [sense]: num, pos, def, usg?
 * @param {Element} e
 * @param {number} [level] - entry: 0, subentry: 1
 */
function tagENTRY(e, level = 0) {
	let tagName = e.tagName.toLowerCase();
	const row = tagFORM(e);
	const eSenses = e.querySelectorAll("sense");
	if (eSenses.length) {
		for (const eSense of eSenses) {
			let sense = tagSENSE(eSense);
			row.sense.push(sense);
		}
	} else {
		let pos = tagPOS(e);
		let def = tagDEF(e);
		if (pos != "" && def.length) {
			row.sense.push({ pos: pos, def: def });
		}
	}

	let usg = tagUSG(e, tagName + ">usg");
	if (usg) {
		row.usg = usg;
	}

	let ref = tagXR(e, tagName + ">xr");
	if (ref.length) {
		row.ref = ref;
	}

	let ety = tagETYM(e, tagName + ">etym");
	if (ety.length) {
		row.ety = ety;
	}
	let variant = tagVARIANT(e, tagName + ">variant");
	if (variant.length) {
		row.variant = variant;
	}
	return row;
}

/**
 * Get formx
 * @param {Element} e
 * @returns {base.TypeOfEntry}
 */
function tagFORM(e) {
	let x = e.querySelector("formx")?.children;
	/**
	 * @type {base.TypeOfEntry}
	 */
	let row = {
		id: attributes(e, "id"),
		word: "",
		type: "",
		pron: {},
		sense: [],
		// ety: [],
		// ref: [],
		// usg: {},
		rel: []
	};
	if (x) {
		for (const o of x) {
			if (o.tagName == "ORTH") {
				row.word = o.innerHTML;
				var type = o.getAttribute("type");
				if (type) {
					row.type = type.trim();
				}
			} else if (o.tagName == "PRON") {
				var notation = o.getAttribute("notation");
				if (notation) {
					// mlc ipa;
					row.pron[notation.toLowerCase()] = o.innerHTML.trim();
				}
			}
		}
	}
	return row;
}

/**
 * Get sense
 * @param {Element} e
 * @returns {base.TypeOfSense}
 */
function tagSENSE(e) {
	/**
	 * @type {base.TypeOfSense}
	 */
	const row = {
		pos: tagPOS(e),
		def: tagDEF(e)
	};

	let usg = tagUSG(e);
	if (usg) {
		row.usg = usg;
	}

	let ref = tagXR(e);
	if (ref.length) {
		row.ref = ref;
	}

	let ety = tagETYM(e);
	if (ety.length) {
		row.ety = ety;
	}
	return row;
}

/**
 * Get def
 * @param {Element} e
 *
 */
function tagDEF(e) {
	const elm = e.querySelector("def");
	/**
	 * @type {base.TypeOfDefinition[]}
	 */
	const row = [];
	if (elm) {
		if (elm.children.length) {
			// elm.innerHTML = strHack(elm.innerHTML)
			// 	.replace(/<xlangmat?[^>]+>(.*?)<\/xlangmat>/gm, " [lg:$1] ")
			// 	.replace(/<eg?[^>]+>(.*?)<\/eg>/gm, " [eg:$1] ")
			// 	.replace(/<xr?[^>]+>(.*?)<\/xr>/gm, " [$1] ")
			// 	.replace(/<lbl?[^>]+>(.*?)<\/lbl>/gm, "$1:")
			// 	.replace(/<ref?[^>]+>(.*?)<\/ref>/gm, "$1")
			// 	.replace(/<oref?[^>]+><\/oref>/gm, "~")
			// 	// .replace(/ {2,}]/g, "]")
			// 	.replace(/\[\s{2,}/g, "[")
			// 	.replace(/\s{2,}(]|\.)/g, "$1");
			elm.innerHTML = strHack(elm.innerHTML)
				.replace(/<xlangmat?[^>]+>(.*?)<\/xlangmat>/gm, " [lg:$1] ")
				.replace(/<eg?[^>]+>(.*?)<\/eg>/gm, " [eg:$1] ")
				.replace(/<xr?[^>]+>(.*?)<\/xr>/gm, " [$1] ")
				.replace(/<lbl?[^>]+>(.*?)<\/lbl>/gm, "$1:")
				.replace(/<ref?[^>]+>(.*?)<\/ref>/gm, "$1");
		}
		if (elm.textContent) {
			row.push(strClean(elm.textContent));
		}
	}

	return row;
}

/**
 * Get etym
 * @param {Element} e
 * @param {string} [name]
 * @returns {string[]}
 * @example
 * "<b>N</b>, I' <b>30</b> s <b>b</b>.".replace(/<b>(.*?)<\/b>/g, "$1");
 * /<b [^>]+>(.*?)<\/b>/g;
 * /<b?[^>]+>(.*?)<\/b>/g;
 */
function tagETYM(e, name = "etym") {
	const raw = e.querySelectorAll(name);
	const row = [];
	for (const elm of raw) {
		elm.innerHTML = strHack(elm.innerHTML)
			.replace(/<lang?[^>]+>(.*?)<\/lang>/g, "$1:")
			.replace(/<misc?[^>]+>(.*?)<\/misc>/g, " ")
			.replace(/<mention?[^>]+>(.*?)<\/mention>/g, "$1;");
		if (elm.textContent) {
			row.push(strClean(elm.textContent));
		}
	}
	return row;
}

/**
 * Get variant
 * @param {Element} e
 * @param {string} [name]
 * @returns {string[]}
 */
function tagVARIANT(e, name = "variant") {
	const raw = e.querySelectorAll(name);
	const row = [];
	for (const elm of raw) {
		elm.innerHTML = strHack(elm.innerHTML)
			.replace(/<lbl?[^>]+>(.*?)<\/lbl>/g, "[$1:")
			.replace(/<misc?[^>]+>(.*?)<\/misc>/g, " ")
			.replace(/<vorth?[^>]+>(.*?)<\/vorth>/g, "$1]");
		if (elm.textContent) {
			row.push(strClean(elm.textContent));
		}
	}
	return row;
}

/**
 * Get xr
 * @param {Element} e
 * @param {string} [name]
 * @returns {string[]}
 * @example
 */
function tagXR(e, name = "xr") {
	const row = [];
	const raw = e.querySelectorAll(name);
	for (const elm of raw) {
		elm.innerHTML = strHack(elm.innerHTML)
			.replace(/<lang?[^>]+>(.*?)<\/lang>/g, "$1:")
			.replace(/<misc?[^>]+>(.*?)<\/misc>/g, " ")
			.replace(/<mention?[^>]+>(.*?)<\/mention>/g, "$1;")
			.replace(/<lbl?[^>]+>(.*?)<\/lbl>/gm, "[$1:")
			.replace(/<ref?[^>]+>(.*?)<\/ref>/gm, "$1]");
		if (elm.textContent) {
			row.push(strClean(elm.textContent));
		}
	}

	return row;
}

/**
 * Get usg
 * @param {Element} e
 * @param {string} [name]
 * returns {{type:string, usage:string }}
 * @returns {base.TypeOfUsage|null}
 * @example
 * <usg type="REG" usage="colloq">?</usg>
 */
function tagUSG(e, name = "usg") {
	const raw = e.querySelector(name);
	/**
	 * @type {base.TypeOfUsage}
	 */
	let row = {
		type: ""
	};
	if (raw) {
		let usage = attributes(raw, "usage");
		let subject = attributes(raw, "subject");
		// return {
		// 	type: attributes(raw, "type"),
		// 	usage: attributes(raw, "usage")
		// };
		row.type = attributes(raw, "type");
		if (usage != "") {
			row.usage = usage;
		}
		if (subject != "") {
			row.subject = subject;
		}
		return row;
	}
	return null;
}

/**
 * Get pos
 * @param {Element} e
 * @param {string} [name]
 * @returns {string}
 * @example
 * <pos>ppm</pos>
 */
function tagPOS(e, name = "pos") {
	const raw = e.querySelector(name);

	if (raw?.textContent) {
		return raw.textContent;
	}
	return "";
}

/**
 * Get attributes context
 * @param {Element} e
 * @param {string} name
 * @returns {string}
 * @example
 * attributes(element, attrName)
 */
function attributes(e, name) {
	let attr = e.getAttribute(name);
	if (attr) {
		if (name == "id") {
			// med93:103.8;
			let idAttribute = attr.split(":");
			if (idAttribute?.length == 2) {
				return idAttribute[1].trim();
			}
		} else {
			return attr.trim();
		}
	}
	return "";
}

/**
 * check tag is entry or subentry
 * @param {Element} e
 * @returns {boolean}
 */
function checkEntry(e) {
	return e.tagName == "ENTRY" || e.tagName == "SUBENTRY";
}
/**
 * Replace for common
 * @param {string} str
 * @returns {string}
 */
function strHack(str) {
	return str
		.replace(/(\r\n|\n|\r)/g, " ")
		.replace(/<(\/?)OREF>/g, "")
		.replace(/<(\/?)MISC>/g, "")
		.replace(/<oref?[^>]+><\/oref>/gm, "~");
	// .replace(/&(lt|gt);/g, "")
}

/**
 * Format and remove unwanted spaces, line break
 * @param {string} str
 * @returns {string}
 */
function strClean(str) {
	return str
		.replace(/(၊|။)/g, "$1 ")
		.replace(/(\[|\()\s{2,}/g, "$1")
		.replace(/\s{2,}(\]|\)|\.)/g, "$1")
		.replace(/ \)/g, ")")
		.replace(/ ]/g, "]")
		.replace(/(\s+)/g, " ")
		.replace(/;]/g, "]")
		.replace(/ \./g, ".")
		.trim();
}
