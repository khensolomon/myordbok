import { route } from "lethil";
import { thuddar } from "./anchor/index.js";
import * as dictionary from "./admin/dictionary.js";
import * as gist from "./admin/gist.js";
import * as working from "./admin/working.js";
import * as sqlite from "./admin/sqlite.js";
import * as csv from "./admin/csv.js";

const routes = new route.cli();

routes.get("", () => "?");
routes.get("apple", () => "Did you know apple is fruit?");
routes.get("orange", () => "Orange is good for health");

routes.get("environment", async req =>
	import("./admin/deployment.js").then(e => e.transferEnvironment(req))
);

routes.get("ecosystem", async req =>
	import("./admin/deployment.js").then(e => e.createOrUpdate(req))
);

routes.get("export-grammar", thuddar.update);

routes.get("export-definition", dictionary.definition);
routes.get("export-translation", dictionary.translation);
routes.get("export-synset", dictionary.wordSynset);
routes.get("export-synmap", dictionary.wordSynmap);
routes.get("export-sqlite-test", sqlite.main);
routes.get("export-csv-test", csv.main);

routes.get("gist-get", gist.get);
routes.get("gist-list", gist.list);
routes.get("gist-patch", gist.patch);
routes.get("gist-remove", gist.remove);

routes.get("works", working.main);

routes.get("upgrade/:id?", req =>
	import("./admin/upgrade.js").then(e => e.default(req))
);
