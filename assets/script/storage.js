import { defineStore } from "pinia";

export const useStorageStore = defineStore("storage", {
	state: () => ({}),
	getters: {},
	actions: {
		/**
		 * @returns {string}
		 * @param {string} id
		 * @example .getItem('key')
		 */
		getItem(id) {
			try {
				var e = localStorage.getItem(id);
				if (e) {
					return e;
				}
				return "";
			} catch (error) {
				return "";
			}
		},

		/**
		 * @returns {void}
		 * @param {string} id
		 * @param {string} value
		 * @example .setItem('key','value)
		 */
		setItem(id, value) {
			localStorage.setItem(id, value);
		},

		/**
		 * @returns {string[]}
		 * @param {string} id
		 */
		getItemAsList(id) {
			var e = this.getItem(id);
			if (e) {
				var o = JSON.parse(e);
				if (Array.isArray(o)) return o;
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
		}
	}
});
