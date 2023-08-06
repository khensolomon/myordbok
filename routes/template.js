// import { server } from "lethil";

// const app = server();
// // const routes = app.routes("/template");
// const routes = app.routes("/template", "abc");

// routes.register("/", function(req, res) {
// 	res.render("template/definition");
// });

import { server } from "lethil";

const app = server();
const routes = app.routes("/template");

routes.register({ name: "template", text: "Template" }, function(req, res) {
	res.render("template/definition", { title: "Template - MyOrdbok" });
});
