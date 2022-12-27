import { h } from "vue";

export default {
	// Icons
	props: ["light", "dark"],
	methods: {
		theme_switch() {
			const themeId = this.$parent.dataStore.themeId;

			if (this.classList.contains("dark")) {
				this.$parent.cookieStore.remove(themeId);
			} else {
				this.$parent.cookieStore.write(themeId, "dark", 30);
			}
			this.classList.toggle("dark");
		}
	},
	computed: {
		/**
		 * @returns {string[]}
		 */
		classList() {
			return this.$parent.querySelector("html").classList;
		}
	},
	render() {
		return h(
			"div",
			{
				class: "theme-switch"
			},
			h(
				"button",
				{
					onClick: this.theme_switch
				},
				[
					h("i", {
						class: this.dark
					}),
					h("i", {
						class: this.light
					}),
					h("span", {})
				]
			)
		);
	}
};
