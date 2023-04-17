import { command } from "lethil";
import { thuddar } from "./anchor/index.js";
// import * as gist from "./admin/gist.js";
import * as working from "./admin/working.js";
import * as sqlite from "./admin/sqlite.js";

const app = command();
const routes = app.routes();

// routes.register;
routes.register("", () => "?");
routes.register("apple", () => "Did you know apple is fruit?");
routes.register("orange", () => "Orange is good for health");
routes.register("req", req => req);

routes.register("ecosystem", async function(req) {
	return import("./admin/deployment.js").then(e => e.createOrUpdate(req));
});

routes.register("environment", async function(req) {
	return import("./admin/deployment.js").then(e => e.transferEnvironment(req));
});

routes.register("export-grammar", thuddar.update);

routes.register("export-sqlite-test", sqlite.main);

routes.register("works", working.main);

routes.register("wordbreak", async function(req) {
	return import("./wordbreak/test.js").then(e => e.default(req));
});

routes.register("cast/:task?/:name?", async function(req) {
	return import("./cast/index.js").then(e => e.default(req));
});

routes.register("gist/:task?/:name?", async function(req) {
	return import("./gist/index.js").then(e => e.default(req));
});

routes.register("flat/:task?/:name?", async function(req) {
	return import("./flat/index.js").then(e => e.default(req));
});

routes.register("saing/:task?", async function(req) {
	return import("./saing/index.js").then(e => e.default(req));
});

routes.register("sea/:task?/:name?", async function(req) {
	return import("./sea/index.js").then(e => e.default(req));
});
