import { route } from "lethil";

const routes = route("navTerms", "/privacy");

routes.get(
	{ url: "/", route: "privacy", text: "Privacy" },
	/**
	 * @param {*} req
	 * @param {*} res
	 */
	function(req, res) {
		res.render("privacy", { title: "Privacy" });
	}
);
