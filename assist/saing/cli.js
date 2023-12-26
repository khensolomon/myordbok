import { JSDOM } from "jsdom";
// import * as csv from "csv";
import { seek, burglish } from "lethil";
// import { env, json } from "../anchor/index.js";
import seedMain from "../anchor/seed.js";

// const { table } = env.config;

/**
 * id word sense 1
 * @typedef {string} BlogUrl
 * @typedef {{word:string, url:string, status:number}} BlogCatalogue
 * @typedef {{word:string, url:string, status:number, sub:BlogLink[]}} BlogLink
 * typedef {string} BlogCatalogue
 * typedef {Object<string,string[]>} BlogContext
 * @typedef {Object<string,string[]>} BlogContext
 * @typedef {{url:BlogUrl, alphabet:BlogLink[], context:BlogContext}} Blog
 */
/**
 * @type {Blog}
 */
const blog = {
	url: "",
	alphabet: [],
	// catalogue: [],
	context: {}
};
/**
 * Scan
 * @param {any} req
 * @example
 * node run saing
 * node run saing/csv
 */
async function main(req) {
	// return req;
	let obj = new seedMain({ file: "saing/blog.json" });
	obj.fileCatch = blog;
	obj.fileCache = false;
	await obj.read();
	// const file = glossary.get("saing/blog.json");
	// const tmp = await seek.readJSON(file, blog);
	Object.assign(blog, obj.raw);

	if (req.params.task) {
		await exportCSV();
		console.log("task", req.params.task);
	} else {
		await get_alphabet();
		await get_loop(obj.file);
		await seek.writeJSON(obj.file, blog, 2);
	}
	return "done";
}

/**
 *
 * @param {string} [file]
 */
async function get_loop(file) {
	for (const job of blog.alphabet) {
		if (job.sub.length) {
			console.log(" > catalogue:", "exist", job.word);
		} else {
			// if (await get_catalogue(job)) {
			// 	console.log(" > catalogue", job.status, job.word);
			// } else {
			// 	console.log(" > catalogue:", "?", job.word);
			// }
			if (job.status > 0) {
				console.log(" > catalogue:", "?", job.word);
			} else if (await get_catalogue(job)) {
				console.log(" > catalogue", job.status, job.word);
			}
		}
		for (const task of job.sub) {
			var status = "exist";
			if (task.status == 0) {
				status = "done";
				const content = await get_definition(task);
				if (content.length) {
					blog.context[task.word] = content;
					status = "oops";
				}
			}

			console.log(" >> definition:", status, task.word);
			if (file) {
				await seek.writeJSON(file, blog, 2);
			}
		}
	}
}
/**
 * if `blog.alphabet` empty
 * @returns {Promise<boolean>}
 */
async function get_alphabet() {
	if (blog.alphabet.length == 0) {
		const dom = await JSDOM.fromURL(blog.url, {});
		var html = dom.window.document.querySelectorAll(
			"div#HTML2>div>table>tbody>tr>td"
		);

		for (const ele in html) {
			if (Object.hasOwnProperty.call(html, ele)) {
				var a = html[ele].querySelector("a");
				if (a) {
					var href = a.getAttribute("href");
					if (href && a.textContent) {
						const content = makeupContent(a.textContent);
						const url = makeupHref(href);
						makeupCatalogue(blog.alphabet, content, url);
					}
				}
			}
		}
		console.log(" > alphabet:", "done");
		return true;
	}
	console.log(" > alphabet:", "exist");
	return false;
}

/**
 * if `blog.alphabet` empty
 * @param {BlogLink} job
 * @returns {Promise<boolean>}
 */
async function get_catalogue(job) {
	// const job = blog.alphabet[index];
	const url = blog.url + job.url;
	const dom = await JSDOM.fromURL(url, {});
	var catalogue = dom.window.document.querySelectorAll(
		"div.post-body.entry-content table>tbody>tr>td"
	);
	if (catalogue.length) {
		for (const ele in catalogue) {
			if (Object.hasOwnProperty.call(catalogue, ele)) {
				const a = catalogue[ele].querySelector("a");
				if (a) {
					var href = a.getAttribute("href");
					if (href && a.textContent) {
						const content = makeupContent(a.textContent);
						const url = makeupHref(href);
						makeupCatalogue(job.sub, content, url);
					}
				}
			}
		}
		job.status++;
		return true;
	} else {
		console.log("???", job.word);
		blog.context[job.word] = await get_definition(job, dom);
	}

	return false;
}

