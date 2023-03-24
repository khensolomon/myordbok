import { db } from "lethil";
// import { write } from "lethil/types/aid/seek.js";
import * as dictionary from "./dictionary.js";
// import { env } from "../anchor/index.js";
// import { parse } from "csv";

/**
 * @param {any} req
 * @param {(value: any) => void} resolve
 * @param {(reason?: any) => void} reject
 * SQLite testing
 * @example
 * node run flat --file=./cache/saidict.csv delimiter=comma header=true
 * node run flat --file=./cache/saidict.tsv delimiter=tab header=true quoted=double|single
 * node run flat --file=./cache/saidict.json delimiter=tab header=true quoted=double|single
 * node run flat --file=./cache/ruenmmeleengdict.tsv header=true
 */
export async function test(req, resolve, reject) {
	const flat = new db.flat(req.query);

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

/**
 * @param {any} req
 * @param {(value: any) => void} resolve
 * @param {(reason?: any) => void} reject
 * resolve: (value: any) => void, reject: (reason?: any) => void
 */
export async function check(req, resolve, reject) {
	const flat = new db.flat(req.query);
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
				const res = await dictionary.search(val.word);
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
}

/**
 * @param {*} req
 * @returns
 */
export default function(req) {
	return new Promise(function(resolve, reject) {
		return check(req, resolve, reject);
	});
}
