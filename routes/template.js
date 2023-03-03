import { server } from "lethil";

const app = server();
const routes = app.routes("/template");

routes.register("/", function(req, res) {
	res.render("template/definition", { title: "testing", meta: {} });
});
