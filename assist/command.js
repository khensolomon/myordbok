import { command } from "lethil";
import { thuddar } from "./anchor/index.js";
import * as dictionary from "./admin/dictionary.js";
import * as gist from "./admin/gist.js";
import * as working from "./admin/working.js";
import * as sqlite from "./admin/sqlite.js";

const app = command();
const routes = app.routes();

// routes.register;
routes.register("/", () => "?");
routes.register("/apple", () => "Did you know apple is fruit?");
routes.register("orange", () => "Orange is good for health");
routes.register("req", req => req);

routes.register("ecosystem", async function(req) {
	return import("./admin/deployment.js").then(e => e.createOrUpdate(req));
});

routes.register("environment", async function(req) {
	return import("./admin/deployment.js").then(e => e.transferEnvironment(req));
});

routes.register("export-grammar", thuddar.update);

// routes.register("testing", dictionary.testing);
routes.register("/testings", async function(req) {
	return await dictionary.testing(req);
});
// routes.register("/testings", req => "this is testing");
routes.register("testing/:word?", dictionary.testing);
routes.register("export-definition", dictionary.exportDefinition);
routes.register("export-translation", dictionary.exportTranslation);
routes.register("export-synset", dictionary.exportWordSynset);
routes.register("export-synmap", dictionary.exportWordSynmap);

routes.register("export-sqlite-test", sqlite.main);

routes.register("gist-get", gist.get);
routes.register("gist-list", gist.list);
routes.register("gist-patch", gist.patch);
routes.register("gist-remove", gist.remove);

routes.register("works", working.main);

// routes.register("wordbreak", working.main);
// routes.register("wordbreak", function(req) {
// 	console.log(req);
// 	return req.route.searchParams.get("info");
// });

routes.register("wordbreak", async function(req) {
	return import("./wordbreak/test.js").then(e => e.default(req));
});

routes.register("flat/:task?", async function(req) {
	return import("./admin/flat.js").then(async e => await e.default(req));
});

routes.register("saing/:task?", async function(req) {
	return import("./saing/index.js").then(e => e.default(req));
});
routes.register("sea/:task-:name?", async function(req) {
	return import("./sea/index.js").then(e => e.default(req).catch(console.log));
});

// routes.register("upgrade/:id?", req =>
// 	import("./admin/upgrade.md").then(e => e.default(req))
// );
