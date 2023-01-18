import { route } from "lethil";

const routes = new route.gui("navPage", "/");

routes.get({ url: "", route: "home", text: "Home" }, function(req, res) {
	res.render("home", {
		title: "Myanmar dictionary",
		keywords: "Myanmar, dictionary, grammar, font, definition, Burmese, online",
		description:
			"A comprehensive online Myanmar dictionary, grammar, and fonts at MyOrdbok",
		pageClass: "home"
	});
});
