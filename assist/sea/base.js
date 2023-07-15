import { seek, config, db } from "lethil";

/**
 * @typedef {Object} TypeOfAlphabets
 * @property {string} char
 * @property {string} des
 * @property {number[]} code
 *
 * @typedef {Object} TypeOfKeywords
 * @property {string} word
 * @property {number} block
 * @property {number} status
 *
 * @typedef {Object} TypeOfEntry - TypeOfEntry
 * @property {string} id
 * @property {string} word
 * @property {string} type
 * @property {any} pron
 * @property {TypeOfSense[]} sense
 * @property {string[]} [ety]
 * @property {string[]} [ref]
 * @property {TypeOfUsage} [usg]
 * @property {string[]} [variant]
 * @property {string[]} rel - relevant
 *
 * @typedef {Object} TypeOfSense
 * @property {string} pos
 * @property {string[]} [ref] -xr
 * @property {TypeOfUsage} [usg]
 * @property {TypeOfDefinition[]} def
 * @property {string[]} [ety]
 *
 * @typedef {string} TypeOfDefinition - definition child
 *
 * @typedef {Object} TypeOfPronunciation - definition child
 * @property {string} mlc
 * @property {string} ipa
 *
 * @typedef {Object<string,string>} TypeOfUsage - definition child
 * @property {string} type
 * @property {string} [usage]
 * @property {string} [subject]
 *
 *
 * @typedef {Object} ListOfAlphabet
 * @property {TypeOfAlphabets[]} letter
 * @property {TypeOfAlphabets[]} superscript
 * @property {TypeOfAlphabets[]} subscript
 * @property {TypeOfAlphabets[]} vowel
 * @property {TypeOfAlphabets[]} sign
 * @property {TypeOfAlphabets[]} consonant
 * @property {TypeOfAlphabets[]} symbol
 * @property {TypeOfAlphabets[]} digit
 *
 * @typedef {Object} TypeOfUrl
 * @property {Object<string,string>} data
 * @property {(file:string?)=>string} join
 * @property {string} alphabets
 * @property {string} keywords
 * @property {string} definitions
 *
 */

/**
 * Settings
 */
const settings = {
	url: {
		root: "",
		alphabets: "",
		keywords: "",
		definitions: ""
	},
	file: {
		alphabets: "",
		keywords: "",
		definitions: "",
		wordlist: ""
	}
};

/**
 * Load settings
 */
async function load() {
	const file = resolve("settings.json");
	const data = await readJSON(file, settings);
	Object.assign(settings, data);
}

await load();
/**
 * @param {string} file
 */
function resolve(file) {
	return seek.resolve(config.media, "sea", file);
}

const url = {
	get alphabets() {
		return url.join(settings.url.alphabets);
	},
	get keywords() {
		return url.join(settings.url.keywords);
	},
	get definitions() {
		return url.join(settings.url.definitions);
	},
	/**
	 *
	 * @param {string} pathname
	 * @example .get(settings.url.alphabets)
	 */
	join(pathname) {
		if (pathname) {
			return settings.url.root + pathname;
		}
		return settings.url.root;
	}
};

const file = {
	get alphabets() {
		return resolve(settings.file.alphabets);
	},
	get keywords() {
		return resolve(settings.file.keywords);
	},
	get definitions() {
		return resolve(settings.file.definitions);
	},
	get wordlist() {
		return resolve(settings.file.wordlist);
	}
};

/**
 * Myanmar unicode number to string from [\u1000] [1000] -> 0x1000
 * @param {number[]} code
 * @example
 * codeToString([1039,1001])
 */
export function codeToString(code) {
	// @ts-ignore
	return code.map(e => String.fromCharCode("0x" + e)).join("");
}

/**
 * @template T
 * @param {string} file
 * @param {T} raw
 * @returns {Promise<T>}
 */
async function readJSON(file, raw) {
	return seek.ReadJSON(file, raw);
}

