import { wordSource } from "../anchor/seed.js";

/**
 * @typedef {string[]} raw
 */

export const words = {
	/**
	 * raw converted into 1D array, which is just {string[]}
	 * @type {raw}
	 */
	raw: [],

	/**
	 * @todo cookie lang
	 * @param {string} lang
	 * @returns {Promise<raw>}
	 */
	read: async function(lang) {
		try {
			let ob = new wordSource({ lang: lang });
			await ob.read();
			words.raw = ob.raw.map(o => o.v);
		} catch (error) {
			return [];
		} finally {
			return words.raw;
		}
	},

	/**
	 * @param {any} query
	 */
	list: function(query) {
		let actualSize = words.size();
		if (query.size) {
			if (query.size == actualSize) {
				return [];
			}
		}
		return words.raw;
	},

	/**
	 * param {any} [query]
	 */
	size: function() {
		return JSON.stringify(words.raw).length;
	},

	/**
	 * @param {any} query
	 */
	suggest: function(query) {
		let word = query.q;

		if (word == undefined || word == "") {
			return words.raw.slice(0, 6);
		}

		const res = [];
		var count = 0;
		const raw = words.raw;
		for (let index = 0; index < raw.length; index++) {
			const elm = raw[index];
			if (elm.toLowerCase().startsWith(word.toLowerCase())) {
				res.push(elm);
				count++;
			}
			if (count >= 6) {
				break;
			}
		}
		return res;
	}
};
