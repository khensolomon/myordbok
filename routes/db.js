import { route, db } from "lethil";
import { config } from "../assist/index.js";

const routes = route("none", "/test");

routes.get(
	"/",
	/**
	 * @param {*} req
	 * @param {*} res
	 */
	function(req, res) {
		// res.setHeader('Content-Type', 'application/event-stream')
		res.setHeader("Content-Type", "text/event-stream");
		// res.setHeader('Cache-Control', 'no-cache')

		// send a ping approx every 2 seconds
		var timer = setInterval(function() {
			res.write(JSON.stringify({ count: 1 }));

			// !!! this is the important part
			res.flush();
		}, 2000);

		res.on("close", function() {
			console.log("close");
			clearInterval(timer);
		});
	}
);

routes.get(
	"/mysql",
	/**
	 * @param {*} req
	 * @param {*} res
	 */
	function(req, res) {
		db.mysql
			.query("SELECT * FROM ?? WHERE LOWER(word) LIKE LOWER(?);", [
				config.table.senses,
				"love"
			])
			.then(raw => res.json(raw));
	}
);

routes.get(
	"/mongo",
	/**
	 * @param {*} req
	 * @param {*} res
	 */
	function(req, res) {
		// db.mysql.query
		// db.mongo.query().collection('documents').find({}).toArray(function(err,doc) {
		//   console.log(doc)
		// });
		// console.log(app)
		// db.mongo.query().collection('documents').find({}).toArray(function(err,doc) {
		//   res.send(doc)
		// });
		db.mongo.query().then(e => {
			e.collection("documents")
				.find({})
				.toArray(function(err, doc) {
					res.json(doc);
				});
		});
	}
);
