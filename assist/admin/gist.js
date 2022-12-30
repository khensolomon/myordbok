/**
 * testing
 */

import { ask } from "lethil";
import { config } from "../anchor/index.js";

const { gistToken, gistId } = config.setting;

const gist = new ask.gistData({ token: gistToken, id: gistId });

/**
 * @param {any} req
 */
export async function get(req) {
	// const file = fs.createWriteStream('/tmp/abc/test.json');
	// var abc = await ask.stream('https://gist.githubusercontent.com/khensolomon/c657c5ba9308e9cae81c8d8a748c26ec/raw/c4ebda9216484ec963245439456e44fdc98ac48d/test.json').then(
	//   e => e.pipe(fs.createWriteStream('/tmp/abc/test.json'))
	// );
	// var result =[];
	// for (const item in abc.files) {
	//   result.push({item:abc.files[item].filename,truncated:abc.files[item].truncated,url:abc.files[item].raw_url})
	// }
	// return result;
	// return abc;
	return await gist.delete("tmp.json");
}

/**
 * @param {any} req
 */
export async function list(req) {
	var abc = await gist.get();
	var result = [];
	for (const item in abc.files) {
		result.push({
			item: abc.files[item].filename,
			truncated: abc.files[item].truncated,
			url: abc.files[item].raw_url
		});
	}
	return result;
}

/**
 * @param {any} req
 */
export async function patch(req) {
	const postData = JSON.stringify(
		{ updates: false, dates: "10.10.21" },
		null,
		2
	);
	return await gist.patch("deleteme.json", postData);
}

/**
 * @param {any} req
 */
export async function remove(req) {
	return await gist.delete("deleteme.json");
}
