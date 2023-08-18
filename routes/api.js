import { server } from "lethil";
import { config, speech, grammar } from "../assist/index.js";

// import * as med from "../assist/med/index.js";
/**
 * deftype {undefined | string | any} q
 * @typedef {undefined | string | any} q
 */

// import * as bude from "../assist/med/index.js";

const app = server();
const routes = app.routes("/api");

routes.register("", (_req, res) => {
	// res.send({
	// 	name: config.name,
	// 	version: config.version,
	// 	development: config.development
	// });
	res.json({
		name: config.name,
		version: config.version,
		development: config.development
	});
});

// routes.register("/nav", (_req, res) => {
// 	// res.send({
// 	// 	name: config.name,
// 	// 	version: config.version,
// 	// 	development: config.development
// 	// });
// 	res.json(res.locals.nav);
// });

// routes.register("/config", (_req, res) => {
// 	res.json(config);
// });

routes.register("/speech", (req, res) => {
	res.set({
		"Content-Type": "audio/mpeg",
		"Accept-Ranges": "bytes",
		"Content-Transfer-Encoding": "binary",
		Pragma: "cache"
	});
	// res.setHeader("Content-Type", "audio/mpeg");
	// res.setHeader("Accept-Ranges", "bytes");
	// res.setHeader("Content-Transfer-Encoding", "binary");
	// res.setHeader("Pragma", "cache");

	// @ts-ignore
	speech(req.query).then(e => e.pipe(res));
});

// /**
//  * req.cookies.solId
//  */
// routes.register("/suggestion", (req, res) => {
// 	var q = req.query.q;
// 	suggestion(q, res.locals.sol.id)
// 		.then(raw => res.json(raw))
// 		.catch(e => res.status(404).end(e.message));
// });

/**
 * org: bude med
 * Myanmar English definition
 */
routes.register("/ome/:task?/:name?", async (req, res) => {
	return await import("../assist/ome/index.js")
		.then(async e => res.json(await e.default(req)))
		.catch(() => res.status(404).end(res.json([])));
});

/**
 * org: eod ome emo
 * English & other definition
 * req.cookies.solId
 */
routes.register("/oem/:task?/:name?", async (req, res) => {
	if (!req.query.lang || req.query.lang == "") {
		req.query.lang = res.locals.sol.id;
	}
	return await import("../assist/oem/index.js")
		.then(async e => res.json(await e.default(req)))
		.catch(() => res.status(404).end(res.json([])));
});

/**
 * search definition
 * @todo [search-prev] should be removed once it completed the new one
 */
// routes.register("/search-prev", (req, res) => {
// 	search(req).then(raw => res.json(raw));
// });

routes.register("/search/:task?", async (req, res) => {
	return await import("../assist/search/index.js")
		.then(async e => res.json(await e.default(req)))
		.catch(() => res.status(404).end(res.json([])));
});

/**
 * 150-180ms upto 555ms
 */
routes.register("/grammar", (req, res) => {
	grammar
		.main(req.query.q)
		.then(raw => res.json(raw))
		.catch(() => res.json([]));
});
routes.register("/grammar/pos", (req, res) => {
	grammar
		.pos()
		.then(raw => res.json(raw))
		.catch(() => res.json([]));
});
routes.register("/grammar/base", (req, res) => {
	grammar
		.base()
		.then(raw => res.json(raw))
		.catch(() => res.json([]));
});

// // /orths-:name
// routes.register('/orth', (req, res) => {
//   // req.params.name req.query.name
//   assist.orthCharacter(req.query.name).then(
//     raw=> res.send(raw)
//   ).catch(
//     ()=>res.status(404).end()
//   )
// });
// // orthword orthord orthnse orthble ortheak
// routes.register('/orth-word', (req, res) => {
//   assist.orthWord(req.query.ord).then(
//     raw=> res.send(raw)
//   ).catch(
//     ()=>res.status(404).end()
//   )
// });
// routes.register('/orth-sense', (req, res) => {
//   assist.orthSense(req.query.ord).then(
//     raw=> res.send(raw)
//   ).catch(
//     ()=>res.status(404).end()
//   )
// });
// routes.register('/orth-syllable', (req, res) => {
//   assist.orthSyllable(req.query.str).then(
//     raw=> res.send(raw)
//   ).catch(
//     ()=>res.status(404).end()
//   )
// });
// routes.register('/orth-break', (req, res) => {
//   assist.orthBreak(req.query.str).then(
//     raw=> res.send(raw)
//   ).catch(
//     ()=>res.status(404).end()
//   )
// });
