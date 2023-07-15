import { check, utility } from "lethil";

import { infoCache } from "../anchor/seed.js";

import { primary } from "../anchor/language.js";
import * as env from "../anchor/env.js";

/**
 * @typedef {Object} TypeOfSearchSettings
 * @property {env.TypeOfSearchLanguage} lang
 * @property {string[]} type
 * @property {any} meta
 * property {env.TypeOfSearchResult} result
 * @property {(word:string, lang:string)=>infoCache} cacheController
 * property {infoCache} cacheController
 */

/**
 * @type {TypeOfSearchSettings} settings
 */
export const settings = {
	lang: {
		tar: "en",
		get src() {
			return primary.id;
		}
	},
	type: ["notfound", "pleaseenter", "result", "definition", "translation"],
	meta: {
		auto: {
			title: env.meta.title,
			description: env.meta.description,
			keywords: env.meta.keywords
		},
		derive: {
			title: "derived " + env.meta.title,
			description: "derived " + env.meta.description,
			keywords: "derived " + env.meta.keywords
		}
	},

	cacheController(word, lang) {
		// return new infoCache("definition", word, lang);
		return new infoCache({ page: "definition", keyword: word, lang: lang });
	}
};

/**
 * Merge settings and request object
 * @param {any} req
 */
export function rawObject(req) {
	const keyword = check.isValid(req.query.q || "");
	let raw = Object.assign({}, env.result, {
		meta: {
			q: keyword,
			type: settings.type[0],
			/**
			 * if myanmar char contains
			 */
			get isMyanmar() {
				return utility.isMyanmarText(keyword);
			},
			/**
			 * if target and source the same
			 */
			get isEnglish() {
				return raw.lang.tar == raw.lang.src;
			},
			name: "",
			msg: [],
			todo: [],
			sug: []
		},
		lang: {
			tar: settings.lang.tar,
			src: settings.lang.src
		},
		revised: new Date().toLocaleDateString("en-GB", {
			weekday: "long",
			day: "2-digit",
			month: "long",
			year: "numeric"
		}),
		revised_version: "",
		data: []
	});

	if (req.cookies && req.cookies.solId) {
		raw.lang.tar = req.cookies.solId;
	} else if (raw.lang.tar == "") {
		// NOTE: possibly attacks
		// curl http://localhost:8082/definition?q=love
	}

	// NOTE: testing purpose ?language=[no,en,ja]
	if (req.query.language) {
		raw.lang.tar = req.query.language;
	}
	return raw;
}

/**
 * org: setPageProperty
 * set page
 * @param {env.TypeOfSearchResult} raw
 * @param {number} id
 * @example
 * rawPage(o, 0) -> notfound
 * rawPage(o, 1) -> pleaseenter
 * rawPage(o, 2) -> result
 * rawPage(o, 3) -> definition
 * rawPage(o, 4) -> translation
 */
export function rawPage(raw, id) {
	if (raw.meta.type == settings.type[0]) {
		if (settings.type[id]) {
			raw.meta.type = settings.type[id];
			if (id > 2) {
				// NOTE: Used in pug
				raw.meta.type = settings.type[2];
				raw.meta.name = settings.type[id];
			}
		}
	}
}
