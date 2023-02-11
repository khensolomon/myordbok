import { config, route, parse } from "lethil";

import { language } from "./assist/index.js";

const routes = new route.gui();

if (config.development) {
	import("./webpack.middleware.js").then(mwa => {
		routes.use(mwa.dev);
		routes.use(mwa.hot);
	});
}

routes.use(function(req, res, next) {
	// res.setHeader("X-Powered-By", "lethil");
	var Id = "";
	const l0 = language.primary;

	if (l0) {
		Id = l0.id;
	}

	if (req.cookies.solId || req.cookies.solId != undefined) {
		Id = req.cookies.solId;
	} else {
		res.cookies("solId", Id);
	}
	var theme = "light";
	if (req.cookies.theme || req.cookies.theme != undefined) {
		theme = req.cookies.theme;
	} else {
		// NOTE: No need to set, client script should do it
		// res.cookies("theme", theme);
	}
	if (req.url) {
		const [name, solName] = req.url.split("/").filter(e => e);
		if (name == "dictionary" && solName) {
			var l1 = language.byName(solName);
			if (l1 && l1.id != Id) {
				Id = l1.id;
				res.cookies("solId", Id);
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
// routes.use("/api", function(req, res, next) {
// 	if (res.locals.referer) return next();
// 	res.status(404).end();
// 	// if (req.xhr || req.headers.range) next();
// });
routes.use("/api", function(req, res, next) {
	// config.referer;
	// console.log("api", config.referer);
	// return next();
	if (req.headers.referer) {
		var ref = parse.url(req.headers.referer);
		res.locals.referer = req.headers.host == ref.host;

		console.log("req.headers.referer", req.headers.referer);
		console.log("req.headers.host", req.headers.host);
		console.log("ref.host", ref.host);
	}
	if (res.locals.referer) {
		console.log("res.locals.referer == true");
		// NOTE: internal
		next();
	} else {
		// NOTE: external
		const base = Object.keys(config.restrict),
			user = Object.keys(req.query),
			key = base.find(e => user.includes(e));
		if (key && config.restrict[key] == req.query[key]) {
			next();
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
	// res.status(404).end();
});
