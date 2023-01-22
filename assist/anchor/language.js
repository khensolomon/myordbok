import { setting } from "./config.js";

const { dictionaries } = setting;

export const list = dictionaries;

export const count = dictionaries
	.map(continental => continental.lang.length)
	.reduce((a, b) => a + b, 0);

/**
 * @return {any}
 */
export const primary =
	dictionaries
		.map(continental =>
			continental.lang.filter(lang => lang.hasOwnProperty("default"))
		)
		.reduce((prev, next) => prev.concat(next), [])
		.find(lang => lang.id) || {};

/**
 * @param {string} name
 */
export function byName(name) {
	return dictionaries
		.map(continental =>
			continental.lang.filter(lang => new RegExp(name, "i").test(lang.name))
		)
		.reduce((prev, next) => prev.concat(next), [])
		.find(lang => lang.id);
}

/**
 * @param {any} id
 */
export function byId(id) {
	return dictionaries
		.map(continental => continental.lang.filter(lang => lang.id == id))
		.reduce((prev, next) => prev.concat(next), [])
		.find(lang => lang.id);
}

// export const language = {
//   default:primary,
//   list:dictionaries,
//   count:count,
//   byId:byId,
//   byName:byName,
// };
