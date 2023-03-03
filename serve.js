import pug from "pug";
import core from "./core.js";
import "./middleware.js";
import "./route.js";

const app = core.server();
app.environment();

app.pug(file => pug.compileFile(file));

app.listen(app.config.listen, () => {
	// if (typeof app.address == "object") {
	// 	console.log(app.config.name, app.address.address, app.address.port);
	// } else {
	// 	console.log(app.config.name, app.address);
	// }
	console.log("listen", app.config.listen);
	// app.close();
});

// app.on("error", function(e) {
// 	console.error("...", e);
// });
