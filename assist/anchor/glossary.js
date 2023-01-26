import path from "path";
import config from "./config.js";
import { primary } from "./language.js";
import { read } from "./json.js";

const { fileName } = config;

// const { media, fileName } = setting;
// fileName.word = path.join(media, fileName.word);
// fileName.sense = path.join(media, fileName.sense);
// fileName.usage = path.join(media, fileName.usage);
// fileName.synset = path.join(media,fileName.synset);
// fileName.synmap = path.join(media, fileName.synmap);
// fileName.zero = path.join(media, fileName.zero);
// fileName.info = path.join(media, fileName.info);
// fileName.thesaurus = path.join(media, fileName.thesaurus);
// fileName.sqlite = path.join(media, fileName.sqlite);

/**
 * @param {string} file
 * @param {string} [lang] - lang || primary.id
 */
export function get(file, lang) {
	return path.resolve(config.media, file).replace(/EN/, lang || primary.id);
}

/**
 * @param {any} [lang] - lang || primary.id
 */
export function word(lang) {
	return get(fileName.word, lang);
}

export function sense() {
	return get(fileName.sense);
}

export function usage() {
	return get(fileName.usage);
}

export function synset() {
	return get(fileName.synset);
}

export function synmap() {
	return get(fileName.synmap);
}

/**
 * @param {string} [lang] - lang || primary.id
 */
export function info(lang) {
	return get(fileName.info, lang);
}

/**
 * @param {string} [lang] - lang || primary.id
 */
export function zero(lang) {
	return get(fileName.zero, lang);
}

/**
 * thesaurus
 */
export function thesaurus() {
	return get(fileName.thesaurus);
}

/**
 * read fileName 'info.*.json' and return
 * @param {string} lang - language shortname
 * returns {Promise<{title:string,keyword:string,description:string,info:[]}>}
 * @returns {Promise<any>}
 */
export async function stats(lang) {
	const src = info(lang);
	return await read(src, {});
	// return await read(info(lang), {});
}
