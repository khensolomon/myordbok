import { server } from "lethil";

const app = server();
const routes = app.routes("/donate");

routes.register({ name: "donate", text: "Sponsor" }, function(req, res) {
	res.render("donate", {
		title: "Donate - MyOrdbok",
		description:
			"Any amount of contributions not only play a crucial role in serving others by helping us expand our services but also assist us in covering our monthly server costs. We utilize Google Compute Engine to host our services, and your support makes a significant difference."
	});
});
