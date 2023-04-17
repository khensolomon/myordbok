import { db } from "lethil";

export const flat = db.flat;

/**
 * @typedef {Object<string,any>} TypeOfQuery
 * @property {string} file
 * @property {string} delimiter [comma, tab]
 * @property {boolean} [header] - 87.5
 * @property {string} [quoted] - [double, single]
 *
 */

/**
 * @namespace
 * @property {object} settings
 * @property {boolean} settings.test
 */
export const settings = {
	test: false
};

/**

 * @param {*} req
 * @returns
 */
export function abc(req) {
	return "ok";
}
