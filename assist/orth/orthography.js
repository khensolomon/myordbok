const app = require("..");
const path = require("path");
const fs = require("fs");
// const {media,orthography} = app.Config;
const { orthography } = app.Config;

/*
orthography
orthSyllable
orthBreak
orthWork
*/

orthography.root = path.join(app.Config.media, "orthography");

const unicodeRange = [
	// ["\u101E\u103C\u1031\u102C\u103A","\u102A"] //ဪ
	["\u101E\u103C", "\u1029"], //ဩ
	["\u1029\u1031\u102C\u103A", "\u102A"], //ဪ
	["\u1037\u103A", "\u103A\u1037"],
	["\u1037\u1032", "\u1032\u1037"],
	["\u1026", "\u1025\u102E"],
	["\u1000\u100C", "\u1000\u100B\u1039\u100C"],
	["\u1000\u1039\u1001\u102B", "\u1000\u1039\u1001\u102C"],
	["\u1037\u1036", "\u1036\u1037"],
	["\u1014\u103E\u102C\u1000\u103C", "\u1014\u103E\u102C\u1000\u103B"],
	["\u1010\u1006", "\u1010\u1005\u103A\u1006", true], // တဆ တစ်ဆ
	["\u1040", "\u101D", true]
];

const readJSON = async file =>
	await fs.promises
		.readFile(path.join(orthography.root, file))
		.then(JSON.parse)
		.catch(() => []);
exports.unicodeRange = unicodeRange;
// const unicodeFormat = (str) => str.replace(/\u1037\u103A/g,'\u103A\u1037').replace(/\u1026/g,'\u1025\u102E');
exports.unicodeCorrection = function(str, all = true) {
	var o = unicodeRange;
	for (var i = 0, len = o.length; i < len; i++) {
		if (all == true) {
			str = str.replace(new RegExp(o[i][0], "g"), o[i][1]);
		} else if (o[i].length == 2) {
			str = str.replace(new RegExp(o[i][0], "g"), o[i][1]);
		}
	}
	return str;
};
// exports.unicodeCorrection = function(str) {
//   var o = unicodeRange;
//   for (var i = 0, len = o.length; i < len; i++) str = str.replace(new RegExp(o[i][0],"g"),o[i][1]);
//   return str;
// }

// character ideograph ideogram
exports.character = async (name = "none") =>
	await readJSON(orthography.character)
		.then(e => e.filter(o => o.name == name.toLowerCase()))
		.catch(() => []);

// exports.word_ = async (word) => await readJSON(orthography.word).then(
//   e => e.filter(
//     o => o.ord.startsWith(word)
//   ).map(
//     o => o.ord
//   ).slice(0,40)
// ).catch(
//   () => []
// );

exports.word = async word =>
	await readJSON(orthography.sense)
		.then(e =>
			e
				.filter(o => o.ord.startsWith(exports.unicodeCorrection(word, false)))
				.map(o => o.ord)
				.slice(0, 10)
		)
		.catch(() => []);
exports.sense = async word =>
	await readJSON(orthography.sense)
		.then(e =>
			e.filter(o => o.ord == exports.unicodeCorrection(word, false)).slice(0, 3)
		)
		.catch(() => []);
exports.senseCount = async () =>
	await readJSON(orthography.sense)
		.then(e => e.length)
		.catch(() => 0);

exports.syllable = require("./orthSyllable");
exports.break = require("./orthBreak");
