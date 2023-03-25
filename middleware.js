import { server } from "lethil";
import cookieParser from "cookie-parser";
import compression from "compression";
import { language } from "./assist/index.js";

const app = server();

app.disable("x-powered-by");
app.use(app.middleware.urlencoded({ extended: true }));
app.use(app.middleware.json());
app.use(cookieParser());
app.use(compression());

// if (app.config.development) {
// 	app.use(app.middleware.static("static"));
// 	// import("./webpack.middleware.js").then(mwa => {
// 	// 	app.use(mwa.hot);
// 	// 	app.use(mwa.dev);
// 	// });
// }

app.use(app.middleware.menu);
app.use(app.middleware.theme);

app.use(function(req, res, next) {
	var lang = language.byId(req.cookies.solId);
	res.locals.sol = lang || language.primary;

	// if (req.url) {
	// 	const [name, solName] = req.url.split("/").filter(e => e);
	// 	if (name == "dictionary" && solName) {
	// 		var l1 = language.byName(solName);
	// 		if (l1 && l1.id != Id) {
	// 			Id = l1.id;
	// 			res.cookie("solId", Id);
	// 		}
	// 	}
	// }

	res.locals.app_locale = app.config.locale;

	res.locals.appName = app.config.name;
	res.locals.appVersion = app.config.version;
	res.locals.appDescription = app.config.description;
	res.locals.environment = app.config.development;

	// if (req.headers.referer) {
	// 	var ref = parse.url(req.headers.referer);
	// 	res.locals.referer = req.headers.host == ref.host; // || app.config.user.referer.filter((e)=>e.exec(ref.host)).length > 0;
	// 	res.locals.host = ref.protocol + "//" + req.headers.host;
	// }

	next();
});

app.use("/api", app.middleware.guard);
