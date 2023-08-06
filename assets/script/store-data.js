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
		}
	}
});
