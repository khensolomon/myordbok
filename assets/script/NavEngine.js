import { h } from "vue";

export default {
	methods: {
		toggle() {
			this.$parent.querySelector("div.navigate").classList.toggle("active");
			// this.$parent
			// 	.querySelector("li.showMobileMenu")
			// 	.classList.toggle("active");
		}
	},
	render() {
		// return h("div", {}, [
		// 	h("div", {
		// 		class: "name navMobile"
		// 	}),
		// 	h("div", {
		// 		class: "toggle panel icon-panel",
		// 		onClick: this.toggle
		// 	})
		// ]);
		return h("div", {}, [
			h("div", {
				class: "name navMobile"
			}),
			h(
				"div",
				{
					class: "toggle icon-panels",
					onClick: this.toggle
				},
				[h("span", {}), h("span", {}), h("span", {})]
			)
		]);
	}
};
