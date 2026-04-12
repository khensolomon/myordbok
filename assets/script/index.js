import { createApp, h } from "vue";

import { createPinia, mapStores } from "pinia";

// import { getAuth, onAuthStateChanged } from "firebase/auth";

import axios from "axios";

// @ts-ignore
// import layout from "./office/layout.vue";
// import router from "./office/router.js";

import tools from "./tools.js";

import { useDataStore } from "./store-data.js";
import { useStorageStore } from "./store-storage.js";
import { useCookieStore } from "./store-cookie.js";
// import { useSearchStore } from "./store-search.js";

import NavEngine from "./NavEngine.js";
import SpeechEngine from "./SpeechEngine.js";
import CookieConsent from "./CookieConsent.js";
import ThemeSwitch from "./ThemeSwitch.js";
import HelpsImprove from "./HelpsImprove.js";
import FormLinks from "./FormLinks.js";
import SearchEngine from "./SearchEngine.js";
// import OfficeUser from "./OfficeUser.js";

// Import the functions you need from the SDKs you need
// import { initializeApp } from "firebase/app";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
// const firebaseConfig = {
// 	apiKey: "AIzaSyCnqrfzlqIPzEmODfZRudYXlz7MSJjaSzc",
// 	authDomain: "myordbok-app.firebaseapp.com",
// 	projectId: "myordbok-app",
// 	storageBucket: "myordbok-app.appspot.com",
// 	messagingSenderId: "75095486220",
// 	appId: "1:75095486220:web:1a29b88abfb0e80eb72329",
// 	measurementId: "G-4JM6R8RWSP"
// };

// Initialize Firebase
// initializeApp(firebaseConfig);
// Vue.config.productionTip = true;
// Vue.config.devtools = true;

const pinia = createPinia();

// function getCurrentUser() {
// 	return new Promise((resolve, reject) => {
// 		let listener = onAuthStateChanged(
// 			getAuth(),
// 			user => {
// 				listener();
// 				resolve(user);
// 			},
// 			reject
// 		);
// 	});
// }

const app = createApp({
	components: {
		NavEngine,
		SpeechEngine,
		ThemeSwitch,
		HelpsImprove,
		FormLinks,
		CookieConsent,
		SearchEngine,
		// OfficeUser
		// NavTest
	},
	methods: {
		/**
		 * @param {string} e
		 */
		querySelector(e) {
			return tools.selectElement(e);
		},

		/**
		 * @param {string} ord
		 */
		async orthword(ord) {
			return await axios
				.get(tools.reverse(this.dataStore.api.orthword), {
					params: { ord: ord }
				})
				.then(response => response.data, () => new Array());
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
				tools.reverse(this.dataStore.api.speech) +
				"?" +
				Object.keys(params)
					.map(function(key) {
						return [key, params[key]].map(encodeURIComponent).join("=");
					})
					.join("&")
			);
		}
	},
	watch: {},
	// async created() {},
	// beforeCreate() {},
	// created() {},
	// beforeMount() {},
	async mounted() {
		// this.searchStore.$refs = this.$refs;
		// let lang = this.cookieStore.read("solId");
		// await this.searchStore.onMountedWE(lang);
		// await this.searchStore.onMounted();
		// if (this.$refs.searchForm != null && this.$refs.searchInput != null) {
		// 	this.$refs.searchInput.focus();
		// }
		// if (this.$refs.input != null) {
		// 	this.$refs.input.focus();
		// }
	},
	// render: () => h(layout),
	// ready: () {},
	computed: {
		// note we are not passing an array, just one store after the other
		// each store will be accessible as its id + 'Store'
		...mapStores(useDataStore, useCookieStore, useStorageStore)
	},
	// NOTE: without setup {useDataStore} can be accessed at {dataStore}
	setup() {
		// const data = useDataStore();
		// data.count++;
		// // with autocompletion ✨
		// data.$patch({ count: data.count + 1 });
		// // or using an action instead
		// data.increment();
		// return { data };
	},
	
	// ADD THIS — tells Vue to use the existing DOM as-is
	// without runtime compilation
	// template: null,
	// render() {
	// 		return h(
	// 				'div',
	// 				{ id: 'myordbok', class: 'primary' },
	// 				// $el children are preserved via slots
	// 		)
	// }
});

app.use(pinia);

// app.component('NavEngine', NavEngine)
// app.component('SpeechEngine', SpeechEngine)
// app.component('CookieConsent', CookieConsent)
// app.component('ThemeSwitch', ThemeSwitch)
// app.component('HelpsImprove', HelpsImprove)
// app.component('FormLinks', FormLinks)
// app.component('SearchEngine', SearchEngine)

// app.provide("dataStore", useDataStore());
// app.provide("storageStore", useStorageStore());

const clickOutside = {
	beforeMount: (el, binding) => {
		el.eventSetDrag = () => {
			el.setAttribute("data-dragging", "yes");
		};
		el.eventClearDrag = () => {
			el.removeAttribute("data-dragging");
		};
		el.eventOnClick = event => {
			const dragging = el.getAttribute("data-dragging");
			// Check that the click was outside the el and its children, and wasn't a drag
			if (!(el == event.target || el.contains(event.target)) && !dragging) {
				// call method provided in attribute value
				binding.value(event);
			}
		};
		if (el.classList.contains("thatClass")) {
			console.log("beforeMount", el);
		}
		document.addEventListener("touchstart", el.eventClearDrag);
		document.addEventListener("touchmove", el.eventSetDrag);
		document.addEventListener("click", el.eventOnClick);
		document.addEventListener("touchend", el.eventOnClick);
	},
	unmounted: el => {
		console.log("unmounted", el);
		document.removeEventListener("touchstart", el.eventClearDrag);
		document.removeEventListener("touchmove", el.eventSetDrag);
		document.removeEventListener("click", el.eventOnClick);
		document.removeEventListener("touchend", el.eventOnClick);
		el.removeAttribute("data-dragging");
	}
};
app.directive("click-outside", clickOutside);

app.mount("#myordbok");
// app.mount('body')

// document.addEventListener("DOMContentLoaded", function() { });
