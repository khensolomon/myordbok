import { config } from "lethil";
import path from "path";
import { setting } from "./config.js";
import { primary } from "./language.js";
import { read } from "./json.js";

const { glossary } = setting;

// const { media, glossary } = setting;
// glossary.word = path.join(media, "glossary", glossary.word);
// glossary.sense = path.join(media, "glossary", glossary.sense);
// glossary.usage = path.join(media, "glossary", glossary.usage);
// glossary.synset = path.join(media, "glossary", glossary.synset);
// glossary.synmap = path.join(media, "glossary", glossary.synmap);
// glossary.zero = path.join(media, "glossary", glossary.zero);
// glossary.info = path.join(media, "glossary", glossary.info);
// glossary.thesaurus = path.join(media, "glossary", glossary.thesaurus);
// glossary.sqlite = path.join(media, "glossary", glossary.sqlite);

/**
 * @param {string} file
 * @param {string} [lang] - lang || primary.id
 */
export function get(file, lang) {
	return path.resolve(config.media, file).replace(/EN/, lang || primary.id);
}

/**
 * @param {any} lang
 */
export function word(lang) {
	return get(glossary.word, lang);
}

/**
 * @param {string} [lang] - lang || primary.id
 */
export function info(lang) {
	return get(glossary.info, lang || primary.id);
}

/**
 * @param {string} [lang] - lang || primary.id
 */
export function zero(lang) {
	return get(glossary.zero, lang || primary.id);
}

/**
 * thesaurus
 */
export function thesaurus() {
	return get(glossary.thesaurus);
}

/**
 * read glossary 'info.*.json' and return
 * @param {string} lang - language shortname
 * returns {Promise<{title:string,keyword:string,description:string,info:[]}>}
 * @returns {Promise<any>}
 */
export async function stats(lang) {
	const src = path.resolve(config.media, info(lang));
	return await read(src, {});
	// return await read(info(lang), {});
}

// fileName
// export const gloasary = {
//   get:get,
//   word:word,
//   info:info,
//   zero:zero
// };
