import { h } from "vue";

export default {
	props: ["type", "text", "title", "prefill"],

	methods: {
		links() {
			if (this.type == "feedback") {
				return this.dataStore.urlFeedback([]);
			}
			let param = [];
			if (this.prefill) {
				param.push(this.prefill);
			}
			return this.dataStore.urlSuggestion(param);
		}
	},
	computed: {
		dataStore() {
			return this.$parent.dataStore;
		}
	},

	render() {
		return h(
			"a",
			{
				title: this.title,
				class: ["form-links"],
				href: this.links()
			},
			this.text
		);
	}
};
