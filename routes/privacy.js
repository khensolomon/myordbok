import { server } from "lethil";

const app = server();
const routes = app.routes("/privacy", "terms");

routes.register({ name: "privacy", text: "Privacy" }, function(req, res) {
	res.render("privacy", { title: "Privacy" });
});
