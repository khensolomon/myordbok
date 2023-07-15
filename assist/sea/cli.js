/**
 * SEA request
 * @param {any} req
 * @example
 * node run sea
 * node run sea request alphabets
 * node run sea request keywords
 * node run sea request definitions
 * node run sea request definitions --identify=[unsuccess,block,all,none]
 * node run sea export words
 */

export default async function main(req) {
	switch (req.params.task) {
		case "request":
			return await doRequest(req.params.name).then(e => e(req));
		case "export":
			return await doExport(req.params.name).then(e => e(req));
		default:
			return noTask(req);
	}
}

/**
 * @param {string} [name]
 */
async function doRequest(name) {
	switch (name) {
		case "alphabets":
			return (await import("./alphabets.js")).doRequest;
		case "keywords":
			return (await import("./keywords.js")).doRequest;
		case "definitions":
			return (await import("./definitions.js")).doRequest;
		default:
			return noName;
	}
}

/**
 * @param {string} [name]
 */
async function doExport(name) {
	switch (name) {
		case "words":
			return (await import("./definitions.js")).doExportWord;
		default:
			return noName;
	}
}

/**
 * @param {any} req
 */
function noTask(req) {
	if (req.params.task) {
		return `Sea has no such task '${req.params.task}' name!`;
	}
	return `Provide a task name for Sea!`;
}

/**
 * @param {any} req
 */
function noName(req) {
	return `What to ${req.params.task} from ${req.params.name} of Sea?`;
}
