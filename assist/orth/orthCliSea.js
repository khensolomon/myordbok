const app = require("..");
const path = require("path");
const fs = require("fs");

const main = require("./orthography");
const axios = require("axios");
const parse5 = require("parse5");

const { orthography } = app.Config;

const cliTask = {};
const seaCorpusList = "sea-corpus-list.json";
// 1n ., n1.
const posIndex = id =>
	app.Config.synset.findIndex(
		e =>
			e.shortname ==
			id
				.replace(/\./g, "")
				.replace(/[0-9]/g, "")
				.trim()
				.split(" ")[0]
				.trim()
				.replace("exp", "phra")
	);
const compareWord = (a, b) => (a.ord < b.ord ? -1 : a.ord > b.ord ? 1 : 0);

const trimString = e =>
	e
		.replace(/(?:\\r\\n|\\r|\\n)/g, " ")
		.replace(/\s\s+/g, " ")
		.trim();

const fileHTML = file =>
	path.join(orthography.root, "sea-corpus", file + ".html");
const readHTML = async file =>
	await fs.promises
		.readFile(fileHTML(file))
		.then(e => trimString(e.toString()))
		.catch(() => "");
const writeHTML = async (file, raw) =>
	await fs.promises
		.writeFile(fileHTML(file), raw)
		.then(() => true)
		.catch(() => false);
const readJSON = async file =>
	await fs.promises
		.readFile(path.join(orthography.root, file))
		.then(JSON.parse)
		.catch(() => []);
const writeJSON = async (file, raw) =>
	await fs.promises
		.writeFile(path.join(orthography.root, file), JSON.stringify(raw, null, 1))
		.then(() => true)
		.catch(() => false);

const requestWord = async o =>
	await axios
		.get("http://sealang.net/lab/predict.pl", { params: o })
		.then(res => trimString(res.data))
		.catch(() => null);
const requestSense = async o =>
	await axios
		.get("http://sealang.net/burmese/search.pl", { params: o })
		.then(res => trimString(res.data))
		.catch(() => null);

const elBody = o =>
	o.childNodes
		.find(e => e.tagName == "html")
		.childNodes.find(e => e.tagName == "body");
const elEntry = o => o.childNodes.filter(e => e.tagName == "entry");
const elSubEntry = o => o.childNodes.filter(e => e.tagName == "subentry");
const elSense = o => o.childNodes.filter(e => e.tagName == "sense");
const elText = o => o.childNodes.find(e => e.nodeName == "#text");
const elPos = o => o.childNodes.find(e => e.tagName == "pos");
const elDef = o => o.childNodes.find(e => e.tagName == "def");
const elXR = o => o.childNodes.find(e => e.tagName == "xr");
const elEtymology = o => o.childNodes.find(e => e.tagName == "etym");
const elXPos = o => o.childNodes.find(e => e.tagName == "xpos");

function hasEntry(context) {
	if (!context) {
		return [];
	}
	var document = parse5.parse(context.replace("<xpos>2</xpos>", ""));
	var body = elBody(document);
	var entries = elEntry(body);
	if (!entries.length) {
		entries = elSubEntry(body);
	}
	return entries;
}
function serializeBody(context) {
	var document = parse5.parse(context);
	return parse5.serialize(elBody(document));
}

