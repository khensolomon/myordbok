import { server } from "lethil";
import { config, visits, language } from "../assist/index.js";

const app = server();
const routes = app.routes("/about", "page");

routes.register({ name: "about", text: "About" }, function(req, res) {
	res.render("about", {
		title: "About",
		keywords:
			"Myanmar dictionary, Burmesisk ordbok, Myanmar definition, Burmese, norsk ordbok, burmissk",
		description: "One of the most popular online Myanmar dictionary",
		dictionaries: language.list,
		visits: visits(),
		locale_total: config.locale.length,
		dictionaries_total: language.count
	});
});
