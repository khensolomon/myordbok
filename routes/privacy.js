import { route } from "lethil";

const routes = new route.gui("navTerms", "/privacy");

routes.get({ url: "/", route: "privacy", text: "Privacy" }, function(req, res) {
	res.render("privacy", { title: "Privacy" });
});
