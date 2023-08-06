import { h } from "vue";

import axios from "axios";
import tools from "./tools.js";

/**
 * @typedef {object} wordList
 * @property {string} w - word
 * @property {number} [n] - word count
 */

export default {
	props: ["action"],

	data: () => ({
		currentQuery: "",
		// previousQuery: "",
		// searchQuery
		// currentQuery

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
				wordList: "tsil/drow/emo/ipa/",
				wordSuggests: "tseggus/drow/emo/ipa/",
				wordSize: "ezis/drow/emo/ipa/"
			},
			alphabet: {
				code: 4096,
				total: 33
			},

			digit: {
				code: 4160,
				total: 10
			},

			symbol: [
				4105,
				4131,
				4132,
				4133,
				4134,
				4135,
				4137,
				4138,
				4159,
				4172,
				4173,
				4174,
				4175
			],
			sign: [],

			vowel: {
				code: 4139,
				total: 17
			},
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
				wordList: "tsil/drow/meo/ipa/",
				wordSuggests: "tseggus/drow/meo/ipa/",
				wordSize: "ezis/drow/meo/ipa/"
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

	methods: {
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
		 * @return {string[]}
		 */
		wordList(tst) {
			let id = tst ? this.my.idLocal : this.en.idLocal;
			return this.storageStore.getItemAsList(id);
		},

		/**
		 * Check list and get the whole list if size is differ,
		 * if not return empty array
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
		 * Check list and get the whole list if size is differ,
		 * if not return empty array
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
				// this.previousQuery = this.currentQuery;
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
		 * onInput search input changes
		 * @param {*} e
		 */
		onInput(e) {
			if (this.focusStatus != 2) {
				this.focusStatus = 2;
			}
			console.log("onInput currentQuery", this.currentQuery);
			console.log("onInput target.value", e.target.value);

			this.currentQuery = e.target.value;

			this.updateInput();
		},

		/**
		 * onSubmit search form
		 * @param {*} e
		 */
		onSubmit(e) {
			e.preventDefault();

			let o = this.suggestions[this.suggestionIndex];

			if (o) {
				this.currentQuery = o.w;
				if (this.isMyanmarQuery) {
					// let abc = this.wordList(true).includes(o.w);
					if (!this.wordList(true).includes(o.w)) {
						this.updateInput();
						return;
					}
					// if (o.n > 1) {
					// 	this.updateInput();
					// 	return;
					// }
					// if (!this.wordList(true).includes(o.w)) {
					// 	console.log("submit @checkMyanar", o.w, this.currentQuery);
					// 	this.updateInput();
					// 	return;
					// }
				}
			}
			// else if (this.currentQuery) {
			// 	if (this.isMyanmarQuery) {
			// 		if (!this.wordList(true).includes(this.currentQuery)) {
			// 			this.updateInput();
			// 			return;
			// 		}
			// 	}
			// }
			// console.log("submit @final", this.currentQuery);

			this.doSubmit();
		},

		/**
		 * Submit search form after filter query,
		 * plus `input.value` not getting latest `currentQuery`
		 * @param {string} [ord] - if `ord` not provided `currentQuery` used instead
		 * @example
		 * setTimeout(() => {
		 *  this.$refs.form.submit();
		 * }, 10);
		 *
		 * let action = this.$refs.form.getAttribute("action");
		 * let name = this.$refs.q.getAttribute("name");
		 * window.location.href = `${action}?${name}=${this.currentQuery}`;
		 */
		doSubmit(ord) {
			this.$refs.q.value = ord || this.currentQuery;
			// console.log("submitting", this.$refs.q.value);
			this.$refs.form.submit();
		},

		/**
		 * onClick search form
		 * @param {*} e
		 */
		onClick(e) {
			this.focusStatus = 2;
			this.$refs.q.focus();
			this.focusOverride = true;
			setTimeout(() => {
				this.focusOverride = false;
			}, 100);
		},

		/**
		 * onMousedown search form
		 * @param {*} e
		 */
		onMousedown(e) {
			this.focusOverride = true;
			setTimeout(() => {
				this.focusOverride = false;
			}, 150);
			console.log("onMousedown", e);
		},

		/**
		 * Form focus out
		 * @param {*} e
		 */
		onFocusOut(e) {
			setTimeout(() => {
				if (this.focusOverride) {
					this.focusStatus = 2;
				} else {
					this.focusStatus = 0;
				}
			}, 100);
			console.log("onFocusOut", e);
		},
		/**
		 * Form unfocus
		 * @param {*} e
		 */
		doUnfocus(e) {
			// this.onMousedown(e);
			// console.log("doUnfocus", e);
			setTimeout(() => {
				this.focusOverride = false;
				this.focusStatus = 0;
			}, 180);
		},

		/**
		 * onClick search input,
		 * update suggestion accordingly
		 */
		onClickInput() {
			this.updateInput();
		},

		/**
		 * onKeydown search form [up,down]
		 * @param {*} e
		 */
		onKeydown(e) {
			switch (e.keyCode) {
				case 38:
					this.onKeyArrowUp();
					break;
				case 40:
					this.onKeyArrowDown();
					break;
			}
		},

		/**
		 * onKeyup search form [right]
		 * sync on each
		 * @param {*} e
		 */
		onKeyup(e) {
			switch (e.keyCode) {
				// case 37:
				// 	console.log("left");
				// 	break;

				case 39:
					this.onKeyArrowRight();
					break;
			}
		},

		/**
		 * onKeyArrowDown search form
		 */
		onKeyArrowDown() {
			if (this.suggestionIndex < this.lastIndex) {
				this.suggestionIndex++;
			} else {
				if (this.suggestionIndex > 0) {
					this.suggestionIndex = 0;
				} else {
					this.suggestionIndex = -1;
				}
			}
		},

		/**
		 * onKeyArrowUp search form
		 */
		onKeyArrowUp() {
			if (this.suggestionIndex >= 1) {
				this.suggestionIndex--;
			} else {
				this.suggestionIndex = this.lastIndex;
			}
		},

		/**
		 * onKeyArrowRight search form
		 */
		onKeyArrowRight() {
			// if (this.currentQuery != this.previousQuery && this.currentQuery != "") {
			// 	if (tools.isMyanmarText(this.currentQuery)) {
			// 		this.updateInput();
			// 	}
			// }

			if (this.suggestionIndex > -1) {
				let o = this.suggestions[this.suggestionIndex];
				// if (o.n > 1 && tools.isMyanmarText(o.w)) {
				// 	console.log("onKeyArrowRight", o.w);
				// }
				if (o.w != this.currentQuery && tools.isMyanmarText(o.w)) {
					console.log("onKeyArrowRight", o.w, this.currentQuery);
					this.currentQuery = o.w;
					this.updateInput();
				}
			}
		},

		/**
		 * onSuggestMouseOver update [suggestionIndex]
		 * reflect [selected] class in suggestion list
		 * @param {*} o
		 */
		onSuggestMouseOver(o) {
			this.suggestionIndex = this.suggestions.findIndex(e => e.w == o.w);
		},

		/**
		 * onSuggestMouseOut reset [suggestionIndex]
		 * reflect [selected] class in suggestion list
		 * @param {*} o
		 */
		onSuggestMouseOut(o) {
			this.suggestionIndex = -1;
		},

		/**
		 * onClick both suggestions Myanmar and English
		 * @param {*} o
		 */
		onSuggestClick(o) {
			this.currentQuery = o.w;
			if (this.isMyanmarQuery) {
				if (o.n) {
					if (o.n > 1) {
						this.updateInput();
						return;
					}
				} else if (!this.wordList(true).includes(o.w)) {
					this.updateInput();
					return;
				}
			}
			this.doSubmit();
		},

		/**
		 * onClick Myanmar alphabets, vowel, symbol, digit
		 * onClickCharMW charClickMW wmClickChar
		 * @param {string} w
		 */
		wmClickChar(w) {
			this.currentQuery = this.currentQuery + w;
			this.updateInput();
		},

		/**
		 * @param {string} w
		 * @returns {string}
		 */
		selectedClass(w) {
			if (this.suggestions[this.suggestionIndex]) {
				if (this.suggestions[this.suggestionIndex].w == w) {
					return "selected";
				}
			}
			return "";
		},

		/**
		 * word format English or other
		 * @param {wordList} e
		 */
		formatWordWE(e) {
			// return e.w.replace(new RegExp(this.currentQuery, "i"), "<mark>$&</mark>");
			return e.w;
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
		}
	},

	computed: {
		/**
		 * useDataStore
		 */
		dataStore() {
			return this.$parent.dataStore;
		},

		/**
		 * useCookieStore
		 */
		cookieStore() {
			return this.$parent.cookieStore;
		},

		/**
		 * useStorageStore
		 */
		storageStore() {
			return this.$parent.storageStore;
		},

		isMyanmarQuery() {
			return tools.isMyanmarText(this.currentQuery);
		},

		focusClass() {
			switch (this.focusStatus) {
				case 2:
					return "active";
				case 1:
					return "focus";
				default:
					return "none-of";
			}
		},

		suggestions() {
			return [...this.my.suggests, ...this.en.suggests];
		},

		hasSuggestion() {
			return this.my.suggests.length || this.en.suggests.length ? "has" : "not";
		},
		/**
		 * total index of suggestions
		 */
		lastIndex() {
			return this.suggestions.length - 1;
		}
	},

	async mounted() {
		if (this.$refs.form != null && this.$refs.q != null) {
			this.$refs.q.focus();
		}

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

				if (meta.dataset.version != version || wmSize != 309631) {
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
	},

	// created() {},

	/**
	 * form(name='search' method='get' action=v.url ref="form"
	 */
	render() {
		let self = this;
		return h(
			"div",
			{ class: ["sch-definition", this.focusClass, this.hasSuggestion] },
			h(
				"form",
				{
					name: "search",
					method: "get",
					ref: "form",
					action: this.action,

					onSubmit: this.onSubmit,
					onFocusout: this.onFocusOut,
					onmousedown: this.onMousedown,
					onkeydown: this.onKeydown,
					onkeyup: this.onKeyup,
					onClick: this.onClick
				},
				[
					h(
						"div",
						{
							class: "sch"
						},
						[
							h(
								"p",
								{
									class: "sch-unfocus"
								},
								[
									h("button", {
										class: "icon-slim-left",
										type: "button",
										// onClick: "searchStore.form_unfocus"
										onClick: this.doUnfocus
									})
								]
							),
							h(
								"p",
								{
									class: "sch-input"
								},
								[
									h("input", {
										type: "search",
										ref: "q",
										name: "q",
										placeholder: "...a word or two",
										autocomplete: "off",
										title: "Type a word or two to search",
										onInput: this.onInput,
										onClick: this.onClickInput,
										value: this.currentQuery
									})
								]
							),

							// h(
							// 	"p",
							// 	{
							// 		class: "sch-char"
							// 	},
							// 	[
							// 		h(
							// 			"button",
							// 			{
							// 				type: "button",
							// 				title: "Show Myanmar character",
							// 				onClick: "searchStore.activate_myanmar"
							// 			},
							// 			"My"
							// 		)
							// 	]
							// ),
							h(
								"p",
								{
									class: "sch-submit"
								},
								// button.icon-lookup(type="submit" id="search" title="Search")
								[
									h("button", {
										class: "icon-lookup",
										type: "submit",
										title: "Search",
										id: "search"
									})
								]
							)
						]
					),
					h(
						"div",
						{
							class: "sug"
						},
						h("ul", {}, [
							h(
								"li",
								{ class: "my character" },
								this.currentQuery == "" || this.isMyanmarQuery
									? [
											h(
												"p",
												{ class: "alphabet" },
												Array.from({ length: this.my.alphabet.total }).map(
													(e, i) => {
														let seq = i >= 9 ? i + 1 : i;
														let w = String.fromCharCode(
															this.my.alphabet.code + seq
														);
														return h(
															"span",
															{
																onClick: function() {
																	self.wmClickChar(w);
																}
															},
															w
														);
													}
												)
											),

											h(
												"p",
												{ class: "vowel" },
												Array.from({ length: this.my.vowel.total }).map(
													(e, i) => {
														let seq = i >= 8 ? i + 3 : i;
														let w = String.fromCharCode(
															this.my.vowel.code + seq
														);
														return h(
															"span",
															{
																onClick: function() {
																	self.wmClickChar(w);
																}
															},
															w
														);
													}
												)
											),

											h(
												"p",
												{ class: "symbol" },
												this.my.symbol.map(c => {
													let w = String.fromCharCode(c);
													return h(
														"span",
														{
															onClick: function() {
																self.wmClickChar(w);
															}
														},
														w
													);
												})
											),

											h(
												"p",
												{ class: "digit" },
												Array.from({ length: this.my.digit.total }).map(
													(e, i) => {
														let w = String.fromCharCode(this.my.digit.code + i);
														return h(
															"span",
															{
																onClick: function() {
																	self.wmClickChar(w);
																}
															},
															w
														);
													}
												)
											)
									  ]
									: []
							),
							h(
								"li",
								{ class: "my word" },
								this.my.suggests.map(o => {
									return h(
										"p",
										{
											onmouseover: function() {
												self.onSuggestMouseOver(o);
											},
											onmouseout: function() {
												self.onSuggestMouseOut(o);
											},
											class: ["-selectedIndex", this.selectedClass(o.w)],
											onClick: function() {
												self.onSuggestClick(o);
											},
											"data-count": o.n,
											"data-more": o.n > 1
										},
										[h("span", {}, this.formatWordWM(o))]
									);
								})
							),
							h(
								"li",
								{ class: "en word" },
								this.en.suggests.map(o => {
									return h(
										"p",
										{
											onmouseover: function() {
												self.onSuggestMouseOver(o);
											},
											onmouseout: function() {
												self.onSuggestMouseOut(o);
											},
											class: ["selectedIndex", this.selectedClass(o.w)],
											onClick: function() {
												self.onSuggestClick(o);
											}
										},
										[
											h("span", { class: "icon-dot3" }),
											h("span", {}, this.formatWordWE(o))
										]
									);
								})
							)
						])
					)
				]
			)
		);
	}
};
