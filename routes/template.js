import { route } from "lethil";

const routes = route("none", "/template");

routes.get(
	"/",
	/**
	 * @param {*} req
	 * @param {*} res
	 */
	function(req, res) {
		res.render("template/definition", { title: "testing", meta: {} });
	}
);
