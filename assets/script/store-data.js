import { defineStore } from "pinia";

export const useDataStore = defineStore("data", {
	state: () => ({
		ready: false,
		loading: true,
		message: null,
		error: null,
		count: 0,
		userAuthenticate: false,
		/**
		 * @type {any}
		 */
		userInfo: {},
		activeFontToggle: "",
		api: {
			orthword: "drow-htro/ipa/",
			speech: "hceeps/ipa/"
		},
		// formlinkSuggestion formlinkFeedback
		formSuggestion: {
			id: "1FAIpQLSceWwVrtH5KivCR3wuvKqMn8U238-aCxOJIIWs1gK4pt994oA",
			entry: [2033036872, 549418682]
		},
		formFeedback: {
			id: "1FAIpQLScSyBRtQrEc1YGh3m0O96vy6YNlCtJZR5T6NIJ9hYJRfcnV2g",
			entry: [1574826432, 482449512]
		},

		// themeList: ["light", "dark"],
		// q: "",
		// wordInput: "",
		// wordIndex: -1,
		// hasFocus: false,
		// overrideFocus: false,
		// isMyanmar: false,
		// suggests: [],
		// historyId: "word",
		themeId: "theme",
		cookiePolicyId: "cookiePolicy"
		// my: {
		// 	alphabet: [
		// 		"က",
		// 		"ခ",
		// 		"ဂ",
		// 		"ဃ",
		// 		"င",
		// 		"စ",
		// 		"ဆ",
		// 		"ဇ",
		// 		"စ်",
		// 		"ည",
		// 		"ဋ",
		// 		"ဌ",
		// 		"ဍ",
		// 		"ဎ",
		// 		"ဏ",
		// 		"တ",
		// 		"ထ",
		// 		"ဒ",
		// 		"ဓ",
		// 		"န",
		// 		"ပ",
		// 		"ဖ",
		// 		"ဗ",
		// 		"ဘ",
		// 		"မ",
		// 		"ယ",
		// 		"ရ",
		// 		"လ",
		// 		"၀",
		// 		"သ",
		// 		"ဟ",
		// 		"ဠ",
		// 		"အ"
		// 	],
		// 	digit: ["၀", "၁", "၂", "၃", "၄", "၅", "၆", "၇", "၈", "၉"],
		// 	symbol: ["၀", "၁", "၂", "၃", "၄", "၅", "၆", "၇", "၈", "၉"],
		// 	sign: [],
		// 	vowel: ["င်"],
		// 	subscript: [],
		// 	word: []
		// }
	}),
	getters: {
		doubleCount: state => state.count * 2

		/**
		 * containing letter, symbol, sign
		 */
		// myChar: state => [...state.my.alphabet, ...state.my.digit]
	},
	actions: {
		increment() {
			this.count++;
		},
		/**
		 * @param {any} id
		 * @param {string[]} entry
		 * @param {string?} type viewform formResponse
		 */
		gform(id, entry, type) {
			let url = new URL("https://docs.google.com/forms/d/e/" + id);
			if (type == "submit") {
				url.pathname += "/formResponse";
				url.searchParams.set("submit", "Submit");
			} else {
				url.pathname += "/viewform";
			}
			if (entry.length) {
				url.searchParams.set("usp", "pp_url");
				for (let index = 0; index < entry.length; index++) {
					let id = "entry." + this.formSuggestion.entry[index];
					url.searchParams.set(id, entry[index]);
				}
			}
			return url;
		},
		/**
		 * @param {string[]} entry
		 * @param {string?} type viewform formResponse
		 * @example
		 * urlSuggestion([word])
		 * urlSuggestion([word, definition], submit)
		 */
		urlSuggestion(entry, type) {
			let url = this.gform(this.formSuggestion.id, entry, type);
			return url.toString();
		},

		/**
		 * @param {string[]} entry
		 * @param {string?} type viewform formResponse
		 * @example
		 * urlFeedback([feedback])
		 * urlFeedback([feedback, "Please reply me"], submit)
		 */
		urlFeedback(entry, type) {
			let url = this.gform(this.formFeedback.id, entry, type);
			return url.toString();
		}
	}
});
