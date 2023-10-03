import { seek, db, digit } from "lethil";
import { resolve } from "path";
import util from "util";
import * as fs from "fs";
import ttfMeta from "ttfmeta";

import config from "../anchor/env.js";

/**
 * @typedef {{file:string,name:string,version:string,family:string, view:number, download:number, restrict?:boolean, total?:string}} TypeFont
 * property {{[k: string]:any}}
 * @type {{[k: string]:TypeFont[]}}
 */
const fontData = {};

export default class fonts {
	catalogue = ["primary", "secondary", "external"];

	/**
	 * @param {string} type
	 */
	constructor(type) {
		this.type = type;
	}

	/**
	 * font root directory
	 * @param {...string} fileName
	 * @return {string}
	 */
	root(...fileName) {
		return resolve(config.media, "fonts", fileName.join("/"));
	}

	/**
	 * @param {string} fileName
	 */
	fileJSON(fileName) {
		return this.root(fileName + ".json");
	}

	/**
	 * Read JSON by catalogue
	 * @param {string} cate
	 * @returns {Promise<TypeFont[]>}
	 */
	async read(cate) {
		if (fontData.hasOwnProperty(cate)) {
			return fontData[cate];
		} else {
			let file = this.fileJSON(cate);
			fontData[cate] = [];
			return seek
				.read(file)
				.then(e => (fontData[cate] = JSON.parse(e.toString())))
				.catch(() => []);
		}
	}

	/**
	 * @param {string} catalogue
	 */
	async write(catalogue) {
		if (fontData.hasOwnProperty(catalogue)) {
			let file = this.fileJSON(catalogue);
			return seek
				.write(file, JSON.stringify(fontData[catalogue]))
				.then(() => true)
				.catch(() => false);
		}
		return false;
	}

	/**
	 * @param {string} fileName
	 */
	fileFont(fileName) {
		return this.root(this.type, fileName);
	}

	/**
	 * View meta
	 * @param {string} fileName
	 */
	async view(fileName) {
		/**
		 * @type {{[k:string]:any}}
		 */
		var info = {};

		for (let index = 0; index < this.catalogue.length; index++) {
			const cate = this.catalogue[index];
			if (!fontData.hasOwnProperty(cate)) {
				await this.read(cate);
			}
		}

		/**
		 * @type {{ hasOwnProperty: (arg0: string) => any; } | null}
		 */
		var item = null;
		if (this.type && fileName) {
			var file = this.fileFont(fileName);

			if (fontData.hasOwnProperty(this.type)) {
				var index = fontData[this.type].findIndex(e => e.file == fileName);

				if (index >= 0) {
					item = fontData[this.type][index];
					if (item instanceof Object) {
						fontData[this.type][index].view++;
						this._sortBySum(this.type);

						db.mysql.query(
							"INSERT INTO ?? SET file=?, view=1 ON DUPLICATE KEY UPDATE view = view + 1;",
							[config.table.fonts, fileName]
						);
					}
				}
			}
			await ttfMeta
				.promise(file)
				.then(async e => {
					if (e && e.hasOwnProperty("tables")) {
						info = await this._metaDetail(e.tables.name);
						if (item instanceof Object && !item.hasOwnProperty("restrict")) {
							info.unrestrict = true;
						}
					}
				})
				.catch(e => {
					info = {};
				});
		}
		return Object.assign(info, fontData);
	}

