import { createApp } from "vue";
import { createPinia, mapStores } from "pinia";

import axios from "axios";

import { useDataStore } from "./store-data.js";
import { useStorageStore } from "./store-storage.js";
import { useCookieStore } from "./store-cookie.js";

import NavEngine from "./NavEngine.js";
import SpeechEngine from "./SpeechEngine.js";
import ThemeSwitch from "./ThemeSwitch.js";

// Vue.config.productionTip = true;
// Vue.config.devtools = true;
// Vue.use(VueRouter);

const pinia = createPinia();

const app = createApp({
	components: {
		NavEngine,
		SpeechEngine,
		ThemeSwitch
		// NavTest
	},
	methods: {
		test() {
			console.log("test yesss");
		},
		/**
		 * @param {any} e
		 */
		querySelector(e) {
			return document.querySelector(e);
		},

		/**
		 * @param {string} q
		 */
		async suggestion(q) {
			return await axios
				.get(this.reverse(this.dataStore.api.suggestion), {
					params: { q: q }
				})
				.then(response => response.data, () => new Array());
		},
		/**
		 * @param {string} ord
		 */
		async orthword(ord) {
			return await axios
				.get(this.reverse(this.dataStore.api.orthword), {
					params: { ord: ord }
				})
				.then(response => response.data, () => new Array());
		},
		/**
		 * @param {string} str
		 */
		reverse(str) {
			return str
				.split("")
				.reverse()
				.join("");
		},
		/**
		 * Myanmar font description toggle
		 * @param {any} str
		 */
		fontToggle(str) {
			// console.log('fontToggle',str)
			// this.dataStore.activeFontToggle = str;
			if (this.dataStore.activeFontToggle != str) {
				this.dataStore.activeFontToggle = str;
			} else {
				this.dataStore.activeFontToggle = "";
			}
		},
		/**
		 * @param {string} str
		 */
		fontActive(str) {
			return this.dataStore.activeFontToggle == str;
		},
		/**
		 * @param {{ [x: string]: any; }} params
		 */
		speech(params) {
			return (
				this.reverse(this.dataStore.api.speech) +
				"?" +
				Object.keys(params)
					.map(function(key) {
						return [key, params[key]].map(encodeURIComponent).join("=");
					})
					.join("&")
			);
		},

		/**
		 * search-engine
		 */
		input_focus() {
			this.dataStore.hasFocus = true;
		},
		input_unfocus() {
			this.dataStore.hasFocus = false;
		},
		input_blur() {
			setTimeout(() => {
				if (!this.dataStore.OverrideFocus) {
					this.dataStore.hasFocus = false;
					this.dataStore.OverrideFocus = false;
				}
			}, 150);
		},
		arrow_up() {
			console.log("up");
			if (this.dataStore.wordIndex > 0) {
				this.dataStore.wordIndex--;
			} else {
				if (this.dataStore.wordIndex == -1) {
					this.dataStore.wordIndex = this.lastIndex;
				} else {
					this.dataStore.wordIndex = -1;
				}
			}
			this.updateQuery();
		},
		arrow_down() {
			console.log("down");
			if (this.dataStore.wordIndex <= this.lastIndex) {
				this.dataStore.wordIndex++;
			} else {
				if (this.dataStore.wordIndex > 0) {
					this.dataStore.wordIndex = 0;
				} else {
					this.dataStore.wordIndex = -1;
				}
			}
			this.updateQuery();
		},
		input_click() {
			if (!this.dataStore.q) {
				this.dataStore.suggests = this.load_history.slice(0, 10);
			}
		},
		/**
		 * @param {any} index
		 */
		suggestion_hover(index) {
			this.dataStore.wordIndex = index;
		},
		async input_change() {
			this.dataStore.wordIndex = -1;
			this.dataStore.wordInput = this.dataStore.q;
			if (this.dataStore.q) {
				// console.log("q", this.dataStore.q);
				// this.dataStore.suggests = await this.suggestion(this.dataStore.q);
				// if (/[\u1000-\u109F]/.test(this.dataStore.q)) {
				//   // console.log('?',this.dataStore.q)
				//   this.dataStore.suggests = await this.$parent.orthword(this.dataStore.q);
				// } else {
				//   this.dataStore.suggests = await this.$parent.suggestion(this.dataStore.q);
				// }
				this.dataStore.suggests = await this.suggestion(this.dataStore.q);
			} else {
				this.dataStore.suggests = this.load_history.slice(0, 10);
			}
		},
		/**
		 * @param {any} index
		 */
		isCurrent(index) {
			return index === this.dataStore.wordIndex;
		},
		/**
		 * @param {any} w
		 */
		updateQuery(w) {
			if (w) {
				return (this.dataStore.q = w);
			} else if (this.dataStore.suggests[this.dataStore.wordIndex]) {
				this.dataStore.q = this.dataStore.suggests[this.dataStore.wordIndex];
			} else if (this.dataStore.wordInput) {
				this.dataStore.q = this.dataStore.wordInput;
			}
		},
		/**
		 * @param {string} w
		 */
		wordHighlight(w) {
			return w.replace(
				new RegExp(this.dataStore.wordInput, "i"),
				"<mark>$&</mark>"
			);
		},
		/**
		 * @param {any} w
		 */
		async suggestion_click(w) {
			this.$refs.input.focus();
			// this.dataStore.OverrideFocus=true;
			await this.updateQuery(w);
			this.$refs.form.submit();
			// setTimeout(()=>{
			//   this.dataStore.OverrideFocus=false;
			// },150);
		},
		/**
		 * @param {any} w
		 */
		async save_history(w) {
			this.storageStore.setItemAsList(this.dataStore.historyId, w);
		},

		async input_submit() {
			this.$refs.form.submit();
			this.save_history(this.dataStore.q);
		}
	},
	watch: {},
	// async created() {},
	// beforeCreate() {},
	created() {},
	// beforeMount() {},
	mounted() {
		if (this.query) {
			this.save_history(this.query);
		}

		if (this.$refs.input != null) {
			// this.$refs.input.focus();
		}
	},
	// render: () => h(layout),
	// ready: () {},
	computed: {
		// note we are not passing an array, just one store after the other
		// each store will be accessible as its id + 'Store'
		...mapStores(useDataStore, useCookieStore, useStorageStore),
		lastIndex() {
			return this.dataStore.suggests.length - 1;
		},
		hasActive() {
			if (this.dataStore.hasFocus && this.dataStore.suggests.length) {
				return "active";
			} else if (this.dataStore.hasFocus) {
				return "focus";
			}
		},
		/**
		 *
		 * @returns {number[]}
		 */
		load_history() {
			return this.storageStore.getItemAsList(this.dataStore.historyId);
		}
	}
	// NOTE: without setup {useDataStore} can be accessed at {dataStore}
	// setup() {
	//   const data = useDataStore();
	//   data.count++;
	//   // with autocompletion ✨
	//   data.$patch({ count: data.count + 1 });
	//   // or using an action instead
	//   data.increment();
	//   return { data };
	// },
});

app.use(pinia);

// app.provide("dataStore", useDataStore());
// app.provide("storageStore", useStorageStore());

app.mount("#myordbok");
