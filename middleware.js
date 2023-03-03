import { server, config, parse } from "lethil";
import cookieParser from "cookie-parser";
import compression from "compression";
import { language } from "./assist/index.js";

const app = server();

app.disable("x-powered-by");

app.use(cookieParser());

app.use(app.middleware.static("static"));
// if (config.development) {
// 	import("./webpack.middleware.js").then(mwa => {
// 		app.use(mwa.dev);
// 		app.use(mwa.hot);
// 	});
// }

app.use(compression());
app.use(app.middleware.menu);

app.use(function(req, res, next) {
	var Id = "";
	const l0 = language.primary;

	if (l0) {
		Id = l0.id;
	}

	if (req.cookies.solId != undefined) {
		Id = req.cookies.solId;
	} else {
		res.cookie("solId", Id);
	}

	var theme = "light";
	if (req.cookies.theme || req.cookies.theme != undefined) {
		theme = req.cookies.theme;
	} else {
		// NOTE: No need to set, client script should do it
		// res.cookie("theme", theme);
	}
	if (req.url) {
		const [name, solName] = req.url.split("/").filter(e => e);
		if (name == "dictionary" && solName) {
			var l1 = language.byName(solName);
			if (l1 && l1.id != Id) {
				Id = l1.id;
				res.cookie("solId", Id);
			}
		}
	}

	res.locals.app_locale = config.locale;
	res.locals.appTheme = theme;

	res.locals.appName = config.name;
	res.locals.appVersion = config.version;
	res.locals.appDescription = config.description;
	res.locals.environment = config.development;

	// if (req.headers.referer) {
	// 	var ref = parse.url(req.headers.referer);
	// 	res.locals.referer = req.headers.host == ref.host; // || config.user.referer.filter((e)=>e.exec(ref.host)).length > 0;
	// 	res.locals.host = ref.protocol + "//" + req.headers.host;
	// }
	res.locals.sol = language.byId(Id) || l0;
	next();
});

/**
 * org: restrictMiddleWare
 */
// app.use("/api", function(req, res, next) {
// 	if (res.locals.referer) return next();
// 	res.status(404).end();
// 	// if (req.xhr || req.headers.range) next();
// });
app.use("/api", function(req, res, next) {
	// config.referer.test(req.headers.host);
	if (req.headers.referer) {
		var ref = parse.url(req.headers.referer);
		res.locals.referer = req.headers.host == ref.host;

		// ref.host == host;
		// req.headers.referer -> https://myordbok.lethil.me
		// req.headers.host -> myordbok
		// req.headers.host -> myordbok.lethil.me
		// ref.host - myordbok.lethil.me
	}
	if (res.locals.referer) {
		// NOTE: internal
		return next();
	} else {
		// NOTE: external
		const base = Object.keys(config.restrict),
			user = Object.keys(req.query),
			key = base.find(e => user.includes(e));
		if (key && config.restrict[key] == req.query[key]) {
			return next();
		}
	}

	// if (res.locals.referer) {
	// 	// NOTE: internal
	// 	return next();
	// } else {
	// 	// NOTE: external
	// 	const base = Object.keys(config.restrict),
	// 		user = Object.keys(req.query),
	// 		key = base.find(e => user.includes(e));
	// 	if (key && config.restrict[key] == req.query[key]) {
	// 		return next();
	// 	}
	// }
	res.status(404).end();
});
