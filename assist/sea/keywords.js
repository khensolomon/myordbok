import { JSDOM } from "jsdom";
import { alphabets, keywords } from "./base.js";

/**
 * Get all keywords
 * 'Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8'
 * Manually Trigger
 * @param {any} req
 */
export async function doRequest(req) {
	await keywords.read();
	const totalKeywordsBefore = keywords.raw.length;
	var task = await alphabets.read();
	for (let index = 0; index < task.letter.length; index++) {
		let row = task.letter[index];
		await scanner(row.char, 0);
	}
	for (let index = 0; index < task.symbol.length; index++) {
		let row = task.symbol[index];
		await scanner(row.char, 0);
	}

	await keywords.write();

	const totalKeywordsAfter = keywords.raw.length;

	console.log("before", totalKeywordsBefore, "after", totalKeywordsAfter);
	return "done";
}

/**
 * Scan keywords
 * @param {string} word
 * @param {number} level
 */
async function scanner(word, level) {
	const url = new URL(keywords.url);
	url.searchParams.append("query", word);
	console.log("word", word, "level", level);

	const dom = await JSDOM.fromURL(url.href);

	var spans = dom.window.document.querySelectorAll("span");
	var raw = [];
	for (const span of spans) {
		const row = {
			word: span.innerHTML,
			block: 0,
			status: 0
		};

		var small = span.querySelector("small");
		if (small) {
			row.block = parseInt(small.innerHTML.replace(/\D/g, ""));
			span.removeChild(small);
			if (span.textContent) {
				row.word = span.textContent.replace("...", "").trim();
			}
		}

		let index = keywords.raw.findIndex(e => e.word == row.word);

		if (index < 0) {
			// If not contains
			keywords.raw.push(row);
		} else {
			// keywords.raw[index] = row;
			// Object.assign(keywords.raw[index], row);
		}
		raw.push(row);
	}

	// const deepDrive = raw.filter(e => e.block > 0 && e.word != word);
	// level++;
	// for (const drive of deepDrive) {
	// 	await scanner(drive.word, level);
	// }
	const deepDrive = raw.filter(e => e.block > 0);
	level++;
	var deepWord = word.replace("...", "").trim();
	for (const drive of deepDrive) {
		if (drive.word == deepWord) {
			if (level > 1) {
				await scanner(drive.word + "...", level);
			}
		} else {
			await scanner(drive.word, level);
		}
	}

	// return raw.filter(e => e.block > 0);
}
