import { seek, db } from "lethil";
import * as env from "../anchor/env.js";

/**
 * @typedef {{word:string, type:string, pron:{mlc:string,ipa:string}, sense:[], ety?:[], ref?:[], rel?:[], variant?:[]}} TypeOJ
 * @typedef {{id:number, word:string}} TypeWord
 * Transition to DB
 */
class Task {
	/**
	 * @type {TypeOJ[]}
	 */
	_oj = [];
	/**
	 * @type {TypeWord[]}
	 */
	_wb = [];
	get file() {
		return new db.flat({
			file: seek.resolve(env.config.media, "glossary/med/definitions.json")
			// file: seek.resolve(env.config.media, "sea/definitions.json")
		});
	}
	/**
	 * Read all JSON
	 * @returns{Promise<TypeOJ[]>}
	 */
	async oj() {
		if (this._oj.length == 0) {
			this._oj = await this.file.readJSON();
		}
		return this._oj;
	}
	/**
	 * Read all word from db
	 * @returns{Promise<TypeWord[]>}
	 */
	async wb() {
		if (this._wb.length == 0) {
			this._wb = await db.mysql.query("SELECT id, word FROM ??;", ["med_word"]);
		}
		return this._wb;
	}
}

const med = new Task();

/**
 * For transition purposes only
 */
export default async function() {
	return eachWord();
	// return testThesausus();
	// return wordweb();
	// return testDb();
	// return makup();
}

export function wordweb() {
	let val = "9775DA3313BD5ACF1B224A504F4802575DF2";
	let buf = Buffer.from(val, "hex");
	let data = buf.toString("utf8");
	console.log("wordweb", data);
}

/**
 * Test sense
 * 3247 26539
 */
export async function makup() {
	const res = await db.mysql.query("SELECT * FROM ?? WHERE sense LIKE ?;", [
		"med_mean",
		"[=%"
	]);
	let total = res.length;

	for (let index = 0; index < total; index++) {
		const ob = res[index];
		let id = ob.id;
		// let sense = ob.sense;
		// const senseMatch = "[=:ဆုတောင်း] v.".match(/\[(.*)\]/);
		const senseMatch = ob.sense.match(/\[(.*)\]/);
		if (senseMatch) {
			const ref = senseMatch[0];
			await db.mysql.query("UPDATE ?? SET sense=?, ref=? WHERE id=?;", [
				"med_mean",
				null,
				ref,
				id
			]);
		}
	}
	return "Ok " + total;
}

/**
 * Make unique words
 */
export async function makeUniqueWords() {
	let oj = await med.oj();
	let total = oj.length;
	let tmp = oj.map(e => e.word.replace(/\s+/g, " ").trim());
	let uniqueWords = [...new Set(tmp)];

	for (let index = 0; index < total; index++) {
		const ob = oj[index];
		await insertOrUpdateWord(ob);
	}
	console.log("oj:", total, "words:", uniqueWords.length);
	return "done";
}

export async function eachWord() {
	console.time("transition");
	const oj = await med.oj();
	const total = oj.length;

	// NOTE: to get the right Id
	let wb = await med.wb();

	// const keywords = [
	// 	"သံရှည်",
	// 	"လျော့",
	// 	"လေသေနတ်",
	// 	"ခိုင်လုံ",
	// 	"အို",
	// 	"ကနုတ်",
	// 	"မဟာကပ်"
	// ];
	// const keyword = keywords[0];
	// wb = wb.filter(e => e.word == keyword);
	const wordCount = wb.length;

	// Each Unique Word
	for (let oIn = 0; oIn < wordCount; oIn++) {
		const wr = wb[oIn];
		const wrid = wr.id;

		let uwo = oj.filter(e => e.word == wr.word);
		let uwoCount = uwo.length;
		for (let uIn = 0; uIn < uwoCount; uIn++) {
			const wro = uwo[uIn];

			let rfid = await eachReference(wrid, wro);
			await eachSense(wrid, rfid, uIn, wro.sense);
			// await eachThesausus(wrid, uIn, wro);
		}

		console.log("id", wr.id);
	}

	// console.log("word", co);
	console.log("oj:", total, "words:", wordCount);
	console.timeEnd("transition");
	return "done";
}
export async function testReference() {
	const oj = await med.oj();
	const wb = await med.wb();
	let uwo = oj.filter(e => e.word == "က");
	let uwoCount = uwo.length;
	let wrid = wb.find(e => e.word == "က")?.id;
	if (!wrid) {
		wrid = 0;
	}
	for (let uIn = 0; uIn < uwoCount; uIn++) {
		const wro = uwo[uIn];
		let rfid = await eachReference(wrid, wro);
		await eachSense(wrid, rfid, uIn, wro.sense);
	}
}
export async function testSense() {
	// NOTE: since it required insertId of reference, testReference do all the work
}
export async function testThesausus() {
	const oj = await med.oj();
	const wb = await med.wb();
	let uwo = oj.filter(e => e.word == "က");
	let uwoCount = uwo.length;
	let wrid = wb.find(e => e.word == "က")?.id;
	if (!wrid) {
		wrid = 0;
	}
	for (let uIn = 0; uIn < uwoCount; uIn++) {
		const wro = uwo[uIn];
		await eachThesausus(wrid, uIn, wro);
	}
}

