import { JSDOM } from "jsdom";
// import * as csv from "csv";
import { seek, config } from "lethil";
// import { env } from "../anchor/index.js";

/**
 * @typedef {{sense:string, exam:string[], syn:string[]}} TypeOfClue
 * @typedef {{k:string, w:string, p:string, v:TypeOfClue[]}} TypeOfRequestDef
 * @typedef {{of:string[], also:string}} TypeOfUsage
 * @typedef {{w:string,p:string, usage?:TypeOfUsage, def:TypeOfRequestDef[], derived:string[], type:string[], part:string[], antonym:string[], see:string[]}} TypeOfRequest
 * @typedef {{k:string, v:TypeOfClue[]}} TypeOfDefinitionDef
 * @typedef {{w:string,p:string, usage?:TypeOfUsage, def:TypeOfDefinitionDef[], derived:string[], type:string[], part:string[], antonym:string[], see:string[]}} TypeOfRequestDefinition
 *
 * @typedef {object} TypeOfWord
 * @property {string} word - word
 * @property {number} derived - is derived
 * @property {number?} s - status
 */
export const settings = {
	dir: seek.resolve(config.media, "wow"),
	url: {
		root: ""
	},
	file: {
		word: "",
		def: ""
	},
	progress: {
		current: ""
	}
};

/**
 * @type {{words:TypeOfWord[], defs:TypeOfRequestDefinition[]}}
 */
export const data = {
	words: [],
	defs: []
};

/**
 * Load settings
 */
async function _init() {
	const file = resolve("settings.json");
	const _settings = await readJSON(file, settings);
	Object.assign(settings, _settings);

	settings.file.word = resolve(settings.file.word);

	const _words = await readJSON(settings.file.word, data.words);
	Object.assign(data.words, _words);

	settings.file.def = resolve(settings.file.def);
	const _definitions = await readJSON(settings.file.def, data.defs);
	Object.assign(data.defs, _definitions);
}

await _init();

/**
 * @param {string} file
 */
function resolve(file) {
	return seek.resolve(settings.dir, file);
}

/**
 * @template T
 * @param {string} file
 * @param {T} raw
 * @returns {Promise<T>}
 */
async function readJSON(file, raw) {
	return seek.readJSON(file, raw);
}

/**
 * Write words file
 */
export async function writeWord() {
	return await seek.writeJSON(settings.file.word, data.words, 2);
}

/**
 * Write definitions file
 */
export async function writeDef() {
	return await seek.writeJSON(settings.file.def, data.defs, 2);
}

// --------------------------------------------------------------------------------------

/**
 * ExtractPortion requestfromURL
 * <body>?</body>
 * @param {string} word
 * @returns {Promise<Document>}
 */
export async function requestfromURL(word) {
	const keyword = word.replace(/\W/g, "").toUpperCase();
	const url = settings.url.root.replace("*", keyword);
	const dom = await JSDOM.fromURL(url);
	let eHtml = dom.window.document.getElementsByTagName("html")[0];
	let eBody = eHtml.getElementsByTagName("body")[0];
	let eTable = eBody.getElementsByTagName("table")[0];
	let eTbody = eTable.getElementsByTagName("tbody")[0];
	let eTrow = eTbody.getElementsByTagName("tr")[0];
	let wowHtml = eTrow.getElementsByTagName("td")[1];

	wowHtml.querySelector("div#mac")?.remove();
	wowHtml.querySelector("div#windows")?.remove();
	wowHtml.querySelector("script")?.remove();
	wowHtml.querySelector("br")?.remove();
	wowHtml.querySelector("br")?.remove();

	const wowContext = wowHtml.innerHTML
		.replace(/<br>/g, "\n")
		.replace(/&nbsp;/g, " ")
		.replace(/\n\s*\n/g, "\n")
		.replace(/\s\s+/g, " ");
	// const wowContext = wow.outerHTML;

	const wowBody = "<body>?</body>".replace("?", wowContext);
	return new JSDOM(wowBody).window.document;
}

/**
 * Testing requestfromFile
 * @param {string} file
 * @returns {Promise<Document>}
 */
export async function requestfromFile(file) {
	// const dom = await JSDOM.fromFile("./docs/tmp/wow-tree.html");
	// const dom = await JSDOM.fromFile("./docs/tmp/wow-request-flavour.html");
	const dom = await JSDOM.fromFile(file);
	// return examine(dom.window.document);
	return dom.window.document;
}

