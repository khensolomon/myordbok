// Vue.component('my-checkbox', {});
export default {
	// data() {
	//   return {
	//     show:false
	//  }
	// },
	methods: {
		toggle() {
			// this.show = !this.show;
			// this.$parent.querySelector('li.showMobileMenu').classList.toggle('active');
			this.$parent.querySelector("div.navigate").classList.toggle("active");
		}
	},
	render(createElement) {
		return createElement("div", {}, [
			createElement("div", {
				attrs: {
					class: "name navMobile"
				}
			}),
			createElement("div", {
				attrs: {
					class: "toggle panel icon-panel"
				},
				on: {
					click: this.toggle
				}
			})
		]);
	}
};
