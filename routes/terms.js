import { route } from "lethil";

const routes = route("navTerms", "/terms");

routes.get(
	{ url: "/", route: "terms", text: "Terms" },
	/**
	 * @param {*} req
	 * @param {*} res
	 */
	function(req, res) {
		res.render("terms", { title: "Terms" });
	}
);
