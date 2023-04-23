/**
 * Setup
 * @param {any} req
 * @example
 * node run setup
 * node run setup ecosystem
 * node run setup environment
 */

export default async function main(req) {
	switch (req.params.task) {
		case "ecosystem":
			return (await import("./ecosystem.js")).default(req);
		case "environment":
			return (await import("./environment.js")).default(req);
		default:
			return noTask(req);
	}
}

/**
 * @param {any} req
 */
function noTask(req) {
	if (req.params.task) {
		return `Setup has no such task '${req.params.task}' name!`;
	}
	return `Provide a task name for Setup!`;
}
