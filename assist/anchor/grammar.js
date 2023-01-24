import { fire } from "lethil";

import { setting } from "./config.js";
import * as docket from "./json.js";
import * as chat from "./chat.js";

const { fileName, synmap, synset } = setting;

/**
 * @param {number} Id
 */
function posName(Id) {
	return synmap.find(i => i.id == Id).name;
}
// export function grammar(){
//   return synmap.map((v,index) =>(v.id=index,v));
// }

/**
 * @param {Array<any>} associate
 * @param {Array<any>} raw
 */
function partOf(associate, raw) {
	fire.array
		.category(associate, e => e.term)
		.forEach((grammar, term) =>
			fire.array
				.category(grammar, e => e.t)
				.forEach((row, gId) => {
					var dId = gId == 1 && row.length == 3 ? 3 : 0;
					var value = row
						.map(e =>
							"(-~-) {-*-} (?)"
								.replace("*", e.v)
								.replace("?", posName(dId == e.d ? 0 : e.d))
						)
						.join("; ");
					raw.push({
						term: term,
						pos: synset[gId].name,
						type: "meaning",
						kind: ["partof"],
						v: value,
						exam: []
					});
				})
		);
}

/**
 * @param {Array<any>} associate
 * @param {Array<any>} raw
 * @param {string} keyword
 */
function formOf(associate, raw, keyword) {
	fire.array
		.category(associate, e => e.term)
		.forEach((grammar, term) =>
			fire.array
				.category(grammar, e => e.t)
				.forEach((row, gId) => {
					var posOf = row.find(e => chat.compare(e.v, keyword));
					if (!posOf) return;

					var dId = gId == 1 && row.length == 3 ? 0 : posOf.d;
					var tpl = {
						main: "(-~-) $formOf; form of {-$word;-}",
						// main:'~ $keyword; is $formOf; form of {-$word;-}',
						// keyword:posOf.v,
						formOf: posName(dId),
						word: term
					};

					var value = tpl.main.replace(/\$(.+?);/g, (_, e) => tpl[e] || "-?-");
					raw.push({
						term: posOf.v,
						pos: synset[gId].name,
						type: "meaning",
						kind: ["formof"],
						v: value,
						exam: []
					});
				})
		);
}

/**
 * @param {Array<any>} row
 */
function rootOf(row) {
	return row.filter((v, i, a) => a.indexOf(v) === i);
	// result.root = form.map(
	//   e => e.v
	// ).filter(
	//   (v, i, a) => a.indexOf(v) === i
	// );
}

/**
 * org: wordPos
 * @param {string} keyword
 * @param {boolean} pluralize_attempt
 */
export async function main(keyword, pluralize_attempt = false) {
	const grammar = await docket.get(fileName.synset);
	const form = await docket.get(fileName.synmap);
	const result = { root: [], form: [], kind: [] };

	var type = form
		.filter(
			s =>
				chat.compare(s.v, keyword) &&
				s.t < 10 &&
				grammar.filter(e => e.w == s.w).length
		)
		.map(o => grammar.find(s => s.w == o.w))
		.filter((v, i, a) => a.indexOf(v) === i);
	if (type.length > 0) {
		var formAssociate = form
			.filter(m => m.d > 0 && type.filter(e => e.w == m.w).length)
			.map(o => Object.assign({}, o, { term: type.find(e => e.w == o.w).v }));
		partOf(formAssociate, result.kind);
		formOf(formAssociate, result.form, keyword);
		result.root = rootOf(type);
	}

	var pos = grammar.filter(s => chat.compare(s.v, keyword));
	if (pos.length > 0) {
		var posAssociate = form
			.filter(m => m.d > 0 && pos.filter(e => e.w == m.w).length)
			.map(o => Object.assign({}, o, { term: pos.find(e => e.w == o.w).v }));
		partOf(posAssociate, result.form);
		if (result.root.length == 0) {
			result.root = rootOf(pos);
		}
	}

	return result;
}

/**
 * org: partOfSpeech_pos
 * @param {string} keyword
 */
export async function pos(keyword) {
	const grammar = await docket.get(fileName.synset);
	/**
	 * @type {any}
	 */
	const form = await docket.get(fileName.synmap);
	var result = {
		// root, pos, form
		form: [],
		root: []
	};

	var root = grammar.filter(s => chat.compare(s.v, keyword));

	result.pos = form
		.filter(m => m.d > 0 && root.filter(e => e.w == m.w).length)
		.map(o => Object.assign({}, o, { term: root.find(s => s.w == o.w).v }));

	result.root = root.map(e => e.v).filter((v, i, a) => a.indexOf(v) === i);
	return result;
}

/**
 * org: partOfSpeech_base
 * @param {string} keyword
 */
export async function base(keyword) {
	const grammar = await docket.get(fileName.synset);
	const form = await docket.get(fileName.synmap);
	const result = {
		form: [],
		root: []
	};

	result.pos = form
		.filter(
			s =>
				chat.compare(s.v, keyword) &&
				s.t < 10 &&
				grammar.filter(e => e.w == s.w).length
		)
		.map(
			// e => {
			//   e.w = grammar.find(s=>s.w == e.w).v
			//   return e;
			// }
			o => Object.assign({}, o, { term: grammar.find(s => s.w == o.w).v })
		);

	result.root = result.pos
		.map(e => e.term)
		.filter((v, i, a) => a.indexOf(v) === i);
	return result;
}
