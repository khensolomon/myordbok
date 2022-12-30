import { defineStore } from "pinia";

export const useDataStore = defineStore("data", {
	state: () => ({
		ready: false,
		loading: true,
		message: null,
		error: null,
		count: 0,

		activeFontToggle: "",
		api: {
			suggestion: "noitseggus/ipa/",
			orthword: "drow-htro/ipa/",
			speech: "hceeps/ipa/"
		},

		// themeList: ["light", "dark"],
		q: "",
		wordInput: "",
		wordIndex: -1,
		hasFocus: false,
		OverrideFocus: false,
		suggests: [],
		historyId: "word",
		themeId: "theme"
	}),
	getters: {
		doubleCount: state => state.count * 2
	},
	actions: {
		increment() {
			this.count++;
		}
	}
});
