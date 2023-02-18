import config from "./env.js";

const { dictionaries } = config;

export const list = dictionaries;

export const count = dictionaries
	.map(continental => continental.lang.length)
	.reduce((a, b) => a + b, 0);

/**
 * .find(lang => lang.id) | [0];
 * type {{id:string,name:string,my:string,default?:boolean}}
 */
export const primary = dictionaries
	.map(continental =>
		continental.lang.filter(lang => lang.hasOwnProperty("default"))
	)
	.reduce((prev, next) => prev.concat(next), [])[0];

/**
 * .find(lang => lang.id) | [0];
 * @param {string} name
 */
export function byName(name) {
	return dictionaries
		.map(continental =>
			continental.lang.filter(lang => new RegExp(name, "i").test(lang.name))
		)
		.reduce((prev, next) => prev.concat(next), [])[0];
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
