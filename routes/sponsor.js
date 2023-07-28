import { server } from "lethil";

const app = server();
const routes = app.routes("/sponsor");

routes.register({ name: "sponsor", text: "Sponsor" }, function(req, res) {
	res.render("sponsor", { title: "Sponsor - MyOrdbok" });
});
