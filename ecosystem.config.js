// module.exports = {
// 	apps: [
// 		{
// 			name: "MyOrdbok",
// 			script: "./serve.js",
// 			watch: false,
// 			ignore_watch: ["[\\/\\\\]\\./", "node_modules"],
// 			env: {
// 				NODE_ENV: "production"
// 			},
// 			env_production: {
// 				NODE_ENV: "production"
// 			},
// 			error_file: "./log/pm2.err.log",
// 			out_file: "./log/pm2.out.log",

// 			instances: 1,
// 			exec_mode: "cluster"
// 		}
// 		// {
// 		//   name: "live",
// 		//   script: "./serve.js",
// 		//   instances: 1,
// 		//   exec_mode: "cluster"
// 		// }
// 	]
// };

export default {
	apps: [
		{
			name: "MyOrdbok",
			script: "./serve.js",
			watch: false,
			ignore_watch: ["[\\/\\\\]\\./", "node_modules"],
			env: {
				NODE_ENV: "production"
			},
			env_production: {
				NODE_ENV: "production"
			},
			error_file: "./log/pm2.err.log",
			out_file: "./log/pm2.out.log",

			instances: 1,
			exec_mode: "cluster"
		}
		// {
		//   name: "live",
		//   script: "./serve.js",
		//   instances: 1,
		//   exec_mode: "cluster"
		// }
	]
};
