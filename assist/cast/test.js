import * as base from "./base.js";

/**
 * @param {any} req
 */
export default async function test(req) {
	// try {
	// 	let abc = await db.mysql.query(
	// 		"SELECT COUNT(word) AS total FROM ?? WHERE derived = 0;",
	// 		[table.synset]
	// 	);
	// 	console.log("abc", abc);
	// 	return "done";
	// } catch (error) {
	// 	// console.log("error-1", error);
	// 	return error;
	// }
	let abc = await base.mysql.query(
		"SELECT COUNT(word) AS total FROM ?? WHERE derived = 0;",
		[base.table.synset]
	);
	console.log("test", abc);
	return "done";
}
