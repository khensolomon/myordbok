import { server } from "lethil";
// import { thuddar } from "../assist/index.js";
import { snap, partOfSpeech } from "../assist/thuddar/index.js";

const app = server();
const routes = app.routes("/grammar", "page");

routes.register({ name: "grammar", text: "Grammar" }, async function(req, res) {
	// var grammar = await assist.grammarMain();
	var result = await snap();
	res.render("grammar", {
		title: result.context.name,
		description: result.context.desc,
		keywords: result.pos.map(e => e.root.name).join(","),
		grammar: result
	});
});

routes.register("/:id", function(req, res) {
	partOfSpeech(req.params.id)
		.then(function(result) {
			if (Object.keys(result).length) {
				var keywords = result.kind.map(e => e.root.name);
				keywords.unshift(result.root.name, result.info.name);

				res.render("grammar-pos", {
					title: result.root.name,
					keywords: keywords.join(","),
					description: result.root.desc.replace(/'/g, ""),
					grammar: result
				});
			} else {
				res.status(404).end();
			}
		})
		.catch(function() {
			res.status(404).end();
		});
});
