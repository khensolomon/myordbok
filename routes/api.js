import { server } from "lethil";
import {
	config,
	search,
	speech,
	suggestion,
	grammar
} from "../assist/index.js";

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
routes.register("/nav", (_req, res) => {
	// res.send({
	// 	name: config.name,
	// 	version: config.version,
	// 	development: config.development
	// });
	res.json(res.locals.nav);
});

routes.register("/config", (_req, res) => {
	res.json(config);
});

routes.register("/search", (req, res) => {
	search(req).then(raw => res.json(raw));
});

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

// req.cookies.solId
routes.register("/suggestion", (req, res) => {
	suggestion(req.query.q, res.locals.sol.id)
		.then(raw => res.json(raw))
		.catch(e => res.status(404).end(e.message));
});

// 150-180ms upto 555ms
routes.register("/grammar", (req, res) => {
	grammar
		.main(req.query.q)
		.then(raw => res.json(raw))
		.catch(() => res.json([]));
});
routes.register("/grammar/pos", (req, res) => {
	grammar
		.pos(req.query.q)
		.then(raw => res.json(raw))
		.catch(() => res.json([]));
});
routes.register("/grammar/base", (req, res) => {
	grammar
		.base(req.query.q)
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
