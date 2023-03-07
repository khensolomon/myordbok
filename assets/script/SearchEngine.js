export default {
	// name: 'SearchEngine',
	// el:'form[name="search"]'
	props: ["query"],
	data: () => ({
		q: "",
		wordInput: "",
		wordIndex: -1,
		hasFocus: false,
		OverrideFocus: false,
		suggestion: [],
		keyHistory: "word"
	}),
	filters: {},
	methods: {
		onFocus() {
			this.hasFocus = true;
		},
		onBlur() {
			setTimeout(() => {
				if (!this.OverrideFocus) {
					this.hasFocus = false;
					this.OverrideFocus = false;
				}
			}, 150);
		},
		up() {
			console.log("up");
			if (this.wordIndex > 0) {
				this.wordIndex--;
			} else {
				if (this.wordIndex == -1) {
					this.wordIndex = this.lastIndex;
				} else {
					this.wordIndex = -1;
				}
			}
			this.updateQuery();
		},
		down() {
			console.log("down");
			if (this.wordIndex <= this.lastIndex) {
				this.wordIndex++;
			} else {
				if (this.wordIndex > 0) {
					this.wordIndex = 0;
				} else {
					this.wordIndex = -1;
				}
			}
			this.updateQuery();
		},
		clickInput() {
			if (!this.q) {
				this.suggestion = this.history.slice(0, 10);
			}
		},
		hover(index) {
			this.wordIndex = index;
		},
		async change() {
			this.wordIndex = -1;
			this.wordInput = this.q;
			console.log("changes");
			if (this.q) {
				this.suggestion = await this.$parent.suggestion(this.q);
				// if (/[\u1000-\u109F]/.test(this.q)) {
				//   // console.log('?',this.q)
				//   this.suggestion = await this.$parent.orthword(this.q);
				// } else {
				//   this.suggestion = await this.$parent.suggestion(this.q);
				// }
				// this.suggestion = await this.$parent.suggestion(this.q);
			} else {
				this.suggestion = this.history.slice(0, 10);
			}
		},
		isCurrent(index) {
			return index === this.wordIndex;
		},
		updateQuery(w) {
			if (w) {
				return (this.q = w);
			} else if (this.suggestion[this.wordIndex]) {
				this.q = this.suggestion[this.wordIndex];
			} else if (this.wordInput) {
				this.q = this.wordInput;
			}
		},
		wordHighlight(w) {
			return w.replace(new RegExp(this.wordInput, "i"), "<mark>$&</mark>");
		},
		async clickSuggestion(w) {
			this.$refs.input.focus();
			// this.OverrideFocus=true;
			await this.updateQuery(w);
			this.$refs.form.submit();
			// setTimeout(()=>{
			//   this.OverrideFocus=false;
			// },150);
		},
		async setHistory(w) {
			var _Index = this.history.findIndex(
				e => e.toLowerCase() == w.toLowerCase()
			);
			if (_Index > -1) {
				this.history.unshift(this.history.splice(_Index, 1)[0]);
			} else {
				this.history.unshift(w);
			}
			localStorage.setItem("word", JSON.stringify(this.history.slice(0, 200)));
		},
		async submit() {
			this.$refs.form.submit();
		}
	},
	computed: {
		lastIndex() {
			return this.suggestion.length - 1;
		},
		hasActive() {
			if (this.hasFocus && this.suggestion.length) {
				return "active";
			} else if (this.hasFocus) {
				return "focus";
			}
		},
		history() {
			try {
				var e = localStorage.getItem(this.keyHistory);
				if (e) {
					var o = JSON.parse(e);
					if (Array.isArray(o)) return o;
				}
				return [];
			} catch (error) {
				return [];
			}
		}
	},
	mounted() {
		if (this.query) {
			this.setHistory(this.query);
		}
		this.$refs.input.focus();
	}
	// created() {}
};
