// import Vue from 'vue';
import axios from "axios";

// import VueResource from 'vue-resource';
// Vue.use(VueResource);

// @ts-ignore
import SpeechEngine from "./SpeechEngine.js";
// @ts-ignore
// import SearchEngine from './SearchEngine.vue';

import NavEngine from "./NavEngine.js";
// import NavTest from './NavTest.js';

Vue.config.productionTip = false;
Vue.config.devtools = false;

// Vue.directive('click-outside', {
//   bind: function (el, binding, vnode) {
//     el.clickOutsideEvent = function (event) {
//       // here I check that click was outside the el and his childrens
//       if (!(el == event.target || el.contains(event.target))) {
//         // and if it did, call method provided in attribute value
//         vnode.context[binding.expression](event);
//       }
//     };
//     document.body.addEventListener('click', el.clickOutsideEvent)
//   },
//   unbind: function (el) {
//     document.body.removeEventListener('click', el.clickOutsideEvent)
//   },
// });

// Vue.component('navengine', {
//   props:{
//      is:{type:String, required:true}
//   },
//   render(h){
//     return h(this.tag, this.$slots.default)
//   }
// });
// Vue.components('search-engine',SearchEngine);

// @ts-ignore
new Vue({
	el: "#myordbok",
	// props: ['query'],
	data: {
		isLoading: false,
		isDone: false,
		activeFontToggle: "",
		api: {
			suggestion: "noitseggus/ipa/",
			orthword: "drow-htro/ipa/",
			speech: "hceeps/ipa/"
		},
		available_theme: ["light", "dark"],
		themeMode: 0,
		q: "",
		wordInput: "",
		wordIndex: -1,
		hasFocus: false,
		OverrideFocus: false,
		suggests: [],
		key_history: "word",
		key_theme: "theme"
	},
	filters: {},
	components: {
		// 'search-engine': SearchEngine,
		// SearchEngine,
		SpeechEngine,
		NavEngine
		// NavTest
	},
	methods: {
		// Switch theme dark or light
		theme_switch() {
			// this.querySelector("div.navigate").classList.toggle("active");

			const label = this.available_theme[this.themeMode];
			// remove current theme class with toggle
			// this.$el.classList.toggle(label);
			// this.querySelector("body").classList.toggle(label);
			this.querySelector("html").classList.toggle(label);

			this.themeMode++;
			if (this.available_theme[this.themeMode] === undefined) {
				this.themeMode = 0;
			}
			// save theme
			this.save_theme(this.themeMode);
			// apply theme
			this.theme_apply();
		},
		theme_apply() {
			const index = this.load_theme;
			if (this.available_theme[index] != undefined) {
				const label = this.available_theme[index];
				// this.$el.classList.toggle(label);
				// this.querySelector("body").classList.toggle(label);
				this.querySelector("html").classList.toggle(label);
			}
		},

		async suggestion(q) {
			return await axios
				.get(this.reverse(this.api.suggestion), { params: { q: q } })
				.then(response => response.data, () => new Array());
		},
		async orthword(ord) {
			return await axios
				.get(this.reverse(this.api.orthword), { params: { ord: ord } })
				.then(response => response.data, () => new Array());
		},
		reverse(str) {
			return str
				.split("")
				.reverse()
				.join("");
		},
		fontToggle(str) {
			// console.log('fontToggle',str)
			// this.activeFontToggle = str;
			if (this.activeFontToggle != str) {
				this.activeFontToggle = str;
			} else {
				this.activeFontToggle = "";
			}
		},
		fontActive(str) {
			return this.activeFontToggle == str;
		},
		speech(params) {
			return (
				this.reverse(this.api.speech) +
				"?" +
				Object.keys(params)
					.map(function(key) {
						return [key, params[key]].map(encodeURIComponent).join("=");
					})
					.join("&")
			);
		},
		querySelector(e) {
			return document.querySelector(e);
		},
		// search-engine
		input_focus() {
			this.hasFocus = true;
		},
		input_blur() {
			setTimeout(() => {
				if (!this.OverrideFocus) {
					this.hasFocus = false;
					this.OverrideFocus = false;
				}
			}, 150);
		},
		arrow_up() {
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
		arrow_down() {
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
		input_click() {
			if (!this.q) {
				this.suggests = this.load_history.slice(0, 10);
			}
		},
		suggestion_hover(index) {
			this.wordIndex = index;
		},
		async input_change() {
			this.wordIndex = -1;
			this.wordInput = this.q;
			if (this.q) {
				console.log("q", this.q);
				this.suggests = await this.suggestion(this.q);
				// if (/[\u1000-\u109F]/.test(this.q)) {
				//   // console.log('?',this.q)
				//   this.suggests = await this.$parent.orthword(this.q);
				// } else {
				//   this.suggests = await this.$parent.suggestion(this.q);
				// }
				this.suggests = await this.suggestion(this.q);
			} else {
				this.suggests = this.load_history.slice(0, 10);
			}
		},
		isCurrent(index) {
			return index === this.wordIndex;
		},
		updateQuery(w) {
			if (w) {
				return (this.q = w);
			} else if (this.suggests[this.wordIndex]) {
				this.q = this.suggests[this.wordIndex];
			} else if (this.wordInput) {
				this.q = this.wordInput;
			}
		},
		wordHighlight(w) {
			return w.replace(new RegExp(this.wordInput, "i"), "<mark>$&</mark>");
		},
		async suggestion_click(w) {
			this.$refs.input.focus();
			// this.OverrideFocus=true;
			await this.updateQuery(w);
			this.$refs.form.submit();
			// setTimeout(()=>{
			//   this.OverrideFocus=false;
			// },150);
		},
		async save_history(w) {
			var _Index = this.load_history.findIndex(
				e => e.toLowerCase() == w.toLowerCase()
			);
			if (_Index > -1) {
				this.load_history.unshift(this.load_history.splice(_Index, 1)[0]);
			} else {
				this.load_history.unshift(w);
			}

			localStorage.setItem(
				this.key_history,
				JSON.stringify(this.load_history.slice(0, 200))
			);
		},

		save_theme(index) {
			// this.available_theme.contains(index);
			// if (this.available_theme.includes(index)) {
			// 	localStorage.setItem(this.key_theme, index);
			// }
			if (this.available_theme[index] != undefined) {
				localStorage.setItem(this.key_theme, index);
			}
		},

		async input_submit() {
			this.$refs.form.submit();
			this.save_history(this.q);
		}
	},
	computed: {
		lastIndex() {
			return this.suggests.length - 1;
		},
		hasActive() {
			if (this.hasFocus && this.suggests.length) {
				return "active";
			} else if (this.hasFocus) {
				return "focus";
			}
		},
		/**
		 *
		 * @returns {string[]}
		 */
		load_history() {
			try {
				var e = localStorage.getItem(this.key_history);
				if (e) {
					var o = JSON.parse(e);
					if (Array.isArray(o)) return o;
				}
				return [];
			} catch (error) {
				return [];
			}
		},
		/**
		 *
		 * @returns {number}
		 */
		load_theme() {
			try {
				var e = localStorage.getItem(this.key_theme);
				if (e) {
					// this.available_theme.indexOf(e);
					// if (this.available_theme.indexOf(e)) {}
					// if (this.available_theme.includes(e)) {}
					if (this.available_theme[e] != undefined) {
						this.themeMode = e;
					}
				}
			} catch (error) {
				this.themeMode = 0;
			} finally {
				return this.themeMode;
			}
		}
	},
	mounted() {
		if (this.query) {
			this.save_history(this.query);
		}

		this.theme_apply();
		if (this.$refs.input != null) {
			this.$refs.input.focus();
		}
		console.log("mounted", this.q, this.themeMode);
	},
	// created() {}
	watch: {}
	// beforeCreate() {
	//   console.log('beforeCreate')
	// },
	// created() {
	//   console.log('created')
	// },
	// beforeMount() {
	//   console.log('beforeMount')
	// },
	// mounted() {
	//   console.log('mounted')
	// }
});

/*
new Vue({
  // router:router,
  data:{
    ready:false,
    loading:true,
    message:null,
    error:null,
    meta:{album:0,artist:0,genre:0,lang:[]},
    all:{
      // data:[],
      album:[],
      genre:[],
      artist:[],
      lang:[]
    },
    total:{
      track:0,
      album:0,
      artist:0
    },
    suggest:'ab?'
  },

  methods:{
    // async fetchTmp(){
    //   await this.$http.get('/api/track').then(response=>{
    //     this.all.data = response.data;
    //   }, error=>{
    //     this.error = error.statusText;
    //   });
    // },
    metadata(){
      const d = document.head.querySelector("[name~=application-name]").dataset;
      // for (const i of Object.keys(d)) this.meta[i]=d[i].includes(',')?d[i].split(','):parseInt(d[i]);
      for (const i of Object.keys(this.meta)) if (d.hasOwnProperty(i)) this.meta[i]=d[i].includes(',')?d[i].split(','):parseInt(d[i]);
      // await this.$http.get('/api').then(e=>this.meta = e.data, e=>this.error = e.statusText);
    },
    async fetch(uri){
      uri = uri.split("").reverse().join('');
      var id = uri.split('/').slice(-1)[0], k = id.split("").reverse().join('');
      var o = await this.getItem(k);
      if (JSON.stringify(o).length == this.meta[id]) {
        this.all[id] = o;
      } else {
        await this.$http.get(uri).then(response=>{
          this.all[id] = response.data;
        }, error=>{
          this.error = error.statusText;
        });
        await this.setItem(k,this.all[id]);
      }
    },
    async init(){
      // this.metadata();
      // await this.fetch('tsitra/ipa/');
      this.ready = true;
    },
    // async tmpartistSearch(artistName){
    //   var result = this.all.artist.filter(
    //     e=>e.thesaurus.find(
    //       s=> s.toLowerCase() == artistName.toLowerCase()
    //     ) || e.name.toLowerCase() == artistName.toLowerCase() || e.aka && e.aka == artistName || new RegExp(artistName, 'i').test(e.name)
    //   ).sort((a, b) => (a.plays < b.plays) ? 1 : -1);
    //   // console.log(this.all.artist[2]);

    //   result.forEach(e=>console.log(e.name));
    // },
    // async tmpartistName(artistName){
    //   var index = this.all.artist.findIndex(
    //     e=>e.thesaurus.find(
    //       s=> s.toLowerCase() == artistName.toLowerCase()
    //     ) || e.name.toLowerCase() == artistName.toLowerCase() || e.aka && e.aka == artistName
    //   );
    //   console.log(artistName,index)
    // },
    // async tmpAlbumList(langs){
    //   this.all.album.filter(
    //     album=>langs?album.lg == langs: true
    //   ).slice(0, 5).forEach(function(album,i){
    //     console.log(i,album.ab,album.tp)
    //   })
    // },
    // async getItem(k){
    //   return await JSON.parse(localStorage.getItem(k));
    // },
    // async setItem(k,v){
    //   localStorage.setItem(k, JSON.stringify(v));
    // }
  },
  watch: {
    // call again the method if the route changes
    // '$route': 'fetchTmp'

    suggest: function (value) {
        console.log(value);
    }

  },
  // async created() {
  //   await this.fetch('tsitra/ipa/');
  //   await this.fetch('erneg/ipa/');
  //   await this.fetch('mubla/ipa');
  //   await this.init();
  //   await this.tmpArtistSearch('zam');
  //   await this.tmpArtistName('jk kam');
  //   await this.tmpAlbumList();
  // },
  // beforeCreate() {},
  // created() {},
  // beforeMount() {},
  // mounted () {
  //   console.log(this.suggest)
  // },
  // render: h => h(main),
}).$mount('#abc');
*/
