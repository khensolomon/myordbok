import { server } from "lethil";

const app = server();
const routes = app.routes("/terms-of-service", "terms");

routes.register({ name: "terms", text: "Terms" }, function(req, res) {
	res.render("terms-of-service", { title: "Terms of service - MyOrdbok" });
});
