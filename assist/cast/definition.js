// import * as base from "./base.js";
import { mysql, seed, table, number_format, percentage } from "./base.js";

export async function doExport() {
	let ifd = new seed.infoDict();
	await ifd.read();

	let infoRaw = ifd.raw;

	// infoRaw.dated = new Date()
	// 	.toISOString()
	// 	.replace(/T/, " ")
	// 	.replace(/\..+/, "");
	infoRaw.dated = Date.now();
	/**
	 * @param {string} identity but its string, just to avoid typescript
	 * @param {any} digit
	 */
	function _record_info(identity, digit) {
		var checkIdExist = infoRaw.info.progress.find(e => e.id == identity);
		if (checkIdExist) {
			// console.log("yes", identity);
			// infoRaw.info.progress[identity].status = digit;
			checkIdExist.status = digit;
		} else {
			console.log(identity, "not found, it's happen when syntax modified");
		}
		// infoRaw.info.progress.map(e => {
		// 	if (e.id && e.id == identity) {
		// 		e.status = digit;
		// 		// console.log(identity, "yes", digit);
		// 	} else {
		// 		console.log(identity, "not", digit);
		// 	}
		// 	// if (e.name && e.name.toLowerCase() == identity.toLowerCase()) {
		// 	// 	e.status = digit;
		// 	// } else {
		// 	// 	console.log(identity, "not found for", digit);
		// 	// }
		// });
	}

	// NOTE: reset wrid
	// o = list_sense, i = list_word
	// UPDATE ?? AS o INNER JOIN (select id,word from ?? GROUP BY word ) AS i ON o.word = i.word SET o.wrid = i.id;
	// UPDATE ?? AS o INNER JOIN (select id,word from ?? GROUP BY word ) AS i ON o.word = i.word SET o.wrid = i.id;'
	// UPDATE ?? AS o INNER JOIN (select id, word from ?? GROUP BY word COLLATE UTF8_BIN) AS i ON o.word COLLATE UTF8_BIN = i.word SET o.wrid = i.id;
	await mysql.query(
		"UPDATE ?? AS o INNER JOIN (select id, word from ?? GROUP BY word) AS i ON o.word = i.word SET o.wrid = i.id;",
		[table.senses, table.senses]
	);
	console.info(" >", "reset wrid");

	// const word = await base.mysql.query(
	// 	"SELECT wrid AS w, word AS v FROM ?? WHERE word IS NOT NULL GROUP BY wrid ORDER BY word ASC;",
	// 	[base.table.senses]
	// 	);

	// var _wi = base.glossary.word();
	// await base.json.write(_wi, word);

	// wot wos des deu de
	// wta wse dse dua dsm dst

	let wordTarget = new seed.wordTarget();
	// Change wrid AS w to wrid AS k
	wordTarget.raw = await mysql.query(
		"SELECT wrid AS w, word AS v FROM ?? WHERE word IS NOT NULL GROUP BY wrid ORDER BY word ASC;",
		[table.senses]
	);
	await wordTarget.write();

	const _wtt = wordTarget.raw.length;
	_record_info("word", number_format(_wtt));
	const completion = await percentage(_wtt);

	_record_info("progress", completion);
	console.info(" >", "Word (en):", _wtt, wordTarget.file, completion);

	// /*
	// word:{w:wrid, v:word}
	// sense:{i:id,w:wrid,t:wrte,v:sense}
	// usage:{i:id,v:exam}
	// */
	let defSense = new seed.defSense();
	defSense.raw = await mysql.query(
		"SELECT id AS i, wrid AS w, wrte AS t, sense AS v FROM ?? WHERE word IS NOT NULL AND sense IS NOT NULL ORDER BY wrte, wseq;",
		[table.senses]
	);
	await defSense.write();
	let _dst = defSense.raw.length;

	_record_info("sense", number_format(_dst));
	console.info(" >", "Sense:", _dst, defSense.file);

	// const example = await base.mysql.query(
	// 	"SELECT id AS i, exam AS v FROM ?? WHERE exam IS NOT NULL AND exam <> '' ORDER BY wrte, wseq;",
	// 	[base.table.senses]
	// );

	let defUsage = new seed.defUsage();

	defUsage.raw = await mysql.query(
		"SELECT id AS i, exam AS v FROM ?? WHERE exam IS NOT NULL AND exam <> '' ORDER BY wrte, wseq;",
		[table.senses]
	);
	await defUsage.write();
	let _dut = defUsage.raw.length;

	_record_info("exam", number_format(_dut));
	console.info(" >", "Exam:", _dut, defUsage.file);

	await ifd.write({
		space: 2
	});

	console.info(" >", "Info (updated):", ifd.file);
}
