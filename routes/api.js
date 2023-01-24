import { route, config } from "lethil";
import { search, speech, suggestion } from "../assist/index.js";

const routes = new route.gui("_", "/api");

routes.get("/", (_req, res) => {
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

routes.get("/config", (_req, res) => {
	res.json(config);
});

routes.get("/search", (req, res) => {
	search(req).then(raw => res.json(raw));
});

routes.get("/speech", (req, res) => {
	res.setHeaders({
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
routes.get("/suggestion", (req, res) => {
	suggestion(req.query.q, res.locals.sol.id)
		.then(raw => res.json(raw))
		.catch(e => res.status(404).end(e.message));
});

// routes.get('/grammar', (req, res) => {
//   assist.getGrammar().then(
//     raw=> res.send(raw)
//   ).catch(
//     ()=>res.status(404).end()
//   )
// });

// // /orths-:name
// routes.get('/orth', (req, res) => {
//   // req.params.name req.query.name
//   assist.orthCharacter(req.query.name).then(
//     raw=> res.send(raw)
//   ).catch(
//     ()=>res.status(404).end()
//   )
// });
// // orthword orthord orthnse orthble ortheak
// routes.get('/orth-word', (req, res) => {
//   assist.orthWord(req.query.ord).then(
//     raw=> res.send(raw)
//   ).catch(
//     ()=>res.status(404).end()
//   )
// });
// routes.get('/orth-sense', (req, res) => {
//   assist.orthSense(req.query.ord).then(
//     raw=> res.send(raw)
//   ).catch(
//     ()=>res.status(404).end()
//   )
// });
// routes.get('/orth-syllable', (req, res) => {
//   assist.orthSyllable(req.query.str).then(
//     raw=> res.send(raw)
//   ).catch(
//     ()=>res.status(404).end()
//   )
// });
// routes.get('/orth-break', (req, res) => {
//   assist.orthBreak(req.query.str).then(
//     raw=> res.send(raw)
//   ).catch(
//     ()=>res.status(404).end()
//   )
// });
