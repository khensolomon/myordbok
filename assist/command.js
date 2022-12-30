import { route } from "lethil";
import { thuddar } from "./anchor/index.js";
import * as dictionary from "./admin/dictionary.js";
import * as gist from "./admin/gist.js";
import * as working from "./admin/working.js";
import * as sqlite from "./admin/sqlite.js";
import * as csv from "./admin/csv.js";

const routes = route();

routes.get("", async () => "?");

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

routes.get("apple", async () => "Did you know apple is fruit?");
routes.get("orange", async () => "Orange is good for health");

routes.get("works", working.main);

routes.get(
	"upgrade/:id?",
	/**
	 * @param {*} req
	 */
	async req => await import("./admin/upgrade.js").then(e => e.default(req))
);
