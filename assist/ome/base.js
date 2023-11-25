import { medCore } from "../anchor/seed.js";

/**
 * @typedef {object} rowSuggestion - sw, sl, st
 * @property {string} w - word
 * @property {string[]} [l] - list
 * @property {number} [n] - number of count
 * @property {boolean} [test]
 * typedef {string[]} raw
 */
// const medCore = new medClass();
export default {
	seed: medCore,
	/**
	 * *.slice(0, 6);
	 * @param {any} query
	 * @returns {Promise<rowSuggestion[]>}
	 */
	suggestWord: async function(query) {
		const words = await this.seed.words();
		/**
		 * @type {Array<rowSuggestion>}
		 */
		const res = [];

		const word = query.q;

		if (word == undefined || word == "") {
			// return words.slice(0, 6);
			return words.slice(0, 6).map(e => {
				return {
					w: e.word,
					n: 1,
					t: 0
				};
			});
		}
		const _wordCount = word.length;
		const _length = _wordCount + 1;

		// return words.rawlist.filter(w => w.startsWith(word));
		let startWith = words
			.sort()
			.filter(e => e.word.startsWith(word))
			.map(e => e.word);

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
