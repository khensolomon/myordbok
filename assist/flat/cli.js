/**
 * @param {any} req
 * @example
 * node run flat
 * node run flat test --file ./cache/saidict.csv delimiter comma header true
 * node run flat test --file=./cache/saidict.tsv delimiter=tab header=true quoted=double|single
 * node run flat test --file=./cache/saidict.json delimiter=tab header=true quoted=double|single
 * node run flat test --file=./cache/ruenmmeleengdict.tsv header=true
 */
export default async function main(req) {
	switch (req.params.task) {
		case "test":
			return await doTest(req.params.name).then(e => e(req.query));
		default:
			return noTask(req);
	}
}

/**
 * @param {any} [name]
 */
async function doTest(name) {
	switch (name) {
		case "auto":
			return (await import("./test.js")).doAuto;
		default:
			return (await import("./test.js")).default;
	}
}

/**
 * @param {any} req
 */
function noTask(req) {
	if (req.params.task) {
		return `Flat has no such task '${req.params.task}' name!`;
	}
	return `Provide a task name for Flat!`;
}
