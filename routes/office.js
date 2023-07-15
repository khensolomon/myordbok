import { server } from "lethil";

const app = server();
const routes = app.routes("/office", "office");

routes.register({ name: "office", text: "Office" }, function(req, res) {
	res.render("office", { title: "Office", pageClass: "office" });
});
