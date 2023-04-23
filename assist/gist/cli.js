/**
 * Cast export
 * @param {any} req
 * @example
 * node run gist
 * node run gist file list
 * node run gist file get
 * node run cast file patch
 * node run cast file delete
 * node run cast test
 */
export default async function main(req) {
	switch (req.params.task) {
		case "file":
			return await doFile(req.params.name).then(e => e(req));
		case "test":
			return (await import("./test.js")).default(req);
		default:
			return noTask(req);
	}
}

/**
 * @param {any} [name]
 */
async function doFile(name) {
	switch (name) {
		case "list":
			return (await import("./gist.js")).doList;
		case "get":
			return (await import("./gist.js")).doGet;
		case "patch":
			return (await import("./gist.js")).doPatch;
		case "delete":
			return (await import("./gist.js")).doDelele;
		default:
			return noName;
	}
}

/**
 * @param {any} req
 */
function noTask(req) {
	if (req.params.task) {
		return `Gist has no such task '${req.params.task}' name!`;
	}
	return `Provide a task name for Gist!`;
}

/**
 * @param {any} req
 */
function noName(req) {
	return `What to ${req.params.task} from ${req.params.name} of Gist?`;
}
