import path from "path";
// import fs from "fs";
// import util from "util";
import { seek, parse, param, fire } from "lethil";
// import { config } from "../anchor/index.js";
import { default as wordbreak } from "./index.js";

// const { fileName } = config;

// const mediaTest = path.join(config.media,'test');

/**
 * @param {string} file
 * @returns {Promise<string[]>}
 */
async function readFile(file) {
	return seek
		.read(file)
		.then(function(e) {
			// if (isJSON) {
			// 	const content = JSON.parse(e);
			// 	if (content instanceof Array) {
			// 		return content;
			// 	}
			// } else {
			// 	return fire.array.unique(parse.csv(e));
			// }

			try {
				if (typeof e == "string") {
					return JSON.parse(e);
				}
				throw "?";
			} catch (error) {
				return fire.array.unique(parse.csv(e));
			}
		})
		.catch(() => []);
}

/**
 * @param {string} file
 * param {string | Uint8Array} raw
 * @param {string | Uint8Array} raw
 * @returns {Promise<boolean>}
 */
async function writeFile(file, raw) {
	// path.join(config.media, "test", file);
	if (typeof raw != "string") {
		raw = JSON.stringify(raw, null, 1);
	}
	return seek
		.write(file, raw)
		.then(function(_e) {
			return true;
		})
		.catch(() => false);
}

class Assignments {
	/**
	 * Working
	 * @param {string} [keyword]
	 */
	default(keyword) {
		if (keyword) {
			const result = wordbreak(keyword);
			return result;
		} else {
			return "default ?";
		}
	}

	/**
	 * @param {string } [file] - ./assist/wordbreak/word.csv
	 */
	async file(file = "./assist/wordbreak/word.csv") {
		const src = await readFile(file);

		const tar = src.map(function(keyword) {
			return {
				[keyword]: wordbreak(keyword)
			};
		});

		var res = "";

		for (const key in tar) {
			if (Object.hasOwnProperty.call(tar, key)) {
				const element = tar[key];
				const name = Object.keys(element)[0];
				res += name;
				res += "\r\n";

				// console.log(element);

				for (const k in element[name]) {
					if (Object.hasOwnProperty.call(element[name], k)) {
						const es = element[name][k];
						// console.log(es);

						res += ` ${es.id} ${es.word}\r\n`;
						// res += "";
					}
				}
			}
		}

		const tarFileName = path.basename(file);
		const tarFilePath = file.replace(
			tarFileName,
			tarFileName.replace(/.([^.]*)$/, "-result.v0.$1")
			// tarFileName.replace(/.([^.]*)$/, ".v0.json")
		);

		return writeFile(tarFilePath, res)
			.then(function(e) {
				return `> total:${tar.length}, at:${tarFilePath}`;
			})
			.catch(function(e) {
				return e;
			});
	}
}

const cliTask = new Assignments();

/**
 * @param {any} req
 * @example
 * node run wordbreak
 * node run wordbreak loving
 * node run wordbreak file ./assist/wordbreak/word.csv
 */
export default function(req) {
	if (param.length > 1) {
		/**
		 * @type {keyof cliTask}
		 */
		// @ts-ignore - nothing is wrong with es6
		const name = param[1];
		if (name in cliTask && typeof cliTask[name] == "function") {
			return cliTask[name](param[2]);
		}
		return cliTask.default(name);
	}
	return cliTask.default();
}
