import { server } from "lethil";

const app = server();
const routes = app.routes("/", "page");

routes.register({ name: "home", text: "Home" }, function(req, res) {
	res.render("home", {
		title: "Myanmar dictionary",
		keywords: "Myanmar, dictionary, grammar, font, definition, Burmese, online",
		description:
			"A comprehensive online Myanmar dictionary, grammar, and fonts at MyOrdbok",
		pageClass: "home"
	});
});
