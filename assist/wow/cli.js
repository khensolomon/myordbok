/**
 * WOW request
 * @param {any} req
 * @example
 * node run wow
 * node run wow request definitions
 * node run wow request definitions --identify=[unsuccess,block,all,none] ???
 * node run wow export words ???
 * node run wow test words ???
 * node run wow test request
 * node run wow test examine
 */
export default async function main(req) {
	switch (req.params.task) {
		case "test":
			return await doTest(req.params.name).then(e => e(req));
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
		case "definitions":
			return (await import("./definitions.js")).doRequest;
		default:
			return noName;
	}
}

/**
 * @param {string} [name]
 */
async function doTest(name) {
	switch (name) {
		case "request":
			return (await import("./test.js")).doTestRequests;
		case "examine":
			return (await import("./test.js")).doTestExamine;
		case "direct":
			return (await import("./test.js")).doTestDirect;
		case "scan":
			return (await import("./test.js")).doScanAll;
		case "word":
			return (await import("./test.js")).doScanWord;
		case "definitions":
			return (await import("./definitions.js")).doRequest;
		default:
			return (await import("./test.js")).doTestDefault;
	}
}

/**
 * @param {string} [name]
 */
async function doExport(name) {
	switch (name) {
		case "words":
			return (await import("./definitions.js")).doExport;
		default:
			return noName;
	}
}

/**
 * @param {any} req
 */
function noTask(req) {
	if (req.params.task) {
		return `Wow has no such task '${req.params.task}' name!`;
	}
	return `Provide a task name for Wow!`;
}

/**
 * @param {any} req
 */
function noName(req) {
	return `What to ${req.params.task} from ${req.params.name} of Wow?`;
}
