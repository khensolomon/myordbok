import { server } from "lethil";

const app = server();
const routes = app.routes("/terms", "terms");

routes.register({ name: "terms", text: "Terms" }, function(req, res) {
	res.render("terms", { title: "Terms" });
});
