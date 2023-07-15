import { defineStore } from "pinia";
import axios from "axios";
import tools from "./tools.js";

import { useStorageStore } from "./store-storage.js";

/**
 * @typedef {object} wordList
 * @property {string} w - word
 * @property {number} [n] - word count
 */

export const useSearchStore = defineStore("search", {
	state: () => ({
		currentQuery: "",
		previousQuery: "",
		/**
		 * Get references from parent
		 * @type {any}
		 * @example
		 * this.$refs.searchForm != null && this.$refs.searchInput
		 * this.$refs.searchInput.focus();
		 */
		$refs: {},

		/**
		 * 0: unfocus
		 * 1: default activated input
		 * 2: focused
		 */
		focusStatus: 1,
		focusOverride: false,
		suggestionIndex: -1,

		my: {
			api: {
				wordList: "tsil/drow/dem/ipa/",
				wordSuggests: "stseggus/drow/dem/ipa/",
				wordSize: "ezis/drow/dem/ipa/"
			},
			alphabet: [
				"က",
				"ခ",
				"ဂ",
				"ဃ",
				"င",
				"စ",
				"ဆ",
				"ဇ",
				"ဈ",
				"ည",
				"ဋ",
				"ဌ",
				"ဍ",
				"ဎ",
				"ဏ",
				"တ",
				"ထ",
				"ဒ",
				"ဓ",
				"န",
				"ပ",
				"ဖ",
				"ဗ",
				"ဘ",
				"မ",
				"ယ",
				"ရ",
				"လ",
				"၀",
				"သ",
				"ဟ",
				"ဠ",
				"အ"
			],
			digit: ["၀", "၁", "၂", "၃", "၄", "၅", "၆", "၇", "၈", "၉"],
			symbol: ["ဣ", "ဤ", "ဥ", "ဦ", "ဧ", "ဩ", "ဪ", "ဿ", "၌", "၍", "၎", "၏", "ဉ"],
			sign: [],
			vowel: [
				"ါ",
				"ာ",
				"ိ",
				"ီ",
				"ု",
				"ူ",
				"ေ",
				"ဲ",
				"ံ",
				"့",
				"း",
				"်",
				"ျ",
				"ြ",
				"ွ",
				"ှ"
			],
			consonant: [],
			subscript: [],
			word: [],

			/**
			 * @type {Array<wordList>}
			 */
			suggests: [],
			/**
			 * mewl mewr
			 * local storage key word list
			 */
			idLocal: "mewl",
			/**
			 * local storage key recent word list
			 */

			idRecent: "mewr"
		},
		en: {
			api: {
				wordList: "tsil/drow/doe/ipa/",
				wordSuggests: "stseggus/drow/doe/ipa/",
				wordSize: "ezis/drow/doe/ipa/"
			},
			/**
			 * @type {Array<wordList>}
			 */
			suggests: [],
			/**
			 * local storage key word list
			 */
			idLocal: "eowl",
			/**
			 * local storage key recent word list
			 * org: word
			 */
			idRecent: "eowr"
		}
	}),
	getters: {
		storageStore: () => useStorageStore(),
		// doubleCount: state => state.count * 2,
		// lastIndex: state => state.en.suggests.length - 1,
		// storage: state => state.storageStore,
		// isMyanmarQuery: state => /[\u1000-\u109F]/.test(state.currentQuery),
		isMyanmarQuery: state => tools.isMyanmarText(state.currentQuery),
		// showSuggestion: state => state.focusStatus == 2,

		/**
		 * @returns {HTMLCollectionOf<HTMLFormElement>}
		 * @example
		 * tools.selectElement('name="search"')
		 * document.forms["search"]
		 * searchForm: () => document.forms["search"],
		 */
		searchForm: state => state.$refs.searchForm,

		/**
		 * @returns {HTMLElement | null}
		 * @example
		 * tools.selectElement('input[name="q"]')
		 * searchInput: () => tools.selectElement('input[name="q"]'),
		 */
		searchInput: state => state.$refs.searchInput,

		// tmpsuggestionList: () => tools.allElement("li.word>p.suggestion"),
		suggestions: state => [...state.my.suggests, ...state.en.suggests],

		focusClass(state) {
			switch (state.focusStatus) {
				case 2:
					return "active";
				case 1:
					return "focus";
				default:
					return "none-of";
			}
		}
	},
	actions: {
		/**
		 * true: Myanmar, false: Other
		 * @param {boolean} e
		 * @example
		 * return e ? this.my.idRecent : this.en.idRecent;
		 */
		recentId(e) {
			return e ? this.my.idRecent : this.en.idRecent;
		},

		/**
		 * @param {string} w
		 */
		recentSave(w) {
			let id = this.recentId(tools.isMyanmarText(w));
			this.storageStore.setItemAsList(id, w);
		},

		/**
		 * get 7 words of most recentMost
		 * @param {boolean} tst - true: Myanmar, false: Other
		 */
		recentMost(tst) {
			let id = this.recentId(tst);
			let lst = this.storageStore.getItemAsList(id).slice(0, 6);
			return lst.map(w => {
				return { w: w };
			});
		},

		/**
		 * get all recent
		 * @param {boolean} tst - true: Myanmar, false: Other
		 */
		recentList(tst) {
			let id = this.recentId(tst);
			return this.storageStore.getItemAsList(id);
		},

		/**
		 * get all word
		 * @param {boolean} tst - true: Myanmar, false: Other
		 */
		wordList(tst) {
			let id = tst ? this.my.idLocal : this.en.idLocal;
			return this.storageStore.getItemAsList(id);
		},

		/**
		 * @param {number} [size]
		 */
		async loadWM(size = 0) {
			await axios
				.get(tools.reverse(this.my.api.wordList), {
					params: { size: size }
				})
				.then(
					res => this.storageStore.setItemAsObject(this.my.idLocal, res.data),
					() => new Array()
				);
		},

		/**
		 * @param {number} [size]
		 */
		async loadWE(size = 0) {
			return await axios
				.get(tools.reverse(this.en.api.wordList), {
					params: { size: size }
				})
				.then(
					res => this.storageStore.setItemAsObject(this.en.idLocal, res.data),
					() => new Array()
				);
		},

		/**
		 * English and other word suggest
		 * @param {string} q
		 */
		async suggestWE(q) {
			return await axios
				.get(tools.reverse(this.en.api.wordSuggests), {
					params: { q: q }
				})
				.then(
					res => {
						if (res && Array.isArray(res.data)) {
							return res.data.map(w => {
								return { w: w };
							});
						}
						return [];
					},

					() => new Array()
				);
		},

		/**
		 * Myanmar word suggest
		 * @param {string} word
		 */
		async suggestWM(word) {
			const res = [];
			let rawlist = this.wordList(true);
			const _wordLength = word.length;
			const _length = _wordLength + 1;

			let startWith = rawlist
				.sort()
				.filter(e => e.startsWith(word))
				.map(e => e.trim());

			/**
			 * 20, 30
			 */
			if (startWith.length <= 30) {
				return startWith.map(e => {
					return {
						w: e,
						n: 1
					};
				});
			}

			let limitWith = startWith.map(e => e.slice(0, _length));
			let cat = [...new Set(limitWith)];
			let _catCount = cat.length;

			if (_catCount == 1) {
				return startWith.map(e => {
					return {
						w: e,
						n: 1
					};
				});
			} else {
				// return cat.map(w => {
				// 	let sl = startWith.filter(e => e.startsWith(w));
				// 	let st = sl.length;
				// 	return {
				// 		w: st == 1 ? sl[0] : w,
				// 		n: st
				// 	};
				// });
				for (const w of cat) {
					let sl = startWith.filter(e => e.startsWith(w));
					let st = sl.length;
					res.push({
						w: st == 1 ? sl[0] : w,
						// sl: sl,
						n: st
					});
				}
			}

			return res;
		},

		/**
		 * @param {any} [w]
		 */
		updateQuery(w) {
			// if (w) {
			// 	return (this.currentQuery = w);
			// } else if (this.en.suggests[this.en.index]) {
			// 	this.currentQuery = this.en.suggests[this.en.index];
			// } else if (this.en.input) {
			// 	this.currentQuery = this.en.input;
			// }

			if (w) {
				this.currentQuery = w;
			} else {
				this.currentQuery = this.suggestions[this.suggestionIndex].w;
			}
		},

		/**
		 * Update suggestion list on updateInput
		 */
		async updateInput() {
			this.focusStatus = 2;

			if (this.currentQuery) {
				this.previousQuery = this.currentQuery;
				if (this.isMyanmarQuery) {
					this.my.suggests = await this.suggestWM(this.currentQuery);
					this.en.suggests = [];
				} else {
					this.my.suggests = [];
					this.en.suggests = await this.suggestWE(this.currentQuery);
				}
			} else {
				this.en.suggests = this.recentMost(false);
				this.my.suggests = this.recentMost(true);
			}
			this.suggestionIndex = this.suggestions.findIndex(
				e => e.w == this.currentQuery
			);
		},

		/**
		 * @param {any} e
		 */
		form_clickOutsite(e) {
			this.focusStatus = 0;
			console.log("form_clickOutsite", this.focusStatus);
		},
		handleFocus() {
			this.focusStatus = 2;
			console.log("handleFocus", this.focusStatus);
		},
		handleFocusOut() {
			this.focusStatus = 0;
			console.log("handleFocusOut", this.focusStatus);
		},
		form_click() {
			this.searchInput?.focus();
			this.focusOverride = true;
			setTimeout(() => {
				this.focusOverride = false;
			}, 100);
		},
		async form_focusout() {
			new Promise(resolve => {
				setTimeout(() => {
					if (this.focusOverride) {
						this.focusStatus = 2;
					} else {
						this.focusStatus = 0;
					}
				}, 100);
				resolve(this.focusOverride);
			}).then(e => {
				e = false;
			});
		},
		form_unfocus() {
			setTimeout(() => {
				this.focusOverride = false;
				this.focusStatus = 0;
				this.searchInput?.focus();
			}, 100);
		},
		input_focus() {
			this.focusStatus = 2;
		},
		keyArrowUp() {
			var last = this.suggestions.length - 1;
			if (this.suggestionIndex >= 1) {
				this.suggestionIndex--;
			} else {
				this.suggestionIndex = last;
			}

			this.updateQuery();
		},
		keyArrowDown() {
			var last = this.suggestions.length - 1;

			if (this.suggestionIndex < last) {
				this.suggestionIndex++;
			} else {
				if (this.suggestionIndex > 0) {
					this.suggestionIndex = 0;
				} else {
					this.suggestionIndex = -1;
				}
			}

			this.updateQuery();
		},

		keyRight() {
			if (this.currentQuery != this.previousQuery && this.currentQuery != "") {
				if (tools.isMyanmarText(this.currentQuery)) {
					this.updateInput();
				}
			}
		},
		keyDelete() {},
		keyEnter() {},

		input_click() {
			this.focusStatus = 2;
			this.input_focus();

			if (!this.currentQuery) {
				// this.en.suggests = this.en_history.slice(0, 10);
				this.en.suggests = this.recentMost(false);
				this.my.suggests = this.recentMost(true);
			}
		},
		/**
		 * @param {any} w
		 */
		suggestion_hover(w) {
			this.currentQuery = w;
		},

		/**
		 * @param {string} w
		 */
		isCurrentWord(w) {
			return w === this.currentQuery;
		},
		// currentSuggestion() {
		// 	return this.tmpsuggestionList.length == this.suggestionIndex;
		// },

		/**
		 * word format English or other
		 * @param {wordList} e
		 */
		formatWordWE(e) {
			return e.w.replace(new RegExp(this.currentQuery, "i"), "<mark>$&</mark>");
		},

		/**
		 * word format English or other
		 * @param {wordList} e
		 */
		formatWordWM(e) {
			return e.w;
			// return e.w.replace(new RegExp(this.currentQuery, "i"), "<mark>$&</mark>");
			// let wd = e.w;
			// wd += "<mark>0</mark>";
			// return wd;
		},

		/**
		 * suggest list click on English or other
		 * @param {string} w
		 */
		async suggestClickEW(w) {
			// searchFor,
			// searchInput,
			// if (this.searchInput) {
			// 	this.searchInput.focus();
			// }
			this.focusStatus = 2;

			// this.$refs.input.focus();
			// // this.dataStore.focusOverride=true;
			this.updateQuery(w);
			// this.$refs.form.submit();
			// setTimeout(()=>{
			//   this.dataStore.focusOverride=false;
			// },150);

			this.submit();
		},

		/**
		 * suggest list click on Myanmar
		 * @param {string} w
		 */
		async suggestClickMW(w) {
			this.currentQuery = w;
			this.my.suggests = await this.suggestWM(this.currentQuery);
		},

		async submit() {
			// ref.form.
			// this.$refs.form.submit();
			// if (this.searchForm) {
			// 	this.searchForm.submit();
			// }
			console.log("submited");
			// this.en.recentSave(this.currentQuery);
		},

		/**
		 * @param {any} w
		 */
		onCharClickMW(w) {
			this.currentQuery = this.currentQuery + w;

			this.updateInput();
		},

		/**
		 * Update, patch etc
		 */
		async onMounted() {
			const urlParams = tools.urlParams;
			if (urlParams.has("q")) {
				let tq = urlParams.get("q");
				if (typeof tq == "string") {
					this.recentSave(tq);
				}
			}

			let meta = tools.selectElement('meta[name="application-name"]');

			if (this.storageStore.isSupport) {
				// NOTE: this should remain for at least 6 months
				let oldRecentWord = this.storageStore.getItemAsList("word");
				if (oldRecentWord.length) {
					let idRecent = this.en.idRecent;
					this.storageStore.setItemAsObject(idRecent, oldRecentWord);
					this.storageStore.removeItem("word");
				}

				let version = this.storageStore.getItem("version");
				try {
					let wmLocal = this.storageStore.getItemAsList(this.my.idLocal);
					let wmSize = JSON.stringify(wmLocal).length;

					if (meta.dataset.version != version || wmSize != 309635) {
						if (meta.dataset.version != version) {
							this.storageStore.setItem("version", meta.dataset.version);
							wmSize = 0;
						}
						await this.loadWM(wmSize);
					}
				} catch (error) {
					await this.loadWM();
				}
			}
		}

		// /**
		//  * @param {any} lang
		//  */
		// async onMountedWE(lang) {
		// 	if (!lang || lang == "en") {
		// 		// console.log(lang);
		// 		let meta = tools.selectElement('meta[name="application-name"]');
		// 		if (this.storageStore.isSupport) {
		// 			let version = this.storageStore.getItem("version");
		// 			try {
		// 				let weLocal = this.storageStore.getItemAsList(this.en.idLocal);
		// 				let weSize = JSON.stringify(weLocal).length;
		// 				if (meta.dataset.version != version || weSize != 805112) {
		// 					if (meta.dataset.version != version) {
		// 						this.storageStore.setItem("version", meta.dataset.version);
		// 						weSize = 0;
		// 					}
		// 					await this.loadWE(weSize);
		// 				}
		// 			} catch (error) {
		// 				console.log(error);
		// 				await this.loadWE();
		// 			}
		// 		}
		// 	}
		// }
	}
});
