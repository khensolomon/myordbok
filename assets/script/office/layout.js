import { getAuth, signOut } from "firebase/auth";

export default {
	// name: 'App',
	// props: ['name'],
	// data: () => {
	// 	ready: true,
	// 	loading: false,
	// 	routes: this.$router.options.routes
	// },
	data() {
		return {
			ready: false,
			routes: this.$router.options.routes
		};
	},
	inject: ["dataStore", "storageStore"],
	provide() {
		return {
			// dataStore: computed(() => this.dataStore),
			root: this,
			dataStore: this.dataStore,
			storageStore: this.storageStore
		};
	},
	components: {},
	methods: {
		signOutHandle() {
			const auth = getAuth();
			signOut(auth).then(() => {
				// router.push("/");
				// console.log(router);
				this.$router.push("/");
			});
		}
	},
	commpute: {
		routes() {
			return this.$router.options.routes;
		}
		// ready() {
		// 	return this.dataStore.ready;
		// }
	},
	// beforeCreate() {},
	// async created() {},
	// destroyed () {},
	mounted() {
		// if (this.dataStore.ready) {
		// 	this.ready = true;
		// }

		setTimeout(() => {
			this.ready = true;
			console.log("dataStore.ready", this.dataStore.ready);
		}, 1000);
	}
};
