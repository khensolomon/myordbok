/**
 * SEA request
 * @param {any} req
 * @example
 * node run sea
 * node run sea/request-alphabets
 * node run sea/request-keywords
 * node run sea/request-definitions
 * node run sea/request-definitions?identify=[unsuccess,block,all,none]
 */
async function main(req) {
	switch (req.params.task) {
		case "request":
			return await request(req.params.name)
				.then(e => e(req))
				.catch(e => e);

		default:
			return "What todo?";
	}
}

/**
 * @param {string} [name]
 */
async function request(name) {
	switch (name) {
		case "alphabets":
			return (await import("./alphabets.js")).request;
		case "keywords":
			return (await import("./keywords.js")).request;
		case "definitions":
			return (await import("./definitions.js")).request;
		default:
			return requestNone;
	}
	// switch (name) {
	// 	case "alphabets":
	// 		return (await import("./alphabets.js")).default();
	// 	case "keywords":
	// 		return (await import("./keywords.js")).default();
	// 	case "definitions":
	// 		return (await import("./definitions.js")).default();
	// 	default:
	// 		return requestNone;
	// }
}

/**
 * @param {any} req
 */
async function requestNone(req) {
	return "request what?";
}
export default main;
