import { h } from "vue";

export default {
	methods: {
		/**
		 * @param {{ target: any; srcElement: any; }} e
		 */
		theme_switch(e) {
			let target = e.target || e.srcElement;

			let modeId = target.dataset.mode;
			if (!modeId) {
				modeId = "auto";
			}

			const themeId = this.$parent.dataStore.themeId;

			this.$parent.cookieStore.write(themeId, modeId, 30);

			this.html.dataset.theme = modeId;
			this.themeColor.setAttribute(
				"content",
				modeId == "dark" ? "#222222" : "#3390d7"
			);
		}
	},
	computed: {
		html() {
			return this.$parent.querySelector("html");
		},

		themeColor() {
			return this.$parent.querySelector('meta[name="theme-color"]');
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
					"aria-label": "Theme mode",
					onClick: this.theme_switch
				},
				[
					h("span", {}),
					h("i", {
						class: "icon-color",
						"data-mode": "auto"
					}),
					h("i", {
						// class: this.light
						class: "icon-sun",
						"data-mode": "light"
					}),
					h("i", {
						// class: this.dark
						class: "icon-moon",
						"data-mode": "dark"
					})
				]
			)
		);

		// return h(
		// 	"div",
		// 	{
		// 		class: "theme-switch"
		// 	},
		// 	h(
		// 		"button",
		// 		{
		// 			"aria-label": "Theme mode",
		// 			onClick: this.theme_switch
		// 		},
		// 		[
		// 			h("i", {
		// 				// class: this.light
		// 				class: "icon-sun"
		// 			}),
		// 			h("i", {
		// 				// class: this.dark
		// 				class: "icon-moon"
		// 			}),
		// 			h("span", {})
		// 		]
		// 	)
		// );
	}
};
