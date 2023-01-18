import pug from "pug";
import core from "./core.js";
import "./middleware.js";
import "./route.js";

core.set("pug", pug);

const app = core.server();
app.environment();
const config = app.config;

app.listen(config.listen, () => {
	if (typeof app.address == "object") {
		console.log(config.name, app.address.address, app.address.port);
	} else {
		console.log(config.name, app.address);
	}
	// app.close();
});

app.on("error", function(e) {
	console.error("...", e);
});
