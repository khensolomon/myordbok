import path from "path";
import { config, ask, load, seek } from "lethil";
import tar from "tar";

const root = config.dir.root;
const old = read(root);
const url = old.repository.url
	.replace("git+", "")
	.replace(".git", "/archive/master.tar.gz");
var output = config.dir.root;

/**
 * @param {string} dir
 */
function exists(dir) {
	return seek.exists(path.join(dir, "package.json"));
}

/**
 * @param {string} dir
 */
function read(dir) {
	return load.json(dir, "package.json");
}

/**
 * @param {string} dir
 * @param {any} raw
 */
async function write(dir, raw) {
	return await seek.write(
		path.join(dir, "package.json"),
		JSON.stringify(raw, null, 2)
	);
}

/**
 * ...is a terminal and responsible for checking root directory should be overridden
 */
async function download() {
	if (config.development == true && root == output)
		throw new Error("Master repository can not replace");
	return await ask
		.request(url)
		.then(res => res.pipe(tar.x({ strip: 1, C: output })));
}

async function change() {
	if (exists(output)) {
		const idName = "lethil";
		const json = Object.assign({}, old, read(output));
		if (json.dependencies.hasOwnProperty(idName)) {
			if (json.dependencies[idName].includes("file:")) {
				if (old.dependencies[idName].includes("file:")) {
					json.dependencies[idName] = "";
				} else {
					json.dependencies[idName] = old.dependencies[idName];
				}
			}
		}
		if (json.type != "module") json.type = "module";
		delete json.devDependencies;
		await write(output, json);
		return `${old.version} -> ${json.version}`;
	} else {
		return `Extracted, but no package.json`;
	}
}

/**
 * @param {any} req
 * `node run upgrade` - on production
 * `node run upgrade/folderName` on development, where folderName is existing folder and overridden
 */
export default function(req) {
	output = path.join(root, req.params.id || "");
	return new Promise(function(res, rej) {
		download()
			.then(e =>
				e
					.on("finish", () =>
						change()
							.then(res)
							.catch(rej)
					)
					.on("error", rej)
			)
			.catch(rej);
	});
}