async function wordData(params) {
	var raw = [];
	/*
  [
    {
      ord:'',
      sub:0,
      def:0
    }
  ];
  */
	var context = await requestWord(params);
	const document = parse5.parse(context);
	elBody(document)
		.childNodes.find(e => e.tagName == "table")
		.childNodes.find(e => e.tagName == "tbody")
		.childNodes.find(e => e.tagName == "tr")
		.childNodes.forEach(o => {
			var span = o.childNodes
				.find(e => e.tagName == "big")
				.childNodes.filter(e => e.tagName == "span");
			span.forEach(e => {
				var row = {};
				row.ord = e.attrs
					.find(i => i.name == "onclick")
					.value.match(/'query=(.*)',/)[1];
				row.sub = 0;
				var small = e.childNodes.find(i => i.tagName == "small");
				if (small) {
					row.sub = parseInt(parse5.serialize(small).replace(/[^0-9]+/g, ""));
				}
				raw.push(row);
			});
		});
	return raw;
}
cliTask.word = async keyword => {
	// var wordList=[];
	// var wordList = await readJSON(seaCorpusList);
	// var tasks = await readJSON(orthography.character).then(
	//   e => e.filter(
	//     o=> o.char
	//   ).map(
	//     o=>o.item
	//   ).reduce((prev, next) => prev.concat(next),[])
	// );
	// async function hasNoWord(word){
	//   return wordList.filter(e=>e.ord == word).length == 0;
	// }
	// async function repeatAll(word,count){
	//   for (const row of await wordData({query:word})) {
	//     var wd = row.ord.replace(/\./g,'');
	//     if (row.sub > 0 && row.ord != word) {
	//       // NOTE: might be word, but has child
	//       count++;
	//       console.log(count,word);
	//       if (hasNoWord(wd)){
	//         wordList.push({ord:wd,d:0,tmp:true});
	//       }
	//       await repeatAll(row.ord,count);
	//     } else if (hasNoWord(wd)){
	//       // wordList.filter(e=>e.ord == wd).length == 0
	//       var _msg = '';
	//       if (wd == word) {
	//         // NOTE: same as word
	//         _msg = '!';
	//       } else {
	//         // NOTE: word
	//         _msg = '+';
	//       }
	//       // row.ord=wd;
	//       // wordList.push(row);
	//       wordList.push({ord:wd,d:0});
	//       console.log(_msg,row.ord);
	//     }
	//   }
	//   return true;
	// }

	// for (const w of tasks) await repeatAll(w,0);
	// await repeatAll(keyword,0);
	// await writeJSON(seaCorpusList,wordList);
	return "done";
};

