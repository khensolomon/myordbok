import { h } from "vue";

export default {
	// Icons
	props: ["name", "act"],
	data: () => ({
		agreed: ""
	}),
	methods: {
		action() {
			this.$parent.cookieStore.write(this.id, 1, 30);
			this.agreed = "none";
		}
	},
	computed: {
		id() {
			return this.$parent.dataStore.cookiePolicyId;
		},
		/**
		 * @returns {string}
		 */
		className() {
			return this.name + "-consent";
		},
		test() {
			return this.$parent.cookieStore.read(this.id) == 1;
		}
	},
	mounted() {
		this.agreed = this.test ? "none" : "";
	},
	render() {
		if (this.agreed) {
			return null;
		}
		return h(
			"div",
			{
				class: [this.className, this.agreed]
			},
			[
				h("p", {}, [
					"MyOrdbok uses cookies to personalize your experience. By using our website, you accept our use of cookies as described in our",
					" ",
					h("a", { href: "/cookie-policy" }, "Cookie Policy"),
					"."
				]),
				h("button", { onClick: this.action }, this.act)
			]
		);
	}
};
