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
 * @param {string | undefined} [name]
 */
export function get(file, name = primary.id) {
	// name = name || primary.id || "";
	return file.replace(/EN/, name);
}

/**
 * @param {any} lang
 */
export function word(lang) {
	return get(glossary.word, lang);
}

/**
 * @param {any} lang
 */
export function info(lang = primary.id) {
	return get(glossary.info, lang);
}

/**
 * @param {any} lang
 */
export function zero(lang = primary.id) {
	return get(glossary.zero, lang);
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
