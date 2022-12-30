const app = require("..");
const path = require("path");
const fs = require("fs");

const main = require("./orthography");
const dictionary = require("./dictionary");

const { orthography } = app.Config;

const cliTask = {};
const wordCollection = "word-collection.json";

const readText = async file =>
	await fs.promises
		.readFile(path.join(orthography.root, "corpus", file))
		.then(e =>
			e
				.toString()
				.replace(/\n/g, " ")
				.split(" ")
		)
		.catch(() => new Array());
// const writeText = async (file,raw) => await fs.promises.writeFile(path.join(orthography.root,'html',file+'.html'), raw).then(()=>true).catch(()=>false);
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

const posIndex = id => app.Config.synset.findIndex(e => e.shortname == id);
const compareWord = (a, b) => (a.w < b.w ? -1 : a.w > b.w ? 1 : 0);
const getWord = str => str.split("/");

cliTask.import_ = async corpus => {
	// var src = await readText('_partaa.txt');
	var result = await readJSON(wordCollection);
	var resultCountBefore = result.length;
	// var result = [];
	var src = await readText(corpus);
	var posOmit = ["num", "fw", "sb", "punc"];

	const checkSkip = (ord, pos) =>
		pos && ord && !posOmit.find(e => e == pos) && !result.find(e => e.w == ord);

	src.forEach(str => {
		if (/\|/.test(str)) {
			var rowSuffix = [];
			var rowIndex = -1;
			str.split("|").forEach((row, id) => {
				var [ord, pos] = getWord(row);
				if (checkSkip(ord, pos)) {
					result.push({ w: ord, p: posIndex(pos) });
				}
				if (id == 0) {
					rowIndex = result.findIndex(e => e.w == ord);
					if (!result[rowIndex].s) result[rowIndex].s = [];
				} else {
					rowSuffix.push(ord);
				}
			});
			if (rowSuffix.length) {
				var suffix = rowSuffix.join(" ");
				// result[rowIndex].s.push(rowSuffix.join(' '))
				if (!result[rowIndex].s.find(e => e == suffix)) {
					result[rowIndex].s.push(suffix);
				}
			}
		} else {
			var [ord, pos] = getWord(str);
			if (checkSkip(ord, pos)) {
				result.push({ w: ord, p: posIndex(pos) });
			}
		}
	});
	var resultCountAfter = result.length;
	await writeJSON(wordCollection, result);
	console.log("before", resultCountBefore, "after", resultCountAfter);
};

cliTask.sort_ = async () => {
	var result = await readJSON(wordCollection);
	result.sort(compareWord).map(e => {
		if (e.s) {
			return e.s.sort();
		}
	});
	// /[,!"'-]/.test('str')
	// result.forEach(row=>{
	//   row.p = posIndex(row.p)
	// })
	await writeJSON(wordCollection, result.filter(e => e.w && e.p != 13));
	console.log("done");
};

cliTask.check_sense = async () => {
	var resultNo = [];
	var resultYes = [];
	var word_collection = await readJSON(wordCollection);
	var sense = await readJSON(orthography.sense);

	word_collection.forEach(row => {
		var word = main.unicodeCorrection(row.w);
		if (sense.filter(o => o.ord == word).length) {
			resultYes.push(word);
		} else {
			resultNo.push(word);
		}
	});

	await writeJSON("_tmp.word-yes-sense.json", resultYes);
	await writeJSON("_tmp.word-no-sense.json", resultNo);
	console.log("done");
};
// cliTask.word = async (keyword) => {
//   keyword = app.Param[1];
//   var resultTotal = 0;
//   if (keyword){
//     var result = await main.word(keyword);
//     await writeJSON('_test-result-word.json',result);
//     resultTotal = result.length;
//   }
//   return 'found: $'.replace('$',resultTotal);
// }
cliTask.sense = async keyword => {
	keyword = app.Param[1];
	var resultTotal = 0;
	var resultMsg = "?";
	if (keyword) {
		var result = await main.sense(keyword);
		await writeJSON("_test-result-sense.json", result);
		resultTotal = result.length;
		resultMsg = "Match";
	} else {
		resultTotal = await main.senseCount();
		resultMsg = "Total";
	}
	return "msg: $".replace("msg", resultMsg).replace("$", resultTotal);
};
/*
cliTask.sensePos = async () => {
  // await writeJSON(orthography.sense,senseList);
  var senseList = await readJSON(orthography.sense);
  var posList =[];
  var posListWord =[];
  for (const raw of senseList) {
    for (const row of raw.def) {
      var pos = row.pos;
      if (pos < 0 && posList.indexOf(pos) == -1){
        posList.push(pos);
        posListWord.push(raw.ord);
      }
    }
  }
  await writeJSON('_tmp.pos-list.json',posList);
  await writeJSON('_tmp.pos-none-word.json',posListWord);
  return 'done'
}
*/

cliTask.term = async () => {
	var senseList = await readJSON(orthography.sense);
	var result = [];
	for (const row of senseList) {
		for (const def of row.def) {
			for (const sen of def.sen) {
				// if (sen.term == null){
				//   result.push(row.ord)
				// }
				var isTerm = sen.term.match(/([\s]+)/g);
				// || isTerm.length < 2
				if (isTerm == null) {
					result.push({ term: sen.term, ord: row.ord, pos: def.pos });
				}
			}
		}
	}
	await writeJSON("_tmp.en-term.json", result);
	// await writeJSON('_tmp.pos-none-word.json',posListWord);
	return "done";
};
cliTask.termCompare = async () => {
	var termList = await readJSON("_tmp.en-term.json");
	var result = [];
	for (const row of termList) {
		var hasde = await dictionary.definition(row.term, false);
		console.log(row.term);
		if (!hasde) {
			result.push(row);
		}
	}
	await writeJSON("_tmp.en-term-no-definition.json", result);
	// await writeJSON('_tmp.pos-none-word.json',posListWord);
	// await dictionary.definition('love',false).then(
	//   (e)=>{
	//     console.log(e)
	//   }
	// ).catch(
	//   e=>{
	//     console.log(e)
	//   }
	// );
	return "done";
};

cliTask.default = async () => "????";
cliTask.info = async () => Object.keys(cliTask);
const cliActive = name =>
	Object.keys(cliTask).find(e => e == name) || "default";

module.exports = async taskName => await cliTask[cliActive(taskName)]();

// module.exports = cli_importWord;
// module.exports = cli_sortWord;
// module.exports = cli_hasDefinition;
// module.exports = async () => 'the task require to enable manually';
/*
{
  w:'',
  p:'',
  joiner:[
    []
  ],
  suffix:[
    {
      ord:'word~',
      pos:''
    }
  ],
  prefix:[
    {
      ord:'~word',
      pos:''
    }
  ]
}
apple/n ~s/pl
love/v/n $d/v $ing/v
ရှင်သန်/v|ထွန်းကား/v|နိုင်/part|မှု/part
 {
  "w": "၊",
  "p": 13
 },
 {
  "w": "။",
  "p": 13
 },
 ဥက္ကဋ္
*/
