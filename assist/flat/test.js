import * as base from "./base.js";
import { doSynmap } from "../cast/search.js";

/**
 * @param {*} req
 */
export default async function test(req) {
	return "done";
}

/**
 * @param {any} req
 */
export async function doAuto(req) {
	return new Promise(function(resolve, reject) {
		const flat = new base.flat(req.query);
		const reader = flat.readFlat();
		// reader.on("row", row => {
		// 	// row.orange = true;
		// 	// console.log("row", row);
		// });

		reader.on("finish", async raw => {
			/**
			 * @type {any[]}
			 */
			const tmp = [];
			for (const key in raw) {
				if (Object.hasOwnProperty.call(raw, key)) {
					const val = raw[key];
					const res = await doSynmap(val.word);
					if (res.length) {
						const checkIndex = tmp.findIndex(e => e.word == val.word);
						if (checkIndex == -1) {
							console.log(" >", val.word, res);
							tmp.push({ word: val.word, status: res.join(",") });
						}
					}
				}
			}
			const writer = flat.writeFlat({
				suffix: "checked",
				raw: tmp,
				header: ["word", "status"]
			});

			writer.on("finish", function() {
				// console.log("finish");
				// process.exit();
				resolve("done");
			});
		});
	});
}

/**
 * test
 * @param {any} req
 * @param {(value: any) => void} resolve
 * @param {(reason?: any) => void} reject
 */
export async function test_org(req, resolve, reject) {
	const flat = new base.flat(req.query);

	// flat.readFlat({
	// 	cell: function(str) {
	// 		return burglish(str).toUnicode;
	// 	},
	// 	finish: function(data) {
	// 		// console.log("write flat", data);
	// 		flat.writeFlat();
	// 		// console.log("write json", data);
	// 		// flat.writeJSON({ file: "./cache/json.testing.json", space: 2 });
	// 	}
	// });

	const reader = flat.readFlat({
		// modifier: function(str) {
		// 	return burglish(str).toUnicode;
		// }
	});

	reader.on("cell", val => {
		// console.log("cell", val);
		val = "a";
	});
	reader.on("row", async row => {
		// row.orange = true;
		// console.log("row", row);
	});
	reader.on("finish", raw => {
		// flat.writeFlat();
		// console.log("raw", raw);
	});

	// flat.readJSON().then(function(data) {
	// 	// abc.writeJSON({ file: "./cache/json.testing.csv" });
	// 	flat.writeFlat({ file: "./cache/json.testing.tsv" });
	// });
	// flat.readJSON().then(function(data) {
	// 	flat.writeFlat({ file: "./cache/json.testing.tsv" });
	// });

	// readline.on("close", () => {
	// 	console.log("finish", abc.data);
	// });
	// abc.readline(function(data) {
	// 	console.log("finish", data);
	// });
}
