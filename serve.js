import pug from "pug";
import helmet from "helmet";
import core from "./core.js";
/**
 * Load Middleware
 */
import "./middleware.js";
/**
 * Load Route
 */
import "./route.js";

const app = core.server();
app.environment();

app.pug(file => pug.compileFile(file));
// app.use(helmet());
app.use(
	helmet({
		contentSecurityPolicy: false
	})
);

app.listen(app.config.listen, function() {
	var now = new Date().toLocaleDateString("en-GB", {
		weekday: "long",
		day: "2-digit",
		month: "short",
		year: "numeric",
		hour: "numeric",
		minute: "numeric",
		second: "numeric"
	});
	console.log("...", Number(app.config.listen.port), now);
});

app.close(function() {
	core.db.mysql.close();
});
