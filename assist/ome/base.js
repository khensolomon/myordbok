import { wordMyanmar } from "../anchor/seed.js";

/**
 * @typedef {object} rowSuggestion - sw, sl, st
 * @property {string} w - word
 * @property {string[]} [l] - list
 * @property {number} [n] - number of count
 * @property {boolean} [test]
 * @typedef {string[]} raw
 */

export const words = {
	seed: new wordMyanmar(),
	/**
	 * @type {raw}
	 */
	raw: [],

	/**
	 * Read a file
	 */
	read: async function() {
		try {
			await this.seed.read();
			words.raw = this.seed.raw.map(o => o.v);
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
	 * *.slice(0, 6);
	 * @param {any} query
	 */
	suggest: function(query) {
		/**
		 * @type {Array<rowSuggestion>}
		 */
		const res = [];

		const word = query.q;

		if (word == undefined || word == "") {
			return words.raw.slice(0, 6);
		}
		const _wordCount = word.length;
		const _length = _wordCount + 1;

		// return words.rawlist.filter(e => e.startsWith(word));
		let startWith = words.raw
			.sort()
			.filter(e => e.startsWith(word))
			.map(e => e.trim());

		if (startWith.length <= 20) {
			return startWith.map(e => {
				return {
					w: e,
					n: 1,
					t: 0
				};
			});
		}

		// console.log("startWith", startWith.length);
		let limitWith = startWith.map(e => e.slice(0, _length));
		let cat = [...new Set(limitWith)];
		// let _catCount = cat.length;

		// for (const w of cat) {
		// 	let sl = startWith.filter(e => e.startsWith(w));
		// 	let st = sl.length;
		// 	res.push({
		// 		w: st == 1 ? sl[0] : w,
		// 		// sl: sl,
		// 		n: st
		// 	});
		// }
		// if (_catCount == 1) {
		// 	return startWith.map(e => {
		// 		return {
		// 			w: e,
		// 			n: 1
		// 		};
		// 	});
		// } else {
		// 	return cat.map(w => {
		// 		let sl = startWith.filter(e => e.startsWith(w));
		// 		let st = sl.length;
		// 		return {
		// 			w: st == 1 ? sl[0] : w,
		// 			n: st
		// 		};
		// 	});
		// }
		for (const w of cat) {
			let sl = startWith.filter(e => e.startsWith(w));
			let st = sl.length;
			res.push({
				// v: st == 1 ? sl[0] : w,
				w: st == 1 ? sl[0] : w,
				// sl: sl,
				n: st
			});
		}

		return res;
	}
};
