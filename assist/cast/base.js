import { db } from "lethil";
import * as anchor from "../anchor/index.js";

export const { json, glossary } = anchor;
export const { dictionaries, table } = anchor.env.config;

export const mysql = db.mysql;

/**
 * @namespace
 * @property {object} settings
 * @property {TypeOfInfo} settings.info
 */
export const settings = {
	totalWord: 167841,
	percentageCompletion: 0,
	info: {},
	abc: true
};

/**
 * @typedef {Object<string,any>} TypeOfInfoProgress
 * @property {string} name
 * @property {string} my
 * @property {number} [percentage] - 87.5
 * @property {string} [id] - word
 * @property {number} [status] - 58497
 *
 * @typedef {Object} TypeOfInfo
 * @property {string} title
 * @property {string} keyword
 * @property {string} description
 * @property {number} dated
 * @property {Object} info
 * @property {string} info.header
 * @property {TypeOfInfoProgress[]} info.progress
 * @property {string[]} info.context
 * property {Object} info.progress
 * property {string} info.progress.name
 * property {string} info.progress.my
 * property {string} info.progress.my
 * property {number} [info.progress.percentage] - 87.5
 * property {string} [info.progress.id] - word
 * property {number} [info.progress.status] - 58497
 * property {{name:string,my:string,percentage?:number, id?:string, status?:number}[]} info.progress
 */

/**
 * @param {number} number
 * @returns {string}
 */
export function number_format(number) {
	return new Intl.NumberFormat("en-GB").format(number);
}

/**
 * @param {string} file
 * @returns {Promise<TypeOfInfo>}
 */
export function info_read(file) {
	return json.read(file);
}

/**
 * Percentage for definition
 * @param {number} [total] - completed words count
 * @returns {Promise<number>}
 */
export async function percentageDefinition(total) {
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
		await percentageDefinition();
	}
	let completion = (total / settings.totalWord) * 100;
	return (settings.percentageCompletion * completion) / 100;
}
