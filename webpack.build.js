import path from "path";
import webpack from "webpack";
import { merge } from "webpack-merge";
import { CleanWebpackPlugin } from "clean-webpack-plugin";
import common from "./webpack.config.js";

// @ts-ignore
const config = merge(common, {
	mode: "production",
	devtool: "source-map",
	entry: {
		script: [
			path.resolve("./assets/script/analytics.js")
			// path.resolve('./assets/script/sw.register.js')
		]
		// sw:[
		//   path.resolve('./assets/script/sw.js')
		// ]
	},
	plugins: [new CleanWebpackPlugin()]
});

// @ts-ignore
const app = webpack(config);
// app.compile(function(e){
//   console.log(e);
// })
app.run(function(e) {
	console.log("...", e || "done");
});
