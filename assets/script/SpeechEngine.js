import { h } from "vue";
// import { mapStores } from "pinia";
// import { useDataStore } from "./store-data.js";
// Vue.component('my-checkbox', {});

export default {
	props: ["word", "lang"],
	data: () => ({
		isplaying: false
	}),
	computed: {
		// note we are not passing an array, just one store after the other
		// each store will be accessible as its id + 'Store'
		// ...mapStores(useDataStore)
	},
	methods: {
		speech() {
			// var element = e.target;
			// console.log(e)
			// $(clickedElement).siblings().removeClass('active');
			// $(clickedElement).addClass('active');
			// console.log(this.word, this.lang);

			this.isplaying = true;
			var audio = document.createElement("audio");
			audio.src = this.$parent.speech({ q: this.word, l: this.lang });
			audio.load();
			audio.play();
			audio.addEventListener("ended", () => (this.isplaying = false));
			// console.log(this.$parent.speech({ q: this.word, l: this.lang }));
		}
	},
	render() {
		// <span @click = 'speech' v-bind:class = "{'playing': isplaying}" class="speech icon-volume-up"></span>

		return h("span", {
			// attr: {
			// 	class: "speech icon-volume-up isplaying"
			// },
			class: ["speech icon-volume-up"],
			onClick: this.speech
		});
	}
};
