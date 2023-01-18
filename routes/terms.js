import { route } from "lethil";

const routes = new route.gui("navTerms", "/terms");

routes.get({ url: "/", route: "terms", text: "Terms" }, function(req, res) {
	res.render("terms", { title: "Terms" });
});