/**
 * Only for development
 * @example fourth dimension -> fourth-dimension
 * @example Tree -> tree
 * @param {string} word
 * @returns {string} of full path, `../test-request-?.html`
 */
export function requestFileName(word) {
	let fileWord = word.replace(/\W/g, "-").toLowerCase();
	let fileName = "test-request-?.html".replace("?", fileWord);
	return seek.resolve(settings.dir, "tmp", fileName);
}

/**
 * Extract html>body and format to json
 * @param {Document} doc
 * @returns {TypeOfRequest}
 */
export function examine(doc) {
	let body = doc.getElementsByTagName("body")[0];
	/**
	 * @type {TypeOfRequest}
	 */
	const res = {
		w: "",
		p: "",
		usage: undefined,
		def: [],
		derived: [],
		antonym: [],
		type: [],
		part: [],
		see: []
	};
	if (body) {
		let wordPos = "";
		let wordValue = "";
		let wordPron = "";
		const wowChildren = body.children;
		for (let index = 0; index < wowChildren.length; index++) {
			const e = wowChildren[index];
			const tagName = e.nodeName;

			const tagClass = e.getAttribute("class");

			// NOTE: span.head, span.key, span.pron
			if (tagName == "SPAN") {
				// const tagContext = e.textContent || "";
				const tagContext = e.innerHTML || "";

				if (tagClass == "head") {
					wordPos = wordTypeFormat(tagContext);
				}
				if (tagClass == "key") {
					wordValue = wordValueFormat(tagContext);
					if (res.w == "") {
						res.w = wordValue;
					}
				}
				if (tagClass == "pron") {
					wordPron = wordPronFormat(tagContext);
					if (res.p == "") {
						res.p = wordPron;
					}
				}
				if (tagClass == "use") {
					let wordUsage = wordUsageFormat(tagContext);
					if (wordUsage) {
						res.usage = wordUsage;
					}
				}
			}
			// sense:[], exam:[], syno: [] []
			if (tagName == "OL") {
				/**
				 * @type {TypeOfRequestDef}
				 */
				let defBlock = {
					k: wordPos,
					w: "",
					p: "",
					v: []
				};
				if (wordValue != res.w) {
					defBlock.w = wordValue;
				}
				if (wordPron != res.p) {
					defBlock.p = wordPron;
				}

				let _li = e.querySelectorAll("li");
				if (_li) {
					for (let index = 0; index < _li.length; index++) {
						/**
						 * @type {TypeOfClue}
						 */
						let clueBlock = {
							sense: "",
							exam: [],
							syn: []
						};
						const _val = _li[index];

						let _def_sense = _val.querySelector("span.def")?.innerHTML;
						if (_def_sense) {
							let sense = linkFormat(_def_sense);
							clueBlock.sense = senseFormat(sense);
						}
						let _def_exam = _val.querySelector("span.ex")?.innerHTML;
						if (_def_exam) {
							let exam = linkFormat(_def_exam);
							clueBlock.exam = examFormat(exam);
						}

						let _def_syn = _val.querySelectorAll("a.syn");
						// _def_sense, def_exam, def_syn

						if (_def_syn.length) {
							for (let index = 0; index < _def_syn.length; index++) {
								const _val = _def_syn[index];
								clueBlock.syn.push(_val.innerHTML);
							}
						}
						defBlock.v.push(clueBlock);
					}
				}
				res.def.push(defBlock);
			}
			// NOTE: p.rellnk
			if (tagName == "P") {
				if (tagClass == "rellnk") {
					let _seealso = e.getElementsByTagName("span")[0];
					// let _seealso = e.getElementsByTagName("span.seealso")[0];
					if (_seealso) {
						let _relName = refNameFormat(_seealso.innerHTML);
						if (_relName == "derived") {
							// NOTE: comma seperated
							res[_relName] = relContextFormat(e);
						}
						if (_relName == "type") {
							// NOTE: link seperated
							res[_relName] = relContextFormat(e, true);
						}
						if (_relName == "part") {
							// NOTE: link seperated
							res[_relName] = relContextFormat(e, true);
						}
						if (_relName == "antonym") {
							// NOTE: link seperated
							res[_relName] = relContextFormat(e, true);
						}
						if (_relName == "see") {
							// NOTE: link seperated
							res[_relName] = relContextFormat(e, true);
						}
					}
				}
			}
		}
	}
	return res;
}

/**
 * such as: Derived forms, Type of, Part of, See also
 * @param {Element} e
 * @param {boolean?} type - <a></a> -> 1 else -1
 * @returns {string[]}
 */