/**
 * @template T
 * @param {string} file
 * @param {T} raw
 * @returns {Promise<boolean>}
 */
async function writeJSON(file, raw) {
	return seek.WriteJSON(file, raw, 2);
}

// export const wordlist = {
// 	file: file.wordlist,
// 	/**
// 	 * @type {string[]}
// 	 */
// 	raw: [],
// 	read: async function() {
// 		wordlist.raw = await readJSON(wordlist.file, wordlist.raw);
// 		return wordlist.raw;
// 	},
// 	write: async function() {
// 		return writeJSON(wordlist.file, wordlist.raw);
// 	},
// 	test() {
// 		var flat = new db.flat({ file: file.wordlist });
// 		flat.readFlat();
// 	}
// };
export const wordlist = {
	file: file.wordlist,
	flat: new db.flat({ file: file.wordlist }),
	/**
	 * @type {Array<{v:string}>}
	 */
	raw: [],
	read: async function() {
		wordlist.raw = await wordlist.flat.readJSON();
		// return new Promise(function(resolve, reject) {
		// 	try {
		// 		var reader = wordlist.flat.readFlat();
		// 		reader.on("finish", raw => {
		// 			wordlist.raw = raw;
		// 			resolve("reader.finish");
		// 			console.log("finish");
		// 		});
		// 		reader.on("error", error => {
		// 			resolve(error);
		// 			console.log(error.message);
		// 		});
		// 	} catch (error) {
		// 		console.log("error", error);
		// 		reject(error);
		// 	}
		// });
	},
	write: async function() {
		return wordlist.flat.writeJSON({ raw: wordlist.raw });
		// return new Promise(function(resolve, reject) {
		// 	try {
		// 		var writer = wordlist.flat.writeFlat({
		// 			raw: wordlist.raw,
		// 			suffix: ".abc"
		// 			// header: ["word"]
		// 		});
		// 		writer.on("finish", () => {
		// 			console.log("finish");
		// 			resolve("finish");
		// 		});
		// 	} catch (error) {
		// 		reject(error);
		// 	}
		// });
	}
};

export const alphabets = {
	url: url.alphabets,
	file: file.alphabets,
	/**
	 * @type {ListOfAlphabet}
	 */
	raw: {
		letter: [],
		superscript: [],
		subscript: [],
		vowel: [],
		sign: [],
		consonant: [],
		symbol: [],
		digit: []
	},
	read: async function() {
		alphabets.raw = await readJSON(alphabets.file, alphabets.raw);
		return alphabets.raw;
	},
	write: async function() {
		return writeJSON(alphabets.file, alphabets.raw);
	}
};

export const keywords = {
	url: url.keywords,
	file: file.keywords,
	/**
	 * @type {TypeOfKeywords[]}
	 */
	raw: [],
	read: async function() {
		keywords.raw = await readJSON(keywords.file, keywords.raw);
		return keywords.raw;
	},
	write: async function() {
		return writeJSON(keywords.file, keywords.raw);
	}
	// /**
	//  *
	//  * @param {TypeOfKeywords} row
	//  * @param {number} [status]
	//  */
	// update: function(row, status = 0) {
	// 	const indexWord = keywords.raw.findIndex(e => e.word == row.word);
	// 	if (indexWord > -1) {
	// 		keywords.raw[indexWord].status = status;
	// 	} else {
	// 		keywords.raw.push(row);
	// 	}
	// }
};

export const definitions = {
	url: url.definitions,
	file: file.definitions,
	/**
	 * @type {TypeOfEntry[]}
	 */
	raw: [],
	read: async function() {
		definitions.raw = await readJSON(definitions.file, definitions.raw);
		return definitions.raw;
	},
	write: async function() {
		return writeJSON(definitions.file, definitions.raw);
	}
};

// export class Data {
// 	/**
// 	 * @template T
// 	 * @param {T} raw
// 	 */
// 	constructor(raw) {
// 		this.raw = raw;
// 	}
// }
