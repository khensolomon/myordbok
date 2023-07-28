import { server } from "lethil";

const app = server();
const routes = app.routes("/privacy-policy", "terms");

routes.register({ name: "privacy-policy", text: "Privacy Policy" }, function(
	req,
	res
) {
	res.render("privacy-policy", { title: "Privacy Policy - MyOrdbok" });
});
