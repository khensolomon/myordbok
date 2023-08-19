import { db } from "lethil";

import { env } from "../anchor/index.js";
export { seed } from "../anchor/index.js";

export const { dictionaries, table } = env.config;
export const mysql = db.mysql;

/**
 * @namespace
 * @property {object} settings
 * @property {TypeOfInfo} settings.info
 */
export const settings = {
	totalWord: 171190, // 305063 167841
	percentageCompletion: 0,
	info: {},
	abc: true
};

/**
 *
 * numFormat numPercentage
 * @param {number} number
 * @returns {string}
 */
export function number_format(number) {
	return new Intl.NumberFormat("en-GB").format(number);
}

// /**
//  * @param {string} file
//  * @returns {Promise<anchor.env.RowOfInfo>}
//  */
// export function info_read(file) {
// 	return json.read(file);
// }

/**
 * Percentage of definition completion
 * pecDef defPers p
 * percentage
 * @param {number} [total] - completed words count
 * @returns {Promise<number>}
 */
export async function percentage(total) {
	if (!total) {
		const raw = await mysql.query(
			"SELECT wrid FROM ?? WHERE word IS NOT NULL GROUP BY wrid;",
			[table.senses]
		);
		total = raw.length;
	}
	if (!total) {
		total = 0;
	}
	settings.percentageCompletion = (total / settings.totalWord) * 100;
	return settings.percentageCompletion;
}

/**
 * Percentage for translation
 * @param {number} total - completed words count
 * @returns {Promise<number>}
 */
export async function percentageTranslation(total) {
	if (settings.percentageCompletion == 0) {
		await percentage();
	}
	let completion = (total / settings.totalWord) * 100;
	return (settings.percentageCompletion * completion) / 100;
}
