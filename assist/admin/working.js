import { db, load, seek } from "lethil";
import { config, json } from "../anchor/index.js";

const { table } = config;

/**
 * JSON
 */
export async function words() {
	await db.mysql
		.query("SELECT * FROM ??;", ["listword"])
		.then(async raw => {
			await json.write("/tmp/myordbok/just-words.json", raw, 2);
			console.info("words->list", raw.length);
		})
		.catch(e => console.error(e));
	return "Done";
}

/**
 * ss
 * @param {String} str
 * @resturns String
 */
function formatText(str) {
	return str
		.replace(/\\/g, "")
		.replace(/  +/g, " ")
		.trim();
}

/**
 * export thesaurus
 */
export async function thesaurus() {
	// var raw = [
	//   [33,555],
	//   [343,5545]
	// ];
	// var src = await load.json('/tmp/myordbok/just-words.json');
	// var data = await load.json('./assets/data','thesaurus.json');

	// for (const a in data) {
	//   var word = src.find(item => a.toLowerCase() === item.word.toLowerCase());
	//   for (const b of data[a]) {
	//     var thesaurus= src.find(item => b.toLowerCase() === item.word.toLowerCase());
	//     raw.push([word.id,thesaurus.id]);
	//   }
	//   console.log(word.id);
	// }
	// await json.write('/tmp/myordbok/just-thesaurus-map.json',raw,2);

	var raw = await load.json("/tmp/myordbok/just-thesaurus-map.json");
	var src = raw.map(e => e.join(", ")).join("\r\n");
	await seek.write("/tmp/myordbok/just-thesaurus-map.csv", src);
	return `done ${raw.length}`;
}

/**
 * check the different and merge
 */
export async function checkDifferentAndMerge() {
	var raw = await load.json("/tmp/myordbok/just-words-with-thesaurus.json");
	var src = await load.json("/tmp/myordbok/just-derives.json");

	// {
	//   "id": 13,
	//   "word": "1000000000000s",
	//   "is_derived": 2
	// },

	var different = [];
	for (let index = 0; index < src.length; index++) {
		const word = src[index].word;
		var indexSrc = raw.findIndex(
			item => item.word.toLowerCase() === word.toLowerCase()
		);
		if (indexSrc < 0) {
			var row = { id: "", word: word, is_derived: 0, derf: 1 };
			different.push(row);
			raw.push(row);
			console.log(index, word);
		}
	}
	await json.write(
		"/tmp/myordbok/just-words-with-thesaurus-derives.json",
		raw,
		2
	);
	await json.write("/tmp/myordbok/just-derives-different.json", different, 2);
	return "done";
}

/**
 * insert the different
 */
export async function insertDifferent() {
	var src = await load.json(
		"/tmp/myordbok/just-words-with-thesaurus-derives.json"
	);
	var raw = src
		.filter(e => e.id == "")
		.map(e => {
			return [e.word, e.is_derived];
		});
	// console.log(raw);
	await db.mysql
		.query("INSERT INTO ?? (word, is_derived) VALUES ?", ["listword", raw])
		.then(row => {
			console.log(
				"affectedRows",
				row.affectedRows,
				"changedRows",
				row.changedRows
			);
		})
		.catch(e => console.error(e));
	return "done";
}

/**
 * @param {any} req
 */
export async function main(req) {
	// await db.mysql.query('UPDATE ?? AS o INNER JOIN (select id, word from ??) AS i ON o.word = i.word SET o.wrid = i.id;',
	//   [table.senses,table.synset]
	// ).then(
	//   ()=>{
	//     console.log('...','reset wrid')
	//   }
	// ).catch(
	//   e=>console.error(e)
	// );
	await db.mysql
		.query(
			"SELECT o.id AS id, o.word AS word, o.wrte AS wrte, o.sense AS sense, o.exam AS exam, o.wseq AS wseq FROM ?? AS o WHERE DATE(o.dated) > '2021-05-01';",
			[table.senses]
		)
		.then(async raw => {
			// await json.write('/tmp/myordbok/list-sense-all.json',raw);
			await json.write(
				"/tmp/myordbok/list-sense-update.json",
				raw.map(e => Object.values(e))
			);
			console.info("sense->list", raw.length);
		})
		.catch(e => console.error(e));
	return "Done";
}
