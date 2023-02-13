import path from "path";
import { seek } from "lethil";
import config from "./config.js";

export const data = {
	/**
	 * definition
	 * {"i":132,"w":66048,"t":0,"v":"..."}
	 * @type {{i:number,w:number,t:number,v:string}[]}
	 */
	sense: [],

	/**
	 * example
	 * {"i":132,"v":"..."}
	 * @type {{i:number,v:string}[]}
	 */
	usage: [],

	/**
	 * words
	 * {"w":2,"v":"..."}
	 * @type {{w:number, v:string}[]}
	 */
	synset: [],

	/**
	 * derives
	 * {"w":1,"v":"...","d":1,"t":0}
	 * @type {{w:number, v:string, d:number, t:number}[]}
	 */
	synmap: [],

	/**
	 * {"w":132,"v":"..."}
	 * @type {{w:number,v:string}[]}
	 */
	en: [],

	no: []
};

/**
 * @param {string} file
 * @param {any[]|any} raw
 * @param {number} [space]
 * @returns {Promise<boolean>}
 */
export async function write(file, raw, space = 0) {
	return await seek
		.write(file, JSON.stringify(raw, null, space))
		.then(() => true)
		.catch(() => false);
}

/**
 * @template T
 * @param {string} file
 * param {Array<any> | object} catchWith
 * returns {Promise<Array<any> | object>}
 * @param {T | []} [catchWith]
 * @returns {Promise<T>}
 */
export async function read(file, catchWith = []) {
	return await seek
		.read(file)
		.then(e => JSON.parse(e.toString()))
		.catch(() => catchWith);
}

/**
 * typedef {[keyof data]} abc
 * @param {string} file
 * param {string} id
 * @param {keyof data} id
 */
export function watch(file, id) {
	seek.watch(file, async () => (data[id] = await read(file)));
}

/**
 * @param {string} file
 * @param {boolean} watchIt
 * @returns {Promise<Array<any>>}
 */
export async function get(file, watchIt = false) {
	const src = path.resolve(config.media, file);
	/**
	 * @type {keyof data}
	 */

	// @ts-ignore
	const id = path.parse(file).name;
	if (data.hasOwnProperty(id) && Array.isArray(data[id]) && data[id].length) {
		return data[id];
	} else if (seek.exists(src)) {
		data[id] = await read(src);
		if (watchIt) watch(src, id);
		return data[id];
	}
	return [];
}