function relContextFormat(e, type = false) {
	/**
	 * @type {string[]}
	 */
	let _list = [];
	e.querySelector("span.seealso")?.remove();
	if (type) {
		let _a = e.querySelectorAll("a");
		if (_a) {
			for (let index = 0; index < _a.length; index++) {
				const _val = _a[index];
				_list.push(_val.innerHTML);
			}
		}
	} else {
		_list = e.innerHTML.split(",").map(i => i.trim());
	}
	if (_list) {
		const _listSet = [...new Set(_list)];
		return _listSet.map(s => s.trim()).filter(x => x);
	}
	return _list;
}

/**
 * span class="head"
 * @returns {string}
 * @param {string} e
 */
function wordTypeFormat(e) {
	let name = strTrim(e).toLowerCase();
	// let tmp = env.synset.find(e => e.name == name);
	// if (tmp) {
	// 	return tmp.id;
	// }
	return name;
}

/**
 * flavor, centre
 * Usage: Brit, Cdn (<i>US</i>: <a>flavor</a>) -> Brit, Cdn (US: <flavor>)
 * Usage: Usage: US (<i>elsewhere</i>: <a>centre</a>) -> US (elsewhere: <flavor>)
 * Usage: Usage: US (<i>elsewhere</i>: <a>centre</a>) -> US (elsewhere: <centre>)
 * Usage: Usage: Brit, Cdn (<i>US</i>: <a>center</a>) -> Brit, Cdn (US: <center>)
 * [Brit, Cdn]
 * @param {string} e
 * @returns {TypeOfUsage}
 */
function wordUsageFormat(e) {
	// of else ofUsage elseUsage
	// .replace(/\(([^)]+)\)/,"<$1>")
	// return linkFormat(e.replace(/Usage:/g, ""));
	let eVal = linkFormat(e.replace(/Usage:/g, ""));
	const res = {};
	const regx = /\(([^)]+)\)/;
	// let eVal = "Brit, Cdn (elsewhere: <flavor>)";
	let eMatch = eVal.match(regx);
	if (eMatch) {
		let useOf = eVal
			.replace(regx, "")
			.split(",")
			.map(x => x.trim())
			.filter(x => x);
		res.of = useOf;
		if (eMatch.length > 1) {
			let useAlso = eMatch[1];
			res.also = useAlso.replace("elsewhere", "also");
		}
	}
	return res;
}

/**
 * span class="key"
 * @returns {string}
 * @param {string} e
 */
function wordValueFormat(e) {
	return strTrim(e);
}

/**
 * span class="pron"
 * @returns {string}
 * @param {string} e
 */
function wordPronFormat(e) {
	return strTrim(e).toLowerCase();
}

/**
 * Derived forms, Type of, Part of, Encyclopedia
 * @returns {string} - `[derived, type, part, encyclopedia]`
 * @param {string} e
 */
function refNameFormat(e) {
	let tmp = strTrim(e).split(" ")[0];
	return tmp.toLowerCase();
}

/**
 * Remove (:), trim then lowercase
 * wordTrim .replace(/\W/g, "")
 * @returns {string}
 * @param {string} e
 */
function strTrim(e) {
	return e.replace(/:/g, " ").trim();
}

/**
 * Format src links
 * @exam `A <a href="*">genealogical</a> tree` -> `A <genealogical> tree`
 * @returns {string}
 * @param {string} e
 */
function linkFormat(e) {
	return e
		.replace(/\n/g, " ")
		.replace(/\t/g, " ")
		.replace(/\s\s+/g, " ")
		.replace(/Ã¨/g, "é")
		.replace(/Ã©/g, "é")
		.replace(/<i[^>]*>([\s\S]*?)<\/i>/g, "$1")
		.replace(/<a[^>]*>([\s\S]*?)<\/a>/g, "<$1>")
		.trim();
}

/**
 * Format example split by ; trim then remove empty
 * @exam `a; b;` -> `[a,b]`
 * @returns {string[]}
 * @param {string} e
 */
function examFormat(e) {
	return e
		.replace(/\"/g, "")
		.split(";")
		.map(e => e.trim())
		.filter(x => x);
}

/**
 * Format sense trim then remove empty
 * @exam `<span class="use">[Brit, informal] </span>A <friendly> <form of address>` -> `[Brit, informal] A <friendly> <form of address>`
 * @returns {string}
 * @param {string} e
 */
function senseFormat(e) {
	return e
		.replace(/<span[^>]*>([\s\S]*?)<\/span>/g, " $1 ")
		.replace(/\s\s+/g, " ")
		.trim();
}