	/**
	 * Download data
	 * @param {string} fileName
	 */
	async download(fileName) {
		if (this.type && fileName) {
			await this.read(this.type);
			if (fontData.hasOwnProperty(this.type)) {
				var index = fontData[this.type].findIndex(e => e.file == fileName);
				if (index >= 0) {
					var item = fontData[this.type][index];
					if (item instanceof Object && !item.hasOwnProperty("restrict")) {
						fontData[this.type][index].download++;
						this._sortBySum(this.type);
						db.mysql.query(
							"INSERT INTO ?? SET file=?, download=1 ON DUPLICATE KEY UPDATE download = download + 1;",
							[config.table.fonts, fileName]
						);
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
	async _metaDetail(e) {
		/**
		 * @type {any}
		 */
		const tpl = {
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

		/**
		 * info description license, url
		 * @type {{[k: string]:any}}
		 */
		const response = {
			// title:null,
			// keywords:null,
			// description:null,
			info: []
			// description: [],
			// license: []
			// url:[]
		};

		for (const key in e) {
			if (e.hasOwnProperty(key)) {
				const i = parseInt(key);
				// itemFamily.replace(/\u0000/g, ""),
				const context = e[i].replace(/\u0000/g, "").trim();
				var paragraphs = context
					.replace("~\r\n?~", "\n")
					.split("\n")
					.map((/** @type {string} */ i) => i.trim())
					.filter((/** @type {string | null} */ i) => i != null && i != "");
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
							response[id].push({
								tag: tagName,
								text: text
							});
						}
					}
				} else if (context) {
					if (
						/^s?https?:\/\/[-_.!~*'()a-zA-Z0-9;\/?:\@&=+\$,%#]+$/.test(context)
					) {
						if (!response.hasOwnProperty("url")) response.url = [];
						response.url.push({
							href: context,
							text: context
						});
						// response.url = [...new Set(response.url)];
						// response.url = response.url.filter((v, i, a) => a.indexOf(v) === i);
					} else if (i > 0 && i < 6) {
						var className = tpl[i].replace(" ", "-").toLowerCase();
						var tagName = "h" + i;
						response.info.push({
							tag: tagName,
							class: className,
							text: context
						});
					} else {
						if (tpl.hasOwnProperty(i)) {
							if (i == 0 || i == 7) {
								if (!response.hasOwnProperty("definition"))
									response.definition = [];
								var paragraphs = context
									.replace(/---+/, "\n")
									.split("\n")
									.map((/** @type {string} */ i) => i.trim())
									.filter(
										(/** @type {string | null} */ i) => i != null && i != ""
									);
								for (const eP in paragraphs) {
									if (paragraphs.hasOwnProperty(eP)) {
										var text = paragraphs[eP].trim();
										var tagName = /^[^a-z]*$/.test(text)
											? text.split(" ").length > 4
												? "p"
												: "h3"
											: "p";
										response.definition.push({
											tag: tagName,
											text: text
										});
									}
								}
							} else if (i == 13) {
								if (!response.hasOwnProperty("license")) response.license = [];
								var tagName = /^[^a-z]*$/.test(text)
									? text.split(" ").length > 4
										? "p"
										: "h3"
									: "p";
								response.license.push({
									tag: tagName,
									text: context
								});
							} else {
								var className = tpl[i].replace(" ", "-").toLowerCase();
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

	/**
	 * Sort by the sum of (view+download) and Update fontData
	 * @param {string} cate
	 */
	_sortBySum(cate) {
		return (fontData[cate] = fontData[cate].sort((a, b) => {
			return b.view + b.download - (a.view + a.download);
		}));
	}

	/**
	 * Font rebuild catalogue JSON
	 * param {string?} fontParam
	 */
	async scan() {
		for (let index = 0; index < this.catalogue.length; index++) {
			const cate = this.catalogue[index];
			const status = await this._categorize(cate);
			console.log("> font", cate, status);
		}
	}

	/**
	 * use in reading if no fontData
	 * or scan
	 * @param {string} cate - cat/type not need filter as it's internal
	 */
	async _categorize(cate) {
		var directory = this.root(cate);
		var read_dir = util.promisify(fs.readdir);
		// this.read("restrict");

		await this.read(cate);
		const files = await read_dir(directory);
		let filesCount = files.length;
		let typeId = this.catalogue.indexOf(cate);

		if (fontData[cate].length == filesCount) {
			// NOTE: same as last scan, just need to update view and download counts
			/**
			 * @type {{file:string, view:number, download:number, restricted:number}[]}
			 */
			let org = await db.mysql.query(
				"SELECT file, view, download, restricted FROM ?? WHERE types=?;",
				[config.table.fonts, typeId]
			);
			for (let index = 0; index < filesCount; index++) {
				const fileName = files[index];
				let item = org.find(e => e.file == fileName);
				if (item) {
					let index = fontData[cate].findIndex(e => e.file == fileName);
					if (index >= 0) {
						fontData[cate][index].view = item.view;
						fontData[cate][index].download = item.download;
						if (item.restricted > 0) {
							fontData[cate][index].restrict = true;
						} else if (fontData[cate][index].hasOwnProperty("restrict")) {
							delete fontData[cate][index].restrict;
						}
					}
				}
			}
		} else {
			// NOTE: not same as last scan, need to regenerated
			fontData[cate] = [];
			for (let index = 0; index < filesCount; index++) {
				const fileName = files[index];

				const o = await ttfMeta.promise(this.root(cate, fileName));
				if (o && o.hasOwnProperty("meta")) {
					const org = await db.mysql.query(
						"SELECT view, download, restricted FROM ?? WHERE file=?;",
						[config.table.fonts, fileName]
					);
					var countView = 0;
					var countDownload = 0;
					var isrestrict = false;

					if (org.length) {
						countView = org[0].view;
						countDownload = org[0].download;

						isrestrict = org[0].restricted > 0;
					}

					let oj = o.meta.property;
					let itemFamily = oj.find(e => e.name == "font-family")?.text || "";
					let itemVersion = oj.find(e => e.name == "version")?.text || "";
					let itemSub = oj.find(e => e.name == "font-subfamily")?.text || "";
					/**
					 * @type {TypeFont}
					 */
					const item = {
						file: fileName,
						name: itemFamily.replace(/\u0000/g, ""),
						version: itemVersion.replace(/\u0000/g, ""),
						family: itemSub.replace(/\u0000/g, ""),
						view: countView,
						download: countDownload,
						total: digit(countView + countDownload).shorten()
					};

					if (isrestrict) {
						item.restrict = true;
					}
					fontData[cate].push(item);
				}
			}
		}

		this._sortBySum(cate);
		return this.write(cate);
	}

	/**
	 * Integration counter from flat to db
	 * @returns {Promise<string>}
	 */
	async _scan_integration() {
		let types = this.catalogue.indexOf(this.type);
		if (types < 0) {
			return "catalogue must be provided";
		}
		var json = await this.read(this.type);
		var directory = this.root(this.type);
		var read_dir = util.promisify(fs.readdir);
		this.read("restrict");

		const files = await read_dir(directory);

		for (let index = 0; index < files.length; index++) {
			const fileName = files[index];
			let org = json.find(e => e.file == fileName);

			let countView = 0;
			let countDownload = 0;
			var isrestrict = 0;
			if (org) {
				countView = org.view;
				countDownload = org.download;
				if (org.hasOwnProperty("restrict") && org.restrict == true) {
					isrestrict = 1;
				}
			}
			db.mysql.query(
				"INSERT INTO ?? SET file=?, types=?, view=?, download=?, restricted=? ON DUPLICATE KEY UPDATE view = view + 1;",
				[
					config.table.fonts,
					fileName,
					types,
					countView,
					countDownload,
					isrestrict
				]
			);
		}

		return "done";
	}
}
