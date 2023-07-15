// import { defineComponent } from "vue";

// export default defineComponent({
// 	// getters: {
// 	// 	queryString: () => "abc"
// 	// },
// 	methods:
// });

export default {
	get checklocalStorage() {
		// return typeof(Storage) !== "undefined"
		var test = "tmp";
		try {
			localStorage.setItem(test, test);
			// var abc =localStorage.getItem(test);
			localStorage.removeItem(test);
			return true;
		} catch (e) {
			return false;
		}
	},

	/**
	 * @example
	 * const urlParams = new URLSearchParams(queryString);
	 * urlParams.has("q")
	 * urlParams.get("q")
	 */
	get queryString() {
		return window.location.search;
	},

	/**
	 * Get url params
	 */
	get urlParams() {
		return new URLSearchParams(this.queryString);
	},

	/**
	 * @param {any} e
	 * @example
	 * let input = this.selectElement('input[name="q"]')
	 * const meta = this.selectElement('meta[name="application-name"]')
	 * meta.content
	 * meta.dataset.version
	 *
	 */
	selectElement(e) {
		return document.querySelector(e);
	},

	/**
	 * @param {string} formName - name of the form
	 * returns {HTMLCollectionOf<HTMLFormElement>}
	 * @example
	 * document.forms["search"];
	 */
	form(formName) {
		return document.forms[formName];
	},

	/**
	 * @param {any} e
	 * @example
	 * const els = this.allElement('li.word>p.suggestion')
	 */
	allElement(e) {
		return document.querySelectorAll(e);
	},

	/**
	 * @param {any} text
	 */
	isMyanmarText(text) {
		return /[\u1000-\u109F]/.test(text);
	},

	/**
	 * @param {string} str
	 * @example
	 * "".split("").reverse().join("")
	 * reverse("cba") -> abc
	 */
	reverse(str) {
		return str
			.split("")
			.reverse()
			.join("");
	},
	doSomething() {
		console.log("Yes");
	}
};