async function senseData(keyword) {
	// ord:'', trl:'', otl:'', def:[]
	var raw = {
		ord: "",
		def: []
	};
	// var rawDef=[];
	var rawDef = {};
	var context = await readHTML(keyword);
	// var entries = hasEntry(context);
	var entries = hasEntry(main.unicodeCorrection(context));

	// const xpos_format = (o) => elText(elXPos(o)).value.replace(/[^a-z]/,'');
	const xpos_format = o => elText(elXPos(o)).value;
	const xdef_format = o =>
		parse5
			.serialize(o)
			.replace(/<xpos>(.*)<\/xpos>/gi, "")
			.replace(/<(\/)?lbl>/gi, "")
			.replace(/<misc[^>]*>(.+?)<\/misc>/gi, "")
			.replace(/<ref[^>]*>(.+?)<\/ref>/g, " [$1] ")
			.replace(/\s\s+/g, " ")
			.trim();
	// const etym_format = (o) => parse5.serialize(o).replace(/[\[|\]]/g,'').replace(/<lang>(.*)<\/lang>/gi,'$1:').replace(/<mention[^>]*>(.+?)<\/mention>/g,'$1;').replace(/\s\s+/g, ' ').trim();
	const etym_format = o =>
		parse5
			.serialize(o)
			.replace(/[\[|\]]/g, "")
			.replace(/<misc>(.+?)<\/misc>/gi, " ")
			.replace(/<lang>(.+?)<\/lang>/gi, "$1:")
			.replace(/<oref><\/oref>/g, "~")
			.replace(/<mention[^>]*><\/mention>/gi, "")
			.replace(/<(\/)?OREF>/gi, "")
			.replace(/<mention[^>]*>(.+?)<\/mention>/gi, "$1;")
			.replace(/\s\s+/g, " ")
			.trim();
	// const variant_format = (o) => parse5.serialize(o).replace(/[\[|\]]/g,'').replace(/<(\/)?lbl>/gi,'').replace(/<vorth[^>]*>(.+?)<\/vorth>/g,' [$1] ').replace(/\s\s+/g, ' ').trim();

	entries.forEach(entry => {
		// var id = entry.attrs.find(i=>i.name == "id").value;
		var word = entry.attrs.find(i => i.name == "orthtarget").value;
		// var translittarget = entry.attrs.find(i=>i.name == "translittarget").value;
		// var orthsplittarget = entry.attrs.find(i=>i.name == "orthsplittarget").value;
		// var rowEntry={i:id,w:word,ot:null,op:null,d:[]};
		// var rowEntry={w:word,ot:null,op:null,d:[]};
		if (word && !raw.ord) raw.ord = word;

		// var _translittarget = entry.attrs.find(i=>i.name == "translittarget");
		// if (_translittarget && !raw.trl) raw.trl = _translittarget.value;

		// var _orthsplittarget = entry.attrs.find(i=>i.name == "orthsplittarget");
		// if (_orthsplittarget && !raw.otl) raw.otl = _orthsplittarget.value;

		var _etym = elEtymology(entry);
		var rowEtym = _etym ? etym_format(_etym) : "";

		var senses = elSense(entry);

		if (!senses.length) {
			senses = [entry];
		}

		senses.forEach(sense => {
			// var pos:string definition:
			var pos = null;
			var _pos = elPos(sense);
			if (_pos) {
				pos = posIndex(elText(_pos).value);
				if (!rawDef[pos]) {
					rawDef[pos] = { pos: pos, sen: [] };
				}
			}

			var _senXR = elXR(sense);
			var rawDef_xr = "";
			if (_senXR) {
				rawDef_xr = trimString(xdef_format(_senXR).replace(/\./, ""));
			}
			// var def = elDef(sense);
			// console.log(sense)
			var defNodes = sense.childNodes.filter(e => e.tagName == "def");
			// console.log(parse5.serialize(abc));
			if (defNodes.length) {
				defNodes.forEach(def => {
					var _defXR = elXR(def);
					if (_defXR) {
						if (elXPos(_defXR) && !rawDef[pos]) {
							pos = posIndex(xpos_format(_defXR));
							rawDef[pos] = { pos: pos, sen: [] };
						}
						var item = {};
						var itemText = xdef_format(_defXR);
						var itemValue = elText(def);
						if (itemValue && itemValue.value) {
							// var itemText = trimString(itemValue.value.replace(/\./,''));
							// rawDef[pos].sen.push({term:itemText,usage:itemTest,tmp:true});
							var tmpTerm = trimString(itemValue.value.replace(/\./, ""));
							if (tmpTerm) {
								item.term = tmpTerm;
								item.usage = itemText;
							} else {
								item.term = itemText;
							}
						} else {
							// rawDef[pos].sen.push({term:itemTest,tmp:true});
							item.term = itemText;
						}

						// if (usage) {
						//   if (!item.term){
						//     item.term = trimString(usage[0].replace(/<misc>(.+?)<\/misc>/gi,'/').replace(/(\(|\))/g,''));
						//     item.noterm = true;
						//   } else {
						//     item.usage = trimString(usage[0].replace(/<misc>(.+?)<\/misc>/gi,'/').replace(/(\(|\))/g,''));
						//   }
						// }

						rawDef[pos].sen.push(item);
						// console.log('something going on here');

						// if (elXPos(_defXR) && !rowSense.t) {
						//   rowSense.t = xpos_format(_defXR);
						// }
						// rowSense.v = xdef_format(_defXR);
					} else {
						var explRegex = /\((see|as|same|in|usually)([^)]+)\)/g;
						var variRegex = /<variant[^>]*>(.+?)<\/variant>/g;

						var definition = parse5
							.serialize(def)
							.replace(/<oref><\/oref>/g, "~")
							.replace(/<(\/)?OREF>/gi, "")
							.replace(/<eg[^>]*><\/eg>/g, "")
							.replace(/<eg[^>]*>(.+?)<\/eg>/g, " [$1] ")
							.replace(
								/<xlangmat lang="(.+?)"[^>]*>(.+?)<\/xlangmat>/g,
								"(see [$1]: [$2])"
							)
							.replace(/<xlangmat[^>]*><\/xlangmat>/g, "")
							.replace(/<xlangmat[^>]*>(.+?)<\/xlangmat>/g, "[$1]")
							.replace(/(-|။|၊)+\]/g, "]");
						// console.log(definition)

						var variant = definition.match(variRegex);
						/*
            {
              term:'', usage:'', etym:''
            }
            */

						definition
							.replace(variRegex, "")
							.split(";")
							.filter(e => e.trim())
							.forEach(dum => {
								var item = { term: "" }; //usage, etym, variant
								var usage = dum.match(explRegex);

								// Alexandrian laurel
								item.term = trimString(
									dum
										.replace(explRegex, "")
										.replace(/\(.\)/, "")
										.replace(/\./g, "")
								);
								if (rawDef_xr) {
									if (item.term) {
										item.xr = rawDef_xr;
									} else {
										item.term = rawDef_xr;
									}
								}
								if (usage) {
									if (!item.term) {
										item.term = trimString(
											usage[0]
												.replace(/<misc>(.+?)<\/misc>/gi, "/")
												.replace(/(\(|\))/g, "")
										);
									} else {
										item.usage = trimString(
											usage[0]
												.replace(/<misc>(.+?)<\/misc>/gi, "/")
												.replace(/(\(|\))/g, "")
										);
									}
								}
								if (variant) {
									item.vari = trimString(
										variant[0]
											.replace(variRegex, "$1")
											.replace(/<(\/)?lbl>/gi, "")
											.replace(/<vorth[^>]*>(.+?)<\/vorth>/g, " [$1] ")
											.replace(/<vreg[^>]*>(.+?)<\/vreg>/g, " $1 ")
									);
								}
								if (rowEtym) {
									item.etym = rowEtym;
								}
								if (item.term) {
									rawDef[pos].sen.push(item);
								}
								variant = "";
								rowEtym = "";
							});
					}
				});
			} else {
				if (rawDef_xr) {
					pos = posIndex(xpos_format(_senXR));
					if (!rawDef[pos]) {
						rawDef[pos] = { pos: pos, sen: [] };
					}
					rawDef[pos].sen.push({ term: rawDef_xr, tmp: true });
				}
			}
			/*
      var def = elDef(sense);
      if (def) {
        var _defXR = elXR(def);
        if (_defXR){
          if (elXPos(_defXR) && !rawDef[pos]) {
            pos = posIndex(xpos_format(_defXR));
            rawDef[pos]={pos:pos,sen:[]};
          }
          var item = {};
          var itemText = xdef_format(_defXR);
          var itemValue = elText(def);
          if (itemValue && itemValue.value) {
            // var itemText = trimString(itemValue.value.replace(/\./,''));
            // rawDef[pos].sen.push({term:itemText,usage:itemTest,tmp:true});
            item.term = trimString(itemValue.value.replace(/\./,''));
            item.usage = itemText;
          } else {
            // rawDef[pos].sen.push({term:itemTest,tmp:true});
            item.term = itemText;
          }
          rawDef[pos].sen.push(item);
          // console.log('something going on here');

          // if (elXPos(_defXR) && !rowSense.t) {
          //   rowSense.t = xpos_format(_defXR);
          // }
          // rowSense.v = xdef_format(_defXR);
        } else {
          var explRegex = /\((see|as|same|in|usually)([^)]+)\)/g;
          var variRegex = /<variant[^>]*>(.+?)<\/variant>/g;

          var definition = parse5.serialize(def)
            .replace(/<oref><\/oref>/g,'~')
            .replace(/<(\/)?OREF>/gi,'')
            .replace(/<eg[^>]*><\/eg>/g,'')
            .replace(/<eg[^>]*>(.+?)<\/eg>/g,' [$1] ')
            .replace(/<xlangmat lang="(.+?)"[^>]*>(.+?)<\/xlangmat>/g,'(see [$1]: [$2])')
            .replace(/<xlangmat[^>]*><\/xlangmat>/g,'')
            .replace(/<xlangmat[^>]*>(.+?)<\/xlangmat>/g,'[$1]')
            .replace(/(-|။|၊)+\]/g,"]");
            // console.log(definition)

          var variant = definition.match(variRegex);


          definition.replace(variRegex,'').split(';').filter(e=>e).forEach(dum=>{
            var item={term:''}; //usage, etym, variant
            var usage=dum.match(explRegex);
            if (usage) {
              item.usage = trimString(usage[0].replace(/<misc>(.+?)<\/misc>/gi,'/').replace(/(\(|\))/g,''));
            }
            // Alexandrian laurel
            item.term=trimString(dum.replace(explRegex,'').replace(/\(.\)/,'').replace(/\./g,''));
            if (rawDef_xr) {
              if (item.term){
                item.xr = rawDef_xr;
              } else {
                item.term = rawDef_xr;
              }
            }
            if (variant){
              item.vari = trimString(variant[0].replace(variRegex,'$1').replace(/<(\/)?lbl>/gi,'').replace(/<vorth[^>]*>(.+?)<\/vorth>/g,' [$1] ').replace(/<vreg[^>]*>(.+?)<\/vreg>/g,' $1 '));
            }
            if (rowEtym) {
              item.etym = rowEtym;
            }
            rawDef[pos].sen.push(item);
            variant='';
            rowEtym='';
          });
        }
      } else {
        if (rawDef_xr) {
          pos = posIndex(xpos_format(_senXR));
          if (!rawDef[pos]) {
            rawDef[pos]={pos:pos,sen:[]};
          }
          rawDef[pos].sen.push({term:rawDef_xr,tmp:true});
        }
      }
      */
		});
	});
	raw.def = Object.values(rawDef);
	if (raw.def.length) {
		return [raw];
	}
	return [];
}
cliTask.sense = async keyword => {
	keyword = app.Param[1];
	if (keyword) {
		var result = await senseData(keyword);
		await writeJSON("_test-result-sense.json", result);
		return "done test result sense";
	}
	var wordList = await readJSON(seaCorpusList);
	var senseList = [];
	var wordNoSense = [];
	var wordTotal = wordList.length;
	for (const [id, row] of wordList.entries()) {
		var raw = await senseData(row.ord);
		if (raw.length) {
			row.d = raw.map(e => e.def.length).reduce((a, b) => a + b, 0);
			senseList = senseList.concat(raw);
			console.log("+", wordTotal - id, row.ord, row.d);
		} else {
			console.log("-", wordTotal - id, row.ord);
			wordNoSense.push(row.ord);
		}
	}
	await writeJSON("_tmp.word-no-entry.json", wordNoSense);
	await writeJSON(orthography.sense, senseList);
	// await writeJSON(seaCorpusList,wordList);
	// console.log(abc)
	// var wordList = await senseData(keyword);
	// await writeJSON('_sense-test.json',wordList);
	return "done";
};

