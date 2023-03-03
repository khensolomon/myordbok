// import {seek,route} from 'lethil';
import { server } from "lethil";

import { language, glossary } from "../assist/index.js";

const app = server();
const routes = app.routes("/dictionary", "dictionary");

routes.register(
	{
		url: "/:id?",
		name: "dictionary",
		text: "Dictionary"
	},
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
			.catch(() => res.status(404).end());
	}
);
