import { config, seek } from "lethil";
import { resolve } from "path";
// import util from "util";
import ttfMeta from "ttfmeta";

// const { media } = config;

export default class fonts {
	/**
	 * @property {{[k: string]:any}}
	 * @type {{[k: string]:{[k: string]:any}}}
	 */
	store = {};
	/**
	 * @param {string} type
	 */
	constructor(type) {
		this.type = type;
	}

	/**
	 * @param {...string} fileName
	 */
	root(...fileName) {
		return resolve(config.media, "fonts", fileName.join("/"));
	}

	/**
	 * @param {string} fileName
	 */
	fileJSON(fileName = this.type) {
		return this.root(fileName + ".json");
	}

	/**
	 * @param {string} fileName
	 */
	async read(fileName = this.type) {
		if (this.store.hasOwnProperty(fileName)) {
			return this.store[fileName];
		} else {
			let file = this.fileJSON(fileName);
			this.store[fileName] = [];

			return seek
				.read(file)
				.then(e => (this.store[fileName] = JSON.parse(e.toString())))
				.catch(() => {});
		}
	}

	/**
	 * @param {string} fileName
	 */
	write(fileName) {
		if (this.store.hasOwnProperty(fileName)) {
			let file = this.fileJSON(fileName);
			seek
				.write(file, JSON.stringify(this.store[fileName]))
				.then(() => true)
				.catch(() => false);
		}
	}

	/**
	 * @param {string} name
	 */
	fileFont(name) {
		return this.root(this.type, name);
	}

	/**
	 * @param {string} fileName
	 */
	async view(fileName) {
		var response = {};
		var item = null;
		if (this.type && fileName) {
			var file = this.fileFont(fileName);
			await this.read(this.type);

			if (this.store.hasOwnProperty(this.type)) {
				var index = this.store[this.type].findIndex(x => x.file == fileName);
				if (index >= 0) {
					item = this.store[this.type][index];
					if (item instanceof Object) {
						this.store[this.type][index].view++;
						this.sortable();
						this.write(this.type);
					}
				}
			}
			await ttfMeta.promise(file).then(async e => {
				if (e && e.hasOwnProperty("tables")) {
					response = await this.view_response(e.tables.name);
					if (item instanceof Object && !item.hasOwnProperty("restrict")) {
						response.unrestrict = true;
					}
				}
			});
		}
		return response;
	}

	/**
	 * @param {string} fileName
	 */
	async download(fileName) {
		if (this.type && fileName) {
			await this.read(this.type);
			if (this.store.hasOwnProperty(this.type)) {
				var index = this.store[this.type].findIndex(x => x.file == fileName);
				if (index >= 0) {
					var item = this.store[this.type][index];
					if (item instanceof Object && !item.hasOwnProperty("restrict")) {
						this.store[this.type][index].download++;
						this.sortable();
						this.write(this.type);
						return this.fileFont(fileName);
					}
				}
			}
		}
		return null;
	}

	/**
	 * @param {{[k:string]:any}} e
	 */
	async view_response(e) {
		var abc = {
			0: "Copyright",
			1: "Font Family",
			2: "Font Subfamily",
			3: "Unique identifier",
			4: "Full name",
			5: "Version",
			6: "Postscript name",
			7: "Note",
			8: "Company",
			9: "Owner",
			10: "Description",
			11: "URL",
			12: "URL",
			13: "License",
			14: "URL",
			// 15: '',
			16: "Name"
			// 17: ''
		};
		// info description license, url
		var response = {
			// title:null,
			// keywords:null,
			// description:null,
			info: []
			// description:[],
			// license:[],
			// url:[]
		};

		for (const key in e) {
			if (e.hasOwnProperty(key)) {
				const i = parseInt(key);
				const context = e[i].trim();
				var paragraphs = context
					.replace("~\r\n?~", "\n")
					.split("\n")
					.map(i => i.trim())
					.filter(i => i != null && i != "");
				if (paragraphs.length > 1) {
					var id = i == 10 ? "definition" : "license";
					response[id] = [];
					for (const eP in paragraphs) {
						if (paragraphs.hasOwnProperty(eP)) {
							var text = paragraphs[eP].trim();
							var testH = /^[^a-z]*$/.test(text);
							var tagName = testH
								? text.split(" ").length > 4
									? "p"
									: "h3"
								: "p";
							response[id].push({ tag: tagName, text: text });
						}
					}
				} else if (context) {
					if (
						/^s?https?:\/\/[-_.!~*'()a-zA-Z0-9;\/?:\@&=+\$,%#]+$/.test(context)
					) {
						if (!response.hasOwnProperty("url")) response.url = [];
						response.url.push({ href: context, text: context });
						// response.url = [...new Set(response.url)];
						// response.url = response.url.filter((v, i, a) => a.indexOf(v) === i);
					} else if (i > 0 && i < 6) {
						var className = abc[i].replace(" ", "-").toLowerCase();
						var tagName = "h" + i;
						response.info.push({
							tag: tagName,
							class: className,
							text: context
						});
					} else {
						if (abc.hasOwnProperty(i)) {
							if (i == 0 || i == 7) {
								if (!response.hasOwnProperty("definition"))
									response.definition = [];
								var paragraphs = context
									.replace(/---+/, "\n")
									.split("\n")
									.map(i => i.trim())
									.filter(i => i != null && i != "");
								for (const eP in paragraphs) {
									if (paragraphs.hasOwnProperty(eP)) {
										var text = paragraphs[eP].trim();
										var tagName = /^[^a-z]*$/.test(text)
											? text.split(" ").length > 4
												? "p"
												: "h3"
											: "p";
										response.definition.push({ tag: tagName, text: text });
									}
								}
							} else if (i == 13) {
								if (!response.hasOwnProperty("license")) response.license = [];
								var tagName = /^[^a-z]*$/.test(text)
									? text.split(" ").length > 4
										? "p"
										: "h3"
									: "p";
								response.license.push({ tag: tagName, text: context });
							} else {
								var className = abc[i].replace(" ", "-").toLowerCase();
								response.info.push({
									tag: "p",
									class: className,
									text: context
								});
							}
						}
					}
				}
				if (!response.hasOwnProperty("meta")) response.meta = {};
				if (i == 1) {
					response.title = context.replace("_", " ");
					response.keywords = context.replace("_", ",");
					response.description = context;
				} else if (i == 7 && context) {
					response.description = context;
				} else if (i == 4 && context) {
					response.description = context;
				}
			}
		}
		return response;
	}

	sortable() {
		return (this.store[this.type] = this.store[this.type].sort(function(a, b) {
			return b.download + b.view - (a.download + a.view);
		}));
	}
}
