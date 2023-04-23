import { server } from "lethil";

import { language, docket } from "../assist/index.js";

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

		if (req.params.id) {
			var lang = language.byName(req.params.id);
			if (lang && lang.id != req.cookies.solId) {
				res.cookie("solId", lang.id);
				res.locals.sol = lang;
			}
		}
		docket
			.getInfo(res.locals.sol.id)
			.then(raw =>
				res.render("dictionary", {
					title: raw.title,
					keywords: raw.keyword,
					description: raw.description,
					pageClass: "dictionary",
					dictionaries: language.list,
					info: raw.info,
					dated: new Date(raw.dated)
				})
			)
			.catch(() => res.status(404).end());
	}
);