/**
 * etymology, wordReference, wordVariant of based word
 * @param {number} wrid
 * @param {TypeOJ} o
 * @returns{Promise<number>} - insertId or 0
 */
async function eachReference(wrid, o) {
	// NOTE: etymology
	let ety = null;
	if (o.ety) {
		ety = o.ety.toString();
		if (ety == "") {
			ety = null;
		}
	}
	// NOTE: wordReference
	let ref = null;
	if (o.ref) {
		ref = o.ref.toString();
		if (ref == "") {
			ref = null;
		}
	}
	// NOTE: wordVariant
	let variant = null;
	if (o.variant) {
		variant = o.variant.toString();
		if (variant == "") {
			variant = null;
		}
	}

	let tmp = ety || ref || variant;
	if (tmp) {
		let rs = await db.mysql.query(
			" INSERT INTO ?? (wrid, etymology, reference, variant) VALUES (?,?,?,?);",
			["med_reference", wrid, ety, ref, variant]
		);
		if (rs && rs.insertId) {
			return rs.insertId;
		}
	}
	return 0;
}

/**
 * Generate sense
 * @param {number} wrid - word id
 * @param {number} rfid - reference id
 * @param {number} cate - group id (index of word)
 * @param {any[]} o
 */
async function eachSense(wrid, rfid, cate, o) {
	if (o) {
		let total = o.length;
		for (let index = 0; index < total; index++) {
			const sense = o[index];

			const wrte = posId(sense.pos);
			let def = sense.def.toString();
			// const def = formatDefinition(sense.def);
			const usg = formatUsage(sense.usg);
			const ref = formatReference(sense.ref);

			/**
			 * @type {any[]}
			 */
			let exploded = [];
			if (def) {
				/**
				 * @type {any[]}
				 */
				const defExplode = def.split(";");
				exploded = defExplode.map(s => s.trim()).filter(e => e != null);
			}
			if (exploded.length > 1) {
				for (let eid = 0; eid < exploded.length; eid++) {
					const item = exploded[eid];
					const o = formatDefinition(item, ref);
					await insertSense(
						wrid,
						wrte,
						rfid,
						cate,
						o.trid,
						o.mean,
						o.exam,
						usg,
						o.ref
					);
				}
			} else {
				const o = formatDefinition(def, ref);
				await insertSense(
					wrid,
					wrte,
					rfid,
					cate,
					o.trid,
					o.mean,
					o.exam,
					usg,
					o.ref
				);
			}
		}
	}
}

/**
 * @param {number} wrid
 * @param {number} wrte
 * @param {number} rfid
 * @param {number} cate - goid, kind index, kndx, kdex, type index, tp kyte kpte cate, block index cadx
 * @param {number} trid - ?
 * @param {string | null} sense
 * @param {string | null} exam
 * @param {string | null} usg
 * @param {string | null} ref
 */
async function insertSense(
	wrid,
	wrte,
	rfid,
	cate,
	trid,
	sense,
	exam,
	usg,
	ref
) {
	return db.mysql.query(
		"INSERT INTO ?? (wrid, wrte, rfid, cate,trid, sense, exam, wrkd, usg,ref) VALUES (?,?,?,?,?,?,?,?,?,?);",
		["med_sense", wrid, wrte, rfid, cate, trid, sense, exam, 40, usg, ref]
	);
}
/**
 * Thesausus of based word
 * @param {number} wrid - word id
 * @param {number} cate - index of category, based on index position
 * @param {TypeOJ} o - current
 * await eachThesausus(wrid, wro, uIn, swo);
 */
async function eachThesausus(wrid, cate, o) {
	if (o.rel && o.rel.length) {
		let rel = o.rel;
		const oj = await med.oj();
		const wb = await med.wb();
		// NOTE: map each index to word, miw
		let miw = rel.map(index => oj[index]).map(e => e.word);
		// NOTE: map each word to id
		let ids_dump = miw.map(w => wb.find(e => e.word == w)).map(e => e && e.id);

		const ids = [...new Set(ids_dump)];
		// console.log("rel", rel);
		// console.log("ids", ids);

		for (let index = 0; index < ids.length; index++) {
			let wlid = ids[index];
			if (wlid) {
				await insertThesausus(wrid, wlid, cate);
			}
		}
	}
}
/**
 * @param {number} wrid - word id
 * @param {number} wlid - word related id
 * @param {number} cate - word category
 */
