// import { clue } from "../anchor/index.js";
import { seed } from "../anchor/index.js";
import { rawObject, rawPage } from "./base.js";
import * as dme from "./dme.js";
import * as dem from "./dem.js";

/**
 * unwarrantable
 * @typedef {Object.<string, any>} TypeOfSearchRequest
 * @param {TypeOfSearchRequest} req
 */
export default async function search(req) {
	const raw = rawObject(req);

	const keyword = raw.meta.q;

	raw.query = seed.query(keyword);

	if (keyword) {
		if (raw.meta.isMyanmar) {
			// NOTE: Myanmar-English
			raw.lang.tar = "my";
			if (await dme.asDefinition(raw)) {
				// NOTE: definition
				raw.query.status = false;
				rawPage(raw, 3);
			} else if (await dme.asSentence(raw)) {
				// NOTE: sentence
				rawPage(raw, 4);
			}
		} else if (raw.meta.isEnglish) {
			// NOTE: English-Myanmar
			if (await dem.asDefinition(raw)) {
				// NOTE: definition
				raw.query.status = false;
				rawPage(raw, 3);
			} else if (await dem.asSentence(raw)) {
				// NOTE: sentence
				rawPage(raw, 4);
			}
		} else {
			// NOTE: [no,ar, etc]-English translation
		}
	} else {
		// NOTE: pleaseenter
		rawPage(raw, 1);
	}

	seed.logKeyword(raw.query.word, raw.lang.tar, raw.data.length);

	return raw;
}
