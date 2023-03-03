import { command, seek } from "lethil";
import { thuddar } from "./anchor/index.js";
import * as dictionary from "./admin/dictionary.js";
import * as gist from "./admin/gist.js";
import * as working from "./admin/working.js";
import * as sqlite from "./admin/sqlite.js";
import * as csv from "./admin/csv.js";

const app = command();
const routes = app.routes();

// routes.register;
routes.register("/", () => "?");
routes.register("/apple", () => "Did you know apple is fruit?");
routes.register("orange", () => "Orange is good for health");
routes.register("test", function() {
	var file = "./cache/delete/abs/abc.txt";
	return seek.write(file, "abc");
});

routes.register("ecosystem", async function(req) {
	return import("./admin/deployment.js").then(e => e.createOrUpdate(req));
});

routes.register("environment", async function(req) {
	return import("./admin/deployment.js").then(e => e.transferEnvironment(req));
});

routes.register("export-grammar", thuddar.update);

routes.register("export-definition", dictionary.definition);
routes.register("export-translation", dictionary.translation);
routes.register("export-synset", dictionary.wordSynset);
routes.register("export-synmap", dictionary.wordSynmap);

routes.register("export-sqlite-test", sqlite.main);
routes.register("export-csv-test", csv.main);

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
	return import("./wordbreak/test.js").then(async e => e.default(req));
});

routes.register("upgrade/:id?", req =>
	import("./admin/upgrade.js").then(e => e.default(req))
);