cliTask.save = async keyword => {
	var params = { dict: "burmese", orth: "" };
	var tasks = await readJSON(seaCorpusList);
	var totalTask = tasks.length;
	for (const [id, row] of tasks.entries()) {
		var cliActive = totalTask - id;
		var msgTask = "?";
		var file = fileHTML(row.ord);
		params.orth = row.ord;
		if (!fs.existsSync(file)) {
			var context = await requestSense(params);
			var entries = hasEntry(context);
			if (entries.length) {
				msgTask = "add";
				await writeHTML(row.ord, serializeBody(context));
			} else {
				msgTask = "no entry";
			}
		} else {
			var context = await readHTML(row.ord);
			var entries = hasEntry(context);
			if (entries.length) {
				msgTask = "Ok";
			} else {
				context = await requestSense(params);
				entries = hasEntry(context);
				if (entries.length) {
					msgTask = "update";
					await writeHTML(row.ord, serializeBody(context));
				} else {
					fs.unlinkSync(file);
					msgTask = "no entry, deleted";
				}
			}
		}
		console.log(msgTask, cliActive, row.ord);
	}
	// params.orth = keyword;
	// var context = await requestSense(params);
	// if (context){
	//   var document = parse5.parse(context);
	//   var body = parse5.serialize(elBody(document));
	//   await writeHTML(keyword,body);
	//   console.log('save')
	// }
	return "done";
};

cliTask.work = async keyword => {
	return "done";
};

cliTask.default = async () =>
	"We believed this task is completed, but it is only remaining as a reference!";
cliTask.info = async () => Object.keys(cliTask);
const cliActive = name =>
	Object.keys(cliTask).find(e => e == name) || "default";

module.exports = async taskName => await cliTask[cliActive(taskName)]();
