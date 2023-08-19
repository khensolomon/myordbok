// import path from "path";
import webpack from "webpack";
import { merge } from "webpack-merge";
import devMiddleware from "webpack-dev-middleware";
import hotMiddleware from "webpack-hot-middleware";
import common from "./webpack.config.js";

// @ts-ignore
const config = merge(common, {
	// target: "node",
	// mode: "development",
	devtool: "inline-source-map",
	entry: {
		script: [
			// "webpack-hot-middleware/client?path=/__webpack_hmr&reload=true&timeout=1000"
			"webpack-hot-middleware/client?path=/__webpack_hmr&timeout=1000&overlay=false"
			// path.resolve('./assets/script/analytics.js'),
			// path.resolve('./assets/script/sw.register.js')
		]
		// sw:[
		//   path.resolve('./assets/script/sw.js')
		// ]
	},
	plugins: [new webpack.HotModuleReplacementPlugin()]
});

//reload=true:Enable auto reloading when changing JS files or content
//timeout=1000:Time from disconnecting from server to reconnecting
// config.entry.app.unshift('webpack-hot-middleware/client?path=/__webpack_hmr&reload=true&timeout=1000');

//Add HMR plugin
// config.plugins.push(new webpack.HotModuleReplacementPlugin());

// @ts-ignore
const compiler = webpack(config);
// @ts-ignore
export const dev = devMiddleware(compiler);
// @ts-ignore
export const hot = hotMiddleware(compiler);
