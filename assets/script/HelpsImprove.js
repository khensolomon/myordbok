import { h } from "vue";

export default {
	props: ["row"],
	data: () => ({
		info: {}
	}),
	methods: {},
	computed: {
		dataStore() {
			return this.$parent.dataStore;
		},

		word() {
			return this.info.term;
		},
		kind() {
			return this.info.kind;
		}
	},
	mounted() {
		this.info = JSON.parse(this.row);
	},
	render() {
		return h(
			"div",
			{
				class: this.kind
			},
			[
				h("h3", {}, ["Help us shape the term of ", h("q", this.word), ". "]),
				h("p", {}, [
					"The contribution always play a crucial role in shaping the excellence of",
					" ",
					h(
						"a",
						{ href: this.dataStore.urlSuggestion([this.word]) },
						this.word
					),
					". ",
					"By sharing your insights on it context using ",
					h(
						"a",
						{
							href: this.dataStore.urlSuggestion([this.word])
						},
						"Google forms"
					),
					" such as, "
				]),
				h("ol", {}, [
					h("li", {}, [
						h("strong", {}, "definition"),
						": meaning, translation"
					]),
					h("li", {}, [h("strong", {}, "grammar"), ": spelling, punctuation"]),
					h("li", {}, [
						h("strong", {}, "example"),
						": when, where and how to use its"
					])
				]),
				h("p", {}, [
					"...its actively help us refine meaningful context and elevate the user experience."
				]),
				h("p", {}, [
					"We want you to know that your efforts are immensely appreciated and instrumental in making the dictionary even better."
				]),
				h("p", { class: "feedback" }, [
					"Your ",
					h("a", { href: this.dataStore.urlFeedback([]) }, "feedback"),
					" on overall experiences is also highly welcome and appreciated."
				]),
				h("p", { class: "thanks" }, [
					"Thank you for being a vital part of our journey towards excellence!"
				])
			]
			// h(
			// 	"button",
			// 	{
			// 		onClick: this.theme_switch
			// 	},
			// )
		);
	}
};
