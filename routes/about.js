import { route } from "lethil";
import { config, visits, language } from "../assist/index.js";

const routes = new route.gui("navPage", "/");

routes.get({ url: "/about", route: "about", text: "About" }, function(
	_req,
	res
) {
	res.render("about", {
		title: "About",
		keywords:
			"Myanmar dictionary, Burmesisk ordbok, Myanmar definition, Burmese, norsk ordbok, burmissk",
		description: "About MyOrdbok, Free online Myanmar dictionaries",
		dictionaries: language.list,
		visits: visits(),
		locale_total: config.locale.length,
		dictionaries_total: language.count
	});
});
