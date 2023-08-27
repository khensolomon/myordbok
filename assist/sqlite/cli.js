import sqlite3 from "sqlite3";
let file = "./assets/db/tmp.v0.db";
const db = new sqlite3.Database(file);
/**
 * Test SQLite
 * @param {import("lethil/types/framework/api").CommandRequest} req
 */

export default async function testing(req) {
	// let db = new sqlite3.Database(file, sqlite3.OPEN_READWRITE, function(err) {
	// 	console.log("error", err);
	// 	// db.get("SELECT * FROM list limit 1", (error, row) => {
	// 	// 	console.log(row);
	// 	// });
	// 	// db.all("SELECT id, word FROM list limit 1", (error, rows) => {
	// 	// 	rows.forEach(row => {
	// 	// 		console.log(row.id + " " + row.word);
	// 	// 	});
	// 	// });
	// });
	// return db.each("SELECT id, word FROM `list` limit 10", (error, row) => {
	// 	console.log(row.id + " " + row.word);
	// });

	// let abc = await queries("SELECT * FROM `unique_words` WHERE word_id=$id", {
	// 	$id: 1
	// });
	// console.log(abc);
	await definition();

	// return sqlite.all(
	// 	"SELECT * FROM definitions where id = $id",
	// 	{
	// 		$id: 0
	// 	},
	// 	(error, rows) => {
	// 		rows.forEach(row => {
	// 			console.log(row.id + " " + row.definition);
	// 		});
	// 		return rows;
	// 	}
	// );
	// return db.get("SELECT * FROM list", (error, row) => {
	// 	console.log(row);
	// });
	// return "working";
}

/**
 * @param {string} sql - SELECT * FROM `any` WHERE column=$id
 * @param {any} params - {$id: 1}
 * @example await queries("SELECT * FROM `any` WHERE column=$id", {$id: 1})
 */
function queries(sql, params = {}) {
	return new Promise(function(resolve, reject) {
		db.all(sql, params, function(error, row) {
			if (error) {
				reject({ error: error });
			} else {
				resolve({ row: row });
			}
			db.close();
		});
	});
}

async function definition() {
	let raw = await queries("SELECT * FROM `definitions` WHERE id=0");
	if (raw.row) {
		for (let index = 0; index < raw.row.length; index++) {
			const row = raw.row[index];
			let def = Buffer.from(row.definition, "utf8");

			console.log(row.id, def.toString("hex"));
		}
	}
}
/*
-- 155921 (word_sense1) 51371 (word_sense2)
-- claves
--- select * from derived where root_id = 51371;

-- natural object, artifact
-- select * from word_senses where word_sense = 155921;

-- select * from unique_words where word_id = 155921;

SELECT hex(definition) FROM definitions where id = 1;
*/
