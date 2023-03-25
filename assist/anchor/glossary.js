import { seek } from "lethil";
import * as env from "./env.js";
import { primary } from "./language.js";
import * as docket from "./json.js";

/**
 * ./cache/version-page-lang-query.json
 * version-page-query
 * @example cache("definition", keyword, lang)
 */
export class Cache {
	file = "";
	/**
	 * @param {string} page
	 * @param {string} [query=""] - empty
	 * @param {string} [lang=en] - language
	 * version-page-query
	 * @example cache("definition", keyword, lange
	 * ./cache/version/page-lang-query.json
	 */
	constructor(page, query = "", lang = "en") {
		if (this.enable) {
			this.file = seek
				.resolve(env.config.fileName.cache)
				// .replace("version", this.version)
				.replace("page", page)
				.replace("lang", lang)
				.replace("query", query.replace(/\s+/g, "_").trim());
		}
	}
	get version() {
		return env.config.version.replace(/\./g, "");
	}
	get enable() {
		return env.config.cacheDefinition == "true";
	}
	/**
	 * @template R
	 * @param {R} raw
	 * @returns {Promise<R>}
	 */
	async read(raw) {
		if (this.enable) {
			return docket.read(this.file, raw);
		}
		return raw;
	}
	/**
	 * @param {*} raw
	 * @returns {Promise<boolean>}
	 */
	async write(raw) {
		// console.log("Cache write is disabled");
		if (this.enable) {
			return docket.write(this.file, raw, 2);
		}
		return false;
	}
}

/**
 * Get resolved file path
 * @param {string} file
 * @param {string} [lang] - lang || primary.id
 */
export function get(file, lang) {
	return seek.resolve(env.config.media, file).replace(/EN/, lang || primary.id);
}

/**
 * @param {any} [lang] - lang || primary.id
 */
export function word(lang) {
	return get(env.config.fileName.word, lang);
}

export function sense() {
	return get(env.config.fileName.sense);
}

export function usage() {
	return get(env.config.fileName.usage);
}

export function synset() {
	return get(env.config.fileName.synset);
}

export function synmap() {
	return get(env.config.fileName.synmap);
}

/**
 * @param {string} [lang] - lang || primary.id
 */
export function info(lang) {
	return get(env.config.fileName.info, lang);
}

/**
 * @param {string} [lang] - lang || primary.id
 */
export function zero(lang) {
	return get(env.config.fileName.zero, lang);
}

/**
 * thesaurus
 */
export function thesaurus() {
	return get(env.config.fileName.thesaurus);
}

/**
 * read fileName 'info.*.json' and return
 * @param {string} lang - language shortname
 * returns {Promise<{title:string,keyword:string,description:string,info:[]}>}
 * @returns {Promise<any>}
 */
export async function stats(lang) {
	const src = info(lang);
	return await docket.read(src, {});
	// return await docket.read(info(lang), {});
}
