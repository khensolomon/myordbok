import { server } from "lethil";

const app = server();
const routes = app.routes("/cookie-policy", "terms");

routes.register({ name: "cookie", text: "Cookie Policy" }, function(req, res) {
	res.render("cookie-policy", { title: "Cookie Policy - MyOrdbok" });
});
