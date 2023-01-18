import { route } from "lethil";

const routes = new route.gui("none", "/template");

routes.get("/", function(req, res) {
	res.render("template/definition", { title: "testing", meta: {} });
});
