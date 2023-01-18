import { route } from "lethil";
import { search } from "../assist/index.js";

const routes = new route.gui("navDefinition", "/definition");

routes.get({ url: "/", route: "definition", text: "Definition" }, function(
	req,
	res
) {
	search(req)
		.then(raw => res.render("definition/layout", raw))
		.catch(e => res.status(404).end(e.message));
});
