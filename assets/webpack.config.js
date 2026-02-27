const path = require("path");
const webpack = require("webpack");
const BundleTracker = require("webpack-bundle-tracker");
const { VueLoaderPlugin } = require("vue-loader");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");

const staticPath = "../static/";

// Manually parse Node's process.argv to detect the --mode flag from the CLI
const modeIndex = process.argv.indexOf('--mode');
const isProduction = process.argv.includes('--mode=production') || 
					 (modeIndex !== -1 && process.argv[modeIndex + 1] === 'production');

module.exports = {
	context: __dirname,
	mode: isProduction ? "production" : "development",
	
	// IMPROVEMENT 2: Source Maps for debugging
	devtool: isProduction ? "source-map" : "eval-source-map",

	entry: {
		main: "./webpack/index.js",
	},

	output: {
		path: path.resolve(__dirname, staticPath),
		publicPath: isProduction ? staticPath.replace(/\./g, "") : "http://localhost:8080/",
		filename: "[name]-[fullhash].js",
		// Use a chunkhash for split chunks to ensure optimal caching
		chunkFilename: "[name]-[chunkhash].js", 
		assetModuleFilename: "assets/[name]-[hash][ext]",
		clean: true,
	},

	// IMPROVEMENT 4: Persistent File System Cache (Massive speed boost)
	cache: {
		type: 'filesystem',
	},

	devServer: {
		host: "0.0.0.0",
		port: 8080,
		headers: {
			"Access-Control-Allow-Origin": "*",
		},
		hot: true,
		allowedHosts: "all",
	},

	resolve: {
		extensions: [".js", ".vue", ".json"],
		alias: {
			vue$: "vue/dist/vue.esm-bundler.js",
		},
	},

	// IMPROVEMENT 3 & 5: Optimization, CSS Minification & Code Splitting
	optimization: {
		minimize: isProduction,
		minimizer: [
			// Minifies JS (Webpack's default plugin, but we must explicitly include '...' to extend it)
			`...`, 
			// Minifies CSS
			new CssMinimizerPlugin(),
		],
		splitChunks: {
			chunks: 'all', // Automatically split vendor code (node_modules) into a separate file
			name: 'vendor', // Names the resulting chunk 'vendor-[hash].js'
		},
	},

	plugins: [
		new BundleTracker({
			path: path.resolve(__dirname, staticPath),
			filename: "webpack-stats.json",
		}),
		new VueLoaderPlugin(),
		new MiniCssExtractPlugin({
			filename: "[name]-[fullhash].css",
		}),
		// IMPROVEMENT 1: Vue 3 Feature Flags (Strips dead code in production)
		new webpack.DefinePlugin({
			__VUE_OPTIONS_API__: true,
			__VUE_PROD_DEVTOOLS__: false,
			__VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
		}),
	],

	module: {
		rules: [
			{
				test: /\.vue$/,
				loader: "vue-loader",
			},
			{
				test: /\.js$/,
				exclude: /node_modules/,
				use: ["babel-loader"],
			},
			{
				test: /\.(sa|sc|c)ss$/i,
				use: [
					isProduction ? MiniCssExtractPlugin.loader : "style-loader",
					"css-loader",
					"sass-loader",
				],
			},
			{
				test: /\.svg$/i,
				type: "asset/resource",
				sideEffects: true,
				use: [
					{
						loader: path.resolve(__dirname, "svg-loader.js"),
					},
				],
				generator: {
					filename: (pathData) => {
						const queryStr = pathData.module.resourceResolveData?.query || "";
						const query = new URLSearchParams(queryStr);
						const as = query.get("as");
						const format = query.get("format");

						if (as) {
							if (format) return `${as}.${format}`;
							if (as.includes("favicon") || as.includes("apple") || as.includes("chrome")) {
								return `${as}.png`;
							}
							return `${as}[ext]`;
						}
						return "[name][ext]";
					},
				},
			},
			{
				test: /\.(png|ico|jpg|gif|eot|ttf|woff|woff2|webmanifest)$/,
				type: "asset/resource",
				sideEffects: true,
				generator: {
					filename: "[name][ext]",
				},
			},
		],
	},
};