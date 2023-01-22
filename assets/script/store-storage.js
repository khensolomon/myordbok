import { defineStore } from "pinia";

export const useStorageStore = defineStore("storage", {
	state: () => ({}),
	getters: {},
	actions: {
		/**
		 * refer to: aid.check.isValid (xss)
		 * @param {string} str
		 * @returns {string}
		 */
		isValid(str) {
			return str
				.replace(/(\r\n|\n|\r)/gm, "")
				.replace(/(\<|%3C)(.*)(\>|%3E)/g, "")
				.replace(/(\<|%3C|\>|%3E)(.*)(\<|%3C\>|%3E)/g, "")
				.replace(/(\/|%2F)(.*)(\>|%3E)/g, "")
				.replace(/(\/\*)/g, "")
				.trim();
		},
		/**
		 * @example .getItem('key')
		 * @param {string} id
		 * @returns {string}
		 */
		getItem(id) {
			try {
				const val = localStorage.getItem(id);
				if (val) {
					return this.isValid(val);
				}
				return "";
			} catch (error) {
				return "";
			}
		},

		/**
		 * @example .setItem('key','value)
		 * @param {string} id
		 * @param {string} value
		 * @returns {void}
		 */
		setItem(id, value) {
			const val = this.isValid(value);
			if (val != "") {
				localStorage.setItem(id, val);
			}
		},

		/**
		 * @param {string} id
		 * @returns {string[]}
		 */
		getItemAsList(id) {
			var e = this.getItem(id);
			if (e) {
				const val = JSON.parse(e);
				if (Array.isArray(val)) {
					return val.filter(v => this.isValid(v));
				}
			}
			return [];
		},

		/**
		 * @returns {void}
		 * @param {string} id
		 * @param {string} value
		 */
		setItemAsList(id, value) {
			var items = this.getItemAsList(id);
			var _Index = items.findIndex(e => e.toLowerCase() == value.toLowerCase());
			if (_Index > -1) {
				items.unshift(items.splice(_Index, 1)[0]);
			} else {
				items.unshift(value);
			}
			this.setItem(id, JSON.stringify(items.slice(0, 200)));
		},

		/**
		 * @param {string} id
		 * @returns {object}
		 */
		getItemAsObject(id) {
			var e = this.getItem(id);
			if (e) {
				var o = JSON.parse(e);
				if (o) return o;
			}
			return {};
		},
		/**
		 * @param {string} id
		 * @param {any} value
		 * @returns {void}
		 */
		setItemAsObject(id, value) {
			this.setItem(id, JSON.stringify(value));
		}
		// async getItem(k) {
		// 	return await JSON.parse(localStorage.getItem(k));
		// },
		// async setItem(k, v) {
		// 	localStorage.setItem(k, JSON.stringify(v));
		// }
	}
});
