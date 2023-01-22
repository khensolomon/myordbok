import { escape } from "querystring";
import { ask, config } from "lethil";
// import { setting } from "./config.js";

/**
 * @param {{q:string,l:string}} query
 * https://translate.google.com/translate_tts?ie=UTF-8&q=$q&tl=$l&client=tw-ob
 * https://www.googleapis.com/language/translate/v2?
 * https://translate.google.com/translate_a/single?
 * https://translation.googleapis.com/language/translate/v2?
 * https://translation.googleapis.com/language/translate/v2?source=en&target=my&q=love
 */
export function speech(query) {
	// return ask.request(setting.speechUrl.replace('$q',escape(query.q)).replace('$l',query.l));
	// return ask.stream(
	// 	setting.speechUrl.replace("$q", escape(query.q)).replace("$l", query.l)
	// );
	// console.log("setting.speechUrl", setting.speechUrl);
	// console.log("config.speechUrl", config.speechUrl);
	// return ask.stream(
	// 	"https://translate.google.com/translate_tts?ie=UTF-8&q=hello&tl=en&client=tw-ob"
	// );
	return ask.stream(
		config.speechUrl.replace("$q", escape(query.q)).replace("$l", query.l)
	);
}
