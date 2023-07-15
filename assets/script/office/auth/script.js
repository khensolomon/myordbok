export default {
	name: "Home",
	data: () => ({}),
	inject: ["root", "dataStore", "storageStore"],
	methods: {
		routerPush() {
			this.$router.push("/");
		}
	},
	// computed: {},
	created() {}

	// setup() {}
};
