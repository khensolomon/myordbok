import path from "path";
import { seek } from "lethil";
import * as env from "./env.js";
import * as glossary from "./glossary.js";

export const data = {
	/**
	 * definition
	 * {"i":132,"w":66048,"t":0,"v":"..."}
	 * @type {env.TypeOfSense[]}
	 */
	sense: [],

	/**
	 * example
	 * {"i":132,"v":"..."}
	 * @type {env.TypeOfUsage[]}
	 */
	usage: [],

	/**
	 * words
	 * @type {env.TypeOfSynset[]}
	 */
	synset: [],

	/**
	 * derives
	 * @type {env.TypeOfSynmap[]}
	 */
	synmap: [],

	/**
	 * @type {env.TypeOfSynset[]}
	 */
	en: [],

	no: []
};

export const read = seek.ReadJSON;
export const write = seek.WriteJSON;

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
 * @param {boolean} [watchIt]
 * @returns {Promise<Array<any>>}
 */
export async function get(file, watchIt = false) {
	const src = path.resolve(env.config.media, file);
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

/**
 * todo return type
 * @template R
 * @param {R} [lang] - lang || primary.id
 * returns {Promise<env.RowOfLangTar||env.RowOfLangSrc>}
 */
export function getWord(lang) {
	return get(glossary.word(lang));
}
/**
 * @param {boolean} [watchIt]
 * @returns {Promise<env.TypeOfSense[]>}
 */
export function getSense(watchIt) {
	return get(env.config.fileName.sense, watchIt);
}
/**
 * @param {boolean} [watchIt]
 * @returns {Promise<env.TypeOfUsage[]>}
 */
export function getUsage(watchIt) {
	return get(env.config.fileName.usage, watchIt);
}
/**
 * @returns {Promise<env.TypeOfSynset[]>}
 */
export function getSynset() {
	return get(env.config.fileName.synset);
}
/**
 * @returns {Promise<env.TypeOfSynmap[]>}
 */
export function getSynmap() {
	return get(env.config.fileName.synmap);
}
