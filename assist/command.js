import { command } from "lethil";

const app = command();
const routes = app.routes();

routes.register("", () => "?");
routes.register("apple", () => "Did you know apple is fruit?");
routes.register("orange", () => "Orange is good for health");
routes.register("req", req => req);

routes.register("setup/:task?", async function(req) {
	return import("./setup/cli.js").then(e => e.default(req));
});

routes.register("ome/:task?/:name?", async function(req) {
	return import("./ome/index.js").then(e => e.default(req));
});

routes.register("oem/:task?/:name?", async function(req) {
	return import("./oem/index.js").then(e => e.default(req));
});

routes.register("search/:task?", async function(req) {
	return import("./search/index.js").then(async e => await e.default(req));
});

routes.register("sqlite", async function(req) {
	return import("./sqlite/cli.js").then(e => e.default(req));
});

routes.register("test", async function(req) {
	return import("./test/cli.js").then(e => e.default(req));
});

routes.register("saing/:task?", async function(req) {
	return import("./saing/cli.js").then(e => e.default(req));
});

routes.register("sea/:task?/:name?", async function(req) {
	return import("./sea/cli.js").then(e => e.default(req));
});

routes.register("thuddar", async function(req) {
	return import("./thuddar/cli.js").then(e => e.update());
});

routes.register("wordbreak/:word?", async function(req) {
	return import("./wordbreak/cli.js").then(e => e.default(req));
});

routes.register("orth/:task?/:name?", async function(req) {
	return import("./orth/cli.js").then(e => e.default(req));
});

routes.register("cast/:task?/:name?", async function(req) {
	return import("./cast/cli.js").then(e => e.default(req));
});

routes.register("gist/:task?/:name?", async function(req) {
	return import("./gist/cli.js").then(e => e.default(req));
});

routes.register("flat/:task?/:name?", async function(req) {
	return import("./flat/cli.js").then(e => e.default(req));
});

routes.register("font-update", async function(req) {
	return import("./fonts/index.js").then(e => new e.default("tmp").scan());
});
