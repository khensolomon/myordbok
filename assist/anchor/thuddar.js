import path from "path";
import { setting } from "./config.js";

import { write, read } from "./json.js";
import { replaceSpaceWithDot } from "./chat.js";

/**
 * @param {string} file
 */
function root(file) {
	return path.join(setting.media, "grammar", file);
}

/**
 * @param {string} file
 */
async function readJSON(file) {
	return await read(root(file), {});
}

/**
 * read live thuddar
 * @returns {Promise<{chapter:[],note:any,context:any,pos:[{info:any,root:any}],other:[]}>}
 */
export async function main() {
	return await readJSON(setting.grammar.live);
}

/**
 * @param {string} id
 */
export async function pos(id) {
	return await readJSON(
		setting.grammar.pos.replace("*", replaceSpaceWithDot(id))
	);
}

/**
 * orginal name: exportGrammar
 * @param {any} req
 */
export async function update(req) {
	var raw = await readJSON(setting.grammar.structure);
	var structure = raw.structure;
	for (const abc of structure.file) {
		if (abc.hasOwnProperty("child")) {
			for (const name of abc.child) {
				var row = await pos(name);
				var rowId = row.info.status > 0 ? abc.id : "other";
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
			raw.chapter.push(abc.id);
			raw[abc.id] = await readJSON(
				setting.grammar.structure.replace("structure", abc.id)
			);
		}
	}
	delete raw.structure;
	// await writeSON(raw);
	await write(root(setting.grammar.live), raw);
	return "done grammar update";
}
