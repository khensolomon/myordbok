import { seek } from "lethil";
import * as base from "./base.js";

/**
 * Testing
 * @param {any} req
 */
export async function doTestDefault(req) {
	// return base.settings;
	// console.log(req);
	// return JSON.stringify(base.settings);
	return JSON.stringify(base.data.words);
}

/**
 * Testing new word, then write result
 * @param {any} req
 */
export async function doTestRequests(req) {
	const word = "1000000000000s";

	let doc = await base.requestfromURL(word);
	const wowContext = doc.getElementsByTagName("body")[0];

	let file = base.requestFileName(word);

	await seek.write(file, wowContext.outerHTML);
	return file;
}

/**
 * Testing examine
 * @param {any} req
 */
export async function doTestExamine(req) {
	const word = "love";
	let file = base.requestFileName(word);
	let doc = await base.requestfromFile(file);
	let res = base.examine(doc);

	await seek.WriteJSON(file.replace(".html", ".json"), res, 2);
	return file;
}

/**
 * Testing direct
 * @param {any} req
 */
export async function doTestDirect(req) {
	const word = "tree";

	let doc = await base.requestfromURL(word);
	let res = base.examine(doc);

	let file = base.requestFileName(word);

	await seek.WriteJSON(file.replace(".html", ".json"), res, 2);
	return file;
}

/**
 * Scan all from words.json
 * block-in-progress [non, un, dis, re, go]
 * non-alphanumeric-in-progress ['*, -*]
 * numeric-in-progress [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]
 * alphabet-in-progress [a, b?, c?; x, y, z]
 * @param {any} req
 */
export async function doScanAll(req) {
	const defList = base.data.defs;
	const wordList = base.data.words;
	let totalWord = wordList.length;
	let beginWith = base.settings.progress.current;
	// const taskList = wordList.filter(e => !e.s || e.s == 0).filter(e => e.derived == 0);
	// const taskList = wordList.filter(e => !e.s && e.word.startsWith(beginWith));
	// const taskList = wordList.filter(e => !e.s && e.derived == 0 && e.word.startsWith(beginWith));
	// const taskList = wordList
	// 	.filter(e => !e.s && e.word.startsWith(beginWith))
	// 	.filter((val, i) => i < 10002);
	// NOTE: expected in the next check: 115662 110000
	const taskList = wordList.filter(e => !e.s && e.word.startsWith(beginWith));
	let totalTask = taskList.length;

	if (totalTask == 0) {
		return "already ? words was scanned".replace("?", totalWord.toString());
	}

	let wordInterval = 0;
	let defInterval = 0;

	for (let index = 0; index < taskList.length; index++) {
		const task = taskList[index];
		const taskWord = task.word;
		let checkIfDone = defList.find(e => e.w == taskWord);

		if (!checkIfDone) {
			defInterval++;
			const defIntervalLimit = 50;
			let defIntervalTest = defInterval == defIntervalLimit;

			await definitions(taskWord, defIntervalTest);
			if (defIntervalTest) {
				defInterval = 0;
				console.log(" >> write defs", defIntervalLimit);
			}
			totalTask--;
			console.log(" >", defInterval, totalTask, taskWord);
		}

		wordInterval++;
		const wordIndex = wordList.findIndex(e => e.word == taskWord);
		wordList[wordIndex].s = 1;
		const wordIntervalLimit = 100;
		let wordIntervalTest = wordInterval == wordIntervalLimit;
		if (wordIntervalTest) {
			wordInterval = 0;
			await base.writeWord();
			console.log(" >> write words", wordIntervalLimit);
		}
	}

	if (defInterval > 0) {
		await base.writeDef();
		console.log(" >> write defs as final");
	}
	if (wordInterval > 0) {
		await base.writeWord();
		console.log(" >> write words as final");
	}

	return "scanned ? out of * words"
		.replace("?", taskList.length.toString())
		.replace("*", totalWord.toString());
}

/**
 * Scan provided word
 * @param {any} req
 */
export async function doScanWord(req) {
	const defList = base.data.defs;
	const wordList = base.data.words;

	const taskWord = "orange";
	let checkIfDone = defList.find(e => e.w == taskWord);

	if (!checkIfDone) {
		let res = await definitions(taskWord);
		let file = base.requestFileName(taskWord);
		await seek.WriteJSON(file.replace(".html", ".json"), res, 2);
		console.log(" > pushed definition");
	}
	const wordIndex = wordList.findIndex(e => e.word == taskWord);
	wordList[wordIndex].s = 1;
	// await seek.WriteJSON(base.settings.file.word, wordList, 2);
	await base.writeWord();
	return "scanned ?".replace("?", taskWord);
}

/**
 * Definition pusher
 * @param {string} taskWord
 * @param {boolean} write
 */
async function definitions(taskWord, write = true) {
	const defList = base.data.defs;
	let doc = await base.requestfromURL(taskWord);
	let res = base.examine(doc);

	for (let index = 0; index < res.def.length; index++) {
		const src = res.def[index];
		const word = src.w || res.w;

		let defIndex = defList.findIndex(e => e.w == word);

		const pos = src.k;

		const def = {
			k: pos,
			v: src.v
		};
		if (defIndex >= 0) {
			// NOTE: has definition, but might be partly eg. [loved, love]
			const posIndex = defList[defIndex].def.findIndex(e => e.k == pos);

			if (posIndex < 0) {
				defList[defIndex].def.push(def);
				defList[defIndex].p = res.p;
				defList[defIndex].usage = res.usage;
				defList[defIndex].derived = res.derived;
				defList[defIndex].antonym = res.antonym;
				defList[defIndex].type = res.type;
				defList[defIndex].part = res.part;
				defList[defIndex].see = res.see;
			}
		} else {
			// NOTE: not definition yet
			if (src.w) {
				// NOTE: word may differ from current result
				defList.push({
					w: word,
					p: res.p,
					usage: res.usage,
					def: [def],
					derived: [],
					antonym: [],
					type: [],
					part: [],
					see: []
				});
			} else {
				defList.push({
					w: word,
					p: res.p,
					usage: res.usage,
					def: [def],
					derived: res.derived,
					antonym: res.antonym,
					type: res.type,
					part: res.part,
					see: res.see
				});
			}
		}
	}
	if (write) {
		// await seek.WriteJSON(base.settings.file.def, defList, 2);
		await base.writeDef();
	}

	return res;
}

// /**
//  * working ?
//  * .replace(/Ã¨/g,"é").replace(/Ã©/g,"é")
//  */
// export function doTestDefinition() {
// 	const defList = base.data.defs;
// 	for (let index = 0; index < defList.length; index++) {
// 		const res = defList[index];

// 		let abc = res.w;
// 	}
// }
