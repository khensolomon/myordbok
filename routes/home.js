import { route } from "lethil";

const routes = route("navPage", "/");

routes.get(
	{ url: "", route: "home", text: "Home" },
	/**
	 * @param {*} req
	 * @param {*} res
	 */
	function(req, res) {
		res.render("home", {
			title: "Myanmar dictionary",
			keywords:
				"Myanmar, dictionary, grammar, font, definition, Burmese, online",
			description:
				"A comprehensive online Myanmar dictionary, grammar, and fonts at MyOrdbok",
			pageClass: "home"
		});
	}
);
