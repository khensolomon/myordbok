import { server } from "lethil";
import { search } from "../assist/index.js";

const app = server();
const routes = app.routes("/definition", "definition");

routes.register({ text: "Definition" }, function(req, res) {
	search(req)
		.then(raw => res.render("definition/layout", raw))
		.catch(e => res.status(404).send(e.message));
});
