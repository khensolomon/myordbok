import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

import vitePluginDynamicSvg from "./svg-loader.js";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");
	const isProduction = mode === "production";
	const portCore = env.APP_PORT || 3020;
	const portVite = 3021; // Port for Vite's dev server

	return {
		// 1. ADD THIS LINE: It must exactly match your Django STATIC_URL
		base: "/static/",
		root: __dirname,
		plugins: [vue(), vitePluginDynamicSvg()],

		// Translates your webpack.DefinePlugin
		define: {
			__VUE_OPTIONS_API__: true,
			__VUE_PROD_DEVTOOLS__: false,
			__VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
		},

		resolve: {
			extensions: [".js", ".vue", ".json"],
			alias: {
				vue: "vue/dist/vue.esm-bundler.js",
			},
		},

		// Translates your devServer setup
		server: {
			port: portVite,
			// host: "0.0.0.0",
			cors: true, // Translates your Access-Control-Allow-Origin setup
			strictPort: true,
			host: true,
			// 1. ADD THIS MAGIC LINE:
			// It forces all asset URLs inside CSS to point to the Vite server during dev
			origin: `http://localhost:${portVite}`,
			watch: {
				// Needed if your OS (Windows/macOS) doesn't propagate file events to Docker
				usePolling: true,
			},
			hmr: {
				// Tell the browser to connect to Nginx for HMR updates
				// clientPort: 80,
				// Tell the browser to connect to Vite directly for HMR updates
				clientPort: portVite,
			},
			proxy: {
				// 1. Explicitly catch the exact root URL and send it to Django
				"^/$": {
					target: `http://web:${portCore}`,
					changeOrigin: true,
				},
				// 2. Your existing rules for other Django paths
				// Proxies Django requests so you only need to look at port 3021
				"^/(admin|api|media)": {
					target: `http://web:${portCore}`,
					changeOrigin: true,
				},
			},
		},

		// Translates your sass-loader options
		css: {
			preprocessorOptions: {
				scss: {
					api: "modern-compiler",
					silenceDeprecations: ["legacy-js-api"],
					quietDeps: true,
				},
			},
		},

		assetsInclude: ["**/*.webmanifest", "**/*.txt"],

		// Translates your output, optimization, and chunks logic
		build: {
			// Where Django expects to find the built files
			outDir: path.resolve(__dirname, "../../static"),
			emptyOutDir: true, // Translates clean: true
			manifest: true, // CRITICAL: This replaces webpack-bundle-tracker!
			sourcemap: !isProduction,

			// 2. Disable the 4kb inline limit so tiny files aren't swallowed into the JS
			assetsInlineLimit: 0,

			rollupOptions: {
				// 1. Define your multiple entry points
				// Translates your entry object
				input: {
					main: path.resolve(__dirname, "./index.js"),
					"sw-register": path.resolve(__dirname, "../script/sw-register.js"),
					"sw-installer": path.resolve(__dirname, "../script/sw-installer.js")
				},
				output: {
					// // Translates your filename and chunkFilename logic exactly
					// entryFileNames: (assetInfo) => {
					//   if (assetInfo.name.includes('sw-')) return '[name].js';
					//   return '[name]-[hash].js';
					// },
					// chunkFileNames: (assetInfo) => {
					//   if (assetInfo.name.includes('sw-')) return '[name].js';
					//   return '[name]-[hash].js';
					// },
					// // Translates your assetModuleFilename
					// assetFileNames: 'assets/[name]-[hash][extname]',
					// 2. Control the output filenames dynamically
					entryFileNames: (assetInfo) => {
						// If the file is a service worker, output it WITHOUT a hash
						if (assetInfo.name.includes("sw-")) {
							return "[name].js";
						}
						// Otherwise, hash it normally for cache busting
						return "assets/[name]-[hash].js";
					},

					// 3. Do the same for chunks (files dynamically imported via import())
					chunkFileNames: (assetInfo) => {
						if (assetInfo.name.includes("sw-")) {
							return "[name].js";
						}
						return "assets/[name]-[hash].js";
					},

					// 4. Standard assets (CSS, Images, etc.)
					// assetFileNames: "assets/[name]-[hash][extname]",
					// 3. THIS IS THE NEW MAGIC:
					assetFileNames: (assetInfo) => {
						// Rollup 4 API: Use .names[0] or .originalFileName instead of the deprecated .name
						// const fileName = assetInfo.names?.[0] || assetInfo.originalFileName || "";
						// Strictly use the plural arrays (names, originalFileNames) to satisfy TypeScript and Rollup 4
						const fileName =
							assetInfo.names?.[0] ?? assetInfo.originalFileNames?.[0] ?? "";

						const noHashFiles = [
							"favicon",
							"logo",
							"apple-touch-icon",
							"android-chrome",
							"app.webmanifest",
							"robots.txt",
						];

						// Safely check against the extracted string
						if (noHashFiles.some((keyword) => fileName.includes(keyword))) {
							// Output to the root static folder without a hash
							return "[name][extname]";
						}

						// Everything else goes to the assets folder with a hash
						return "assets/[name]-[hash][extname]";
					},
				},
			},
		},
	};
});