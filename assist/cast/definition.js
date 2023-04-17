import * as base from "./base.js";

export async function doExport() {
	const infoFile = base.glossary.info();

	const infoRaw = await base.info_read(infoFile);

	// infoRaw.dated = new Date()
	// 	.toISOString()
	// 	.replace(/T/, " ")
	// 	.replace(/\..+/, "");
	infoRaw.dated = Date.now();
	/**
	 * @param {string} identity
	 * @param {any} digit
	 */
	function _record_info(identity, digit) {
		infoRaw.info.progress.map(e => {
			if (e.name && e.name.toLowerCase() == identity.toLowerCase()) {
				e.status = digit;
			}
		});
	}

	// NOTE: reset wrid
	// o = list_sense, i = list_word
	// UPDATE ?? AS o INNER JOIN (select id,word from ?? GROUP BY word ) AS i ON o.word = i.word SET o.wrid = i.id;
	// UPDATE ?? AS o INNER JOIN (select id,word from ?? GROUP BY word ) AS i ON o.word = i.word SET o.wrid = i.id;'
	// UPDATE ?? AS o INNER JOIN (select id, word from ?? GROUP BY word COLLATE UTF8_BIN) AS i ON o.word COLLATE UTF8_BIN = i.word SET o.wrid = i.id;
	await base.mysql.query(
		"UPDATE ?? AS o INNER JOIN (select id, word from ?? GROUP BY word) AS i ON o.word = i.word SET o.wrid = i.id;",
		[base.table.senses, base.table.senses]
	);
	console.log(" >", "reset wrid");

	// Change wrid AS w to wrid AS k
	const word = await base.mysql.query(
		"SELECT wrid AS w, word AS v FROM ?? WHERE word IS NOT NULL GROUP BY wrid ORDER BY word ASC;",
		[base.table.senses]
	);

	var _wi = base.glossary.word();
	await base.json.write(_wi, word);
	const totalSense = word.length;
	_record_info("word", base.number_format(totalSense));
	const percentage = await base.percentageDefinition(totalSense);

	_record_info("completion", percentage);
	console.log(" >", "en(word):", word.length, _wi);

	/*
	word:{w:wrid, v:word}
	sense:{i:id,w:wrid,t:wrte,v:sense}
	usage:{i:id,v:exam}
	*/
	const sense = await base.mysql.query(
		"SELECT id AS i, wrid AS w, wrte AS t, sense AS v FROM ?? WHERE word IS NOT NULL AND sense IS NOT NULL ORDER BY wrte, wseq;",
		[base.table.senses]
	);
	var _wi = base.glossary.sense();
	await base.json.write(_wi, sense);
	_record_info("definition", base.number_format(sense.length));
	console.log(" >", "Sense:", sense.length, _wi);

	const example = await base.mysql.query(
		"SELECT id AS i, exam AS v FROM ?? WHERE exam IS NOT NULL AND exam <> '' ORDER BY wrte, wseq;",
		[base.table.senses]
	);

	var _wi = base.glossary.usage();
	await base.json.write(_wi, example);
	_record_info("example", base.number_format(example.length));
	console.log(" >", "Usage:", example.length, _wi);

	await base.json.write(infoFile, infoRaw, 2);
	console.log("  +", infoFile);
}
