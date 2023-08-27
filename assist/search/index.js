// import { seek } from "lethil";
// import { words } from "./base.js";
// import definition from "./definition.js";

/**
 * search definition
 * @param {any} req
 * @example
 * search [task?]
 *
 * //request: GUI
 * routes.register({ text: "Definition" }, function(req, res) {
 *  search(req).then(raw => res.render("definition/layout", raw)).catch(e => res.status(404).send(e.message));
 * });
 *
 * //request: API
 * routes.register("/search", function(req, res) {
 *  search(req).then(raw => res.json(raw));
 * });
 *
 * //request: CLI
 * routes.register("search/:task?", async function(req) {
 *  return import("./search/index.js").then(e => e.default(req));
 * });
 */
export default async function main(req) {
	switch (req.params.task) {
		case "test":
			return import("./dev-test.js").then(async e => await e.default(req));
		case "med":
			return import("./dev-med.js").then(async e => await e.default(req));
		case "emd":
			return import("./dev-emd.js").then(async e => await e.default(req));
		default:
			// return definition(req);
			return import("./definition.js").then(async e => await e.default(req));
	}
}
