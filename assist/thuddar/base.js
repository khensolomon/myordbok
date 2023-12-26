import { seek } from "lethil";

/**
 * @typedef {object} TypeOfInfo - object
 * @property {string} name
 * @property {string} desc
 * @property {number} [status]
 * @property {any} [uniqueId]
 *
 * @typedef {object} TypeOfRoot - object
 * @property {string} name
 * @property {string} desc
 * @property {string|null} [note]
 *
 * @typedef {object} TypeOfCate - array
 * @property {string} name
 * @property {string} desc
 * @property {string[]} row
 *
 * @typedef {object} TypeOfWord - array
 * @property {string} name
 * @property {string[]} desc
 * @property {string[]} row
 *
 * @typedef {object} TypeOfExam - array
 * @property {string} name
 * @property {string[]} desc
 * @property {TypeOfForm[]} form
 *
 * @typedef {object} TypeOfForm - array
 * @property {string[]} title
 * @property {string} chain
 * @property {[string[]]} row
 *
 * @typedef {{root:TypeOfRoot, word:TypeOfWord, exam?:TypeOfExam[], kind?: TypeOfKind[]}} TypeOfKind - repeat
 *
 * @typedef {object} TypeOfPartOfSpeech
 * @property {TypeOfInfo} info
 * @property {TypeOfRoot} root
 * @property {TypeOfCate[]} [cate]
 * @property {TypeOfWord[]} word
 * @property {TypeOfExam[]} exam
 * @property {TypeOfKind[]} kind
 *
 * @typedef {object} TypeOfSnap
 * @property {String[]} chapter
 * @property {{author:string, url:string, version:string}} note
 * @property {{name:string, desc:string, kind:[{name:string, desc:string}]}} context
 * @property {[{info:TypeOfInfo, root:TypeOfRoot}]} pos
 * @property {[{info:TypeOfInfo, root:TypeOfRoot}]} other
 *
 */

/**
 * @namespace
 * @property {object} settings
 * @property {boolean} settings.test
 */
const settings = {
	snap: "./docs/thuddar/snap.json",
	pos: "./docs/thuddar/pos-*.json",
	structure: "./docs/thuddar/structure.json"
};

/**
 * @param {string} file
 */
async function read(file) {
	return seek.readJSON(file);
}

/**
 * @param {any} raw
 */
async function write(raw) {
	return seek.writeJSON(settings.snap, raw, 2);
}

/**
 * read indexed thuddar as snap
 * @returns {Promise<TypeOfSnap>}
 */
export async function snap() {
	return read(settings.snap);
}

/**
 * @param {string} id
 * @returns {Promise<TypeOfPartOfSpeech>}
 */
export async function partOfSpeech(id) {
	const posName = (id.match(/[a-zA-Z]+|[0-9]+(?:\.[0-9]+|)/g) || [])
		.join(".")
		.toLowerCase();
	return await read(settings.pos.replace("*", posName));
}

/**
 * CLI: Update indexed as snap according to structure provided in file
 */
export async function update() {
	var raw = await read(settings.structure);
	var structure = raw.structure;
	for (const e of structure.file) {
		if (e.hasOwnProperty("child")) {
			for (const name of e.child) {
				var row = await partOfSpeech(name);
				// var rowId = row.info.status > 0 ? e.id : "other";
				var rowId =
					typeof row.info.status == "number" && row.info.status > 0
						? e.id
						: "other";
				// row.info.uniqueId = row.info.name.replace(/\s/g,'.').toLowerCase();
				delete row.info.status;
				delete row.root.note;
				if (!raw.hasOwnProperty(rowId)) {
					raw[rowId] = [];
					raw.chapter.push(rowId);
				}
				// raw[rowId].push(row)
				raw[rowId].push((({ info, root }) => ({ info, root }))(row));
			}
		} else {
			raw.chapter.push(e.id);
			raw[e.id] = await read(settings.structure.replace("structure", e.id));
		}
	}
	delete raw.structure;
	await write(raw);
}
