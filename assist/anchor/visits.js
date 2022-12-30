import path from "path";
import { seek } from "lethil";

import { setting } from "./config.js";

/**
 * @param {any} str
 */
function formatData(str) {
	return new Date(str * 1000)
		.toISOString()
		.slice(0, 10)
		.replace(/-/g, "/");
}

/**
 * @param {string} str
 */
function formatNumber(str) {
	return str.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
}

const result = {
	created: "",
	user: "",
	request: "",
	by: "",
	total: "",
	fresh: ""
};
export function visits() {
	if (result.created == "") {
		var file = path.join(setting.media, "log", "myordbok.visit.log");
		if (seek.exists(file)) {
			var tpl = Object.keys(result);
			seek
				.readSync(file)
				.toString()
				.replace(/\r?\n|\r/g, "")
				.split(",")
				.filter(e => e.trim())
				.forEach((e, i) => {
					result[tpl[i]] = i > 0 ? formatNumber(e) : formatData(e);
				});
		}
	}
	return result;
}
