/**
 * Cast export
 * @param {any} req
 * @example
 * node run cast
 * node run cast export definition
 * node run cast export translation
 * node run cast export synset
 * node run cast export synmap
 * node run cast export mew
 * node run cast search synmap --word=loves
 * node run cast test
 */
export default async function main(req) {
	switch (req.params.task) {
		case "export":
			return await doExport(req.params.name).then(e => e(req));
		case "search":
			return await doSearch(req.params.name).then(e => e(req.query.word));
		case "test":
			return (await import("./test.js")).default(req);
		default:
			return noTask(req);
	}
}

/**
 * @param {any} [name]
 */
async function doExport(name) {
	switch (name) {
		case "definition":
			return (await import("./definition.js")).doExport;
		case "translation":
			return (await import("./translation.js")).doExport;
		case "synset":
			return (await import("./synset.js")).doExport;
		case "synmap":
			return (await import("./synmap.js")).doExport;
		case "mew":
			return (await import("./mew.js")).doExport;
		default:
			return noName;
	}
}

/**
 * @param {any} [name]
 */
async function doSearch(name) {
	switch (name) {
		case "synmap":
			return (await import("./search.js")).doSynmap;
		case "synset":
			return (await import("./search.js")).doSynset;
		default:
			return noName;
	}
}

/**
 * @param {any} req
 */
function noTask(req) {
	if (req.params.task) {
		return `Cast has no such task '${req.params.task}' name!`;
	}
	return `Provide a task name for Cast!`;
}

/**
 * @param {any} req
 */
function noName(req) {
	return `What to ${req.params.task} from ${req.params.name} of Cast?`;
}
