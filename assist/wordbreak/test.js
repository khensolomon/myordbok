const app = require("../..");
const wordbreak = require(".");

const fs = require("fs");
// const util = require('util');
const path = require("path");

const { fileName } = app.Config;
// const {utility} = app.Common;

// const mediaTest = path.join(app.Config.media,'test');

const readJSON = async file =>
	await fs.promises
		.readFile(file)
		.then(e => JSON.parse(e))
		.catch(() => []);
const writeJSON = async (file, raw) =>
	await fs.promises
		.writeFile(
			path.join(app.Config.media, "test", file),
			JSON.stringify(raw, null, 1)
		)
		.then(() => true)
		.catch(() => false);
const cliActive = name =>
	Object.keys(cliTask).find(e => e == name) || "default";

const cliTask = {
	default: () => "????",
	info: () => Object.keys(cliTask)
};
// ord

cliTask.check = async keyword => {
	// keyword = app.Param[1] ed ing tive tory tion ness less ly ;
	// var words = await readJSON(fileName.synset);
	// words = words.filter(e=>e.v.endsWith("ed"))
	// await writeJSON('_wordbreak_ed.json',words);
	// var words = await readJSON(fileName.synset);
	// words = words.filter(e=>e.v.endsWith("ed")).map(w => wordbreak(w))
	// await writeJSON('_wordbreak_ed.json',words);
	// return 'done';
	// return keyword
	if (keyword) {
		var file = "_wordbreak_0.json".replace(0, keyword);
		var words = await readJSON(fileName.synset);
		words = words.filter(e => e.v.endsWith(keyword)).map(w => wordbreak(w.v));
		await writeJSON(file, words);
		return file;
	} else {
		return "endsWith?";
	}
	// return wordbreak('tested')
};

module.exports = async taskName =>
	await cliTask[cliActive(taskName)](app.Param[1]);