async function insertThesausus(wrid, wlid, cate) {
	return db.mysql.query("INSERT INTO ?? (wrid, wlid, cate) VALUES (?,?,?);", [
		"med_thesaurus",
		wrid,
		wlid,
		cate
	]);
}

/**
 * Get wrte ID
 * if exp then convert to phra
 * @param {string} str - sense.pos as shortname
 */
function posId(str) {
	if (str == "exp") {
		str = "phra";
	}
	let pos = env.synset.find(e => e.shortname == str);
	if (pos) {
		return pos.id;
	}
	return 0;
}

/**
 * @typedef {string|null} DefType
 * @typedef {{mean:DefType, exam:DefType, ref:DefType, trid:number}} DefBlock
 * Format definition
 * @param {DefType} o - sense.def
 * @param {DefType} ref - sense.ref
 * @returns {DefBlock}
 * returns {string|null}
 */
function formatDefinition(o, ref) {
	const lk_opened = "[:";
	const lk_closed = "]";
	/**
	 * @type {DefBlock}
	 */
	const res = {
		mean: null,
		exam: null,

		ref: null,
		trid: 0
	};
	if (ref) {
		res.ref = ref;
	}

	if (o) {
		res.mean = o.toString();

		// NOTE: Bracket Example RegX all [.*]
		// EXAM: /\[e:.*?[^\)]\]/g
		// EXAM: /\[e:.*?[^]\]/g
		const bracketExamReg = /\[e:.*?[^]\]/g;
		// let brackets = res.mean.match(/\[e:.*?[^\)]\]/g);
		let brackets = res.mean.match(bracketExamReg);
		if (brackets && brackets.length) {
			let exam = brackets.filter(e => e.startsWith("[e:"));
			if (exam.length) {
				// res.exam = exam.join(", ");
				// res.mean = res.mean.replace(/\[exam:.*?[^\)]\]/g, "");

				// let abc = "[[exam:abc]]".match(/\[exam:(.*?)\]/);
				// let abc = "[[exam:abc]]".match(/\[exam:(.*?)\]/);
				res.exam = exam
					.map(e =>
						e
							.replace("[e:", "")
							.replace("]", "")
							.replace(/\</g, lk_opened)
							.replace(/\>/g, lk_closed)
							// .replace(/\//g, "; ")
							.trim()
					)
					.join("; ");
				res.mean = res.mean.replace(bracketExamReg, "");
			}
			// let ref = brackets.filter(e => !e.startsWith("[e:"));
			// if (ref.length) {
			// 	let refDump = ref.join(", ");
			// 	if (res.ref) {
			// 		res.ref = res.ref + ", " + refDump;
			// 	} else {
			// 		res.ref = refDump;
			// 	}
			// 	res.mean = res.mean.replace(/\[.*?[^\)]\]/g, "");
			// }
		}
	}
	if (res.mean) {
		res.mean = res.mean
			.replace(/\s+\)/g, ")")
			.replace(/\(\s+/g, "(")
			.replace(/\(\)/g, " ")
			.replace(/\s+/g, " ")
			.replace(/\</g, lk_opened)
			.replace(/\>/g, lk_closed)
			.trim();
	}

	if (res.mean == "") {
		res.mean = null;
		res.trid = 4;
	}
	if (res.mean) {
		let sp = res.mean.match(/\s/g);
		// NOTE: none space is a word, 1 space is a phrase
		if (sp) {
			let spl = sp.length;
			if (spl == 1) {
				res.trid = 2;
			}
		} else {
			res.trid = 1;
		}
	}

	return res;
}

/**
 * Format usage
 * @param {any} o - sense.usg
 * @returns {string|null}
 * @example
 * [type:TIME, usage:arch]
 */
function formatUsage(o) {
	if (o) {
		let usgDump = Object.keys(o)
			.map(e => e + ":" + o[e])
			.join(", ");

		if (usgDump) {
			return "[" + usgDump + "]";
		}
	}
	return null;
}

/**
 * Format reference
 * @param {any} o - sense.ref
 * @returns {string|null}
 */
function formatReference(o) {
	if (o) {
		if (o.length) {
			return o.toString();
		}
	}
	return null;
}

/**
 * prepare word
 * @param {any} o - ob
 * Unique Words list
 */
async function insertOrUpdateWord(o) {
	let word = o.word;
	// NOTE: type
	// let origin_type = o.type;
	// NOTE: pron
	let mlc = null;
	let ipa = null;
	if (o.pron) {
		if (o.pron.mlc) {
			mlc = o.pron.mlc;
		}
		if (o.pron.ipa) {
			ipa = o.pron.ipa;
		}
	}

	await db.mysql.query(
		" INSERT INTO ?? (word, mlc, ipa, identical) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE identical=identical+1;",
		["med_wordlist", word, mlc, ipa, 0]
	);
}
