import { createRouter, createMemoryHistory } from "vue-router";

const routes = [
	{
		path: "/",
		name: "Office",
		// @ts-ignore
		component: () => import("./home/index.vue")
		// redirect: '/home'
	},
	{
		path: "/test",
		name: "TEst",
		// @ts-ignore
		component: () => import("./test/index.vue")
		// redirect: '/home'
	},
	{
		path: "/auth",
		name: "auth",
		// @ts-ignore
		component: () => import("./auth/index.vue"),
		meta: {
			mustAuthenticate: true
		}
	}
];

export default createRouter({
	// history: createWebHistory(),
	// history: createWebHashHistory(),
	history: createMemoryHistory(),

	routes // short for `routes: routes`
});

// Vue.use(VueRouter);

// export default new VueRouter({
// 	mode: "history",
// 	routes: routes
// });

// var router = new VueRouter({
//  routes:[
//   //  { path:'/settings', component: Settings }
//  ]
// });
