// import {seek,route} from 'lethil';
import { route } from "lethil";

import { language, glossary } from "../assist/index.js";
const routes = route("navDictionary");

routes.get(
	{ url: "/dictionary/:id?", route: "dictionary", text: "Dictionary" },
	/**
	 * @param {*} req
	 * @param {*} res
	 */
	function(req, res) {
		// read(info(lang), {});
		// const src = path.resolve(config.media, file);
		glossary
			.stats(res.locals.sol.id)
			.then(raw =>
				res.render("dictionary", {
					title: raw.title,
					keywords: raw.keyword,
					description: raw.description,
					pageClass: "dictionary",
					dictionaries: language.list,
					info: raw.info
				})
			)
			.catch(() => res.status(404).send());
	}
);