/**
 * @param {BlogLink} job
 * @param {JSDOM} [dom]
 * @returns {Promise<string[]>}
 */
async function get_definition(job, dom) {
	if (!dom) {
		// dom = await JSDOM.fromURL(
		// 	// "https://saingdictionary.blogspot.com/2008/02/blog-post_8613.html"
		// 	// "http://saingdictionary.blogspot.com/2008/02/blog-post_6166.html"
		// 	// "http://saingdictionary.blogspot.com/2008/02/blog-post_7774.html"
		// 	// "http://saingdictionary.blogspot.com/2008/02/blog-post_9674.html"
		// 	// "http://saingdictionary.blogspot.com/2008/02/blog-post_6119.html"
		// 	// "http://saingdictionary.blogspot.com/2008/02/blog-post_329.html"
		// 	"http://saingdictionary.blogspot.com/2008/02/blog-post_25.html"
		// );
		// dom = await JSDOM.fromURL(blog.url + job.url);
		// if (dom == undefined) {
		// 	return [];
		// }

		try {
			dom = await JSDOM.fromURL(blog.url + job.url);
		} catch (error) {
			let obj = new seedMain({
				file: "saing/error.json"
			});

			obj.fileCatch = {};
			obj.fileCache = false;
			await obj.read();

			// const file = glossary.get("saing/error.json");
			// const tmp = await seek.readJSON(file);

			// ts-ignore
			obj.raw[job.word] = {
				word: job.word,
				url: job.url,
				error: error
			};
			console.log(" >> def", error);
			// await seek.writeJSON(file, tmp, 2);
			await obj.write({ space: 2 });
			return [];
		}
	}
	const html = dom.window.document.querySelector("div.post-body.entry-content");
	// for (const ele in html) {
	// 	if (Object.hasOwnProperty.call(html, ele)) {
	// 		console.log("ele", ele.toString());
	// 	}
	// }
	if (html) {
		const meaning = makeupDefinition(html.innerHTML);
		job.status++;
		return meaning;
	}
	return [];
}

/**
 * @param {string} textContent
 */
function makeupContent(textContent) {
	return burglish(textContent).toUnicode.trim();
}

/**
 * @param {string} href
 */
function makeupHref(href) {
	return href.replace("http:", "https:").replace(blog.url, "");
}
/**
 * @param {BlogLink[]} task
 * @param {string} word
 * @param {string} url
 */
function makeupCatalogue(task, word, url) {
	// job.sub.push({ word: content, url: url, status: 0, cat: [] });
	var index = task.findIndex(e => e.word == word);
	if (index >= 0) {
		task[index] = Object.assign(
			{
				word: word,
				url: url
			},
			task[index]
		);
	} else {
		task.push({
			word: word,
			url: url,
			status: 0,
			sub: []
		});
	}
}

/**
 * @param {string} text - html.innerHTML
 * @returns {string[]}
 */
function makeupDefinition(text) {
	// return text
	// 	.replace(/<\/?[^>]+(>|$)/g, "\n")
	// 	.split("\n")
	// 	.filter(e => burglish(e).toUnicode);
	return burglish(text)
		.toUnicode.replace(/<\/?[^>]+(>|$)/g, "\n")
		.split("\n")
		.filter(e => e);
}

async function exportCSV() {
	// const file = glossary.get("saing/context.csv");
	// // const tmp = await seek.write(file);
	// var content = "";
	// for (const key in blog.context) {
	// 	if (Object.hasOwnProperty.call(blog.context, key)) {
	// 		const element = blog.context[key];
	// 		content += element.join("\r\n");
	// 		content += "\r\n";
	// 	}
	// }
	// await seek.write(file, content);
}
export default main;
