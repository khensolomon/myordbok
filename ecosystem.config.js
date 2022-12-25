module.exports = {
	apps: [
		{
			name: "MyOrdbok",
			script: "./serve.js",
			// watch: true,
			// ignore_watch:["[\\/\\\\]\\./", "node_modules"],
			env: {
				NODE_ENV: "production"
			},
			env_production: {
				NODE_ENV: "production"
			},
			error_file: "./test/pm2.err.log",
			out_file: "./test/pm2.out.log",

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
