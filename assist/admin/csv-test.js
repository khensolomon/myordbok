const app = require('..');
const {glossary,dictionaries} = app.Config;

const fs = require('fs');
// const util = require('util');
// const path = require('path');

// const {utility} = app.Common;

/*
TODO
1. check line
2. parse
3. Grammar
4. Exist
*/

const {table,docket,makeup,fileName,chat,language} = require("./dictionary.Config");
const partOfSpeech = require("./dictionary.pos");
const dictionary = require("./dictionary");

exports.testing = async function(param){
  const data = fs.readFileSync('./test/FSIN_English_Myanmar_Dictionary.csv', 'UTF-8');
  const dataLines = data.split(/\r?\n/);
  const raw=[];
  for (let index = 0; index < dataLines.length; index++) {
    var row = {};
    var line = dataLines[index];
    var val = line.match(/("[^"]*")|[^,]+/g);
    // var val = line.split(',');
    row.word = val[0].replace(/"/g,"").trim();
    row.tid = '????';
    row.sense = val[1].trim();
    row.exam = '';
    row.seq = 0;
    row.kid = 31;

    // var test = await hasDefinition(row.word);
    var hasWordAlready = await sqlFindWord(row.word);

    if (hasWordAlready.length){
      console.log('--exist-',row.word);
    } else {
      // row.tid = await hasPos(row.word);
      // row.id = await sqlGetNullId();
      // if (row.id > 0){
      //   await sqlUpdate(row);
      //   console.log('--update-',row.id,row.word);
      // } else {
      //   await sqlInsert(row);
      //   console.log('--insert-',row.word);
      // }
      console.log('--todo-',row.word);
    }
  }

};

// const hasDefinition = async function(keyword){
//   var test = await dictionary.wordFind(keyword);
//   return test;
// }

const hasPos = async function(keyword){
  var wordPos = await partOfSpeech.admin_pos(keyword);
  var wordBase = await partOfSpeech.admin_base(keyword);
  if (wordPos.pos.length){
    return wordPos.pos[0].t;
  } else if (wordBase.pos.length) {
    return wordBase.pos[0].t;
  } else if (keyword == keyword.toUpperCase()) {
    // NOTE: probably Abbreviation
    return 8;
  } else if (/\s/g.test(keyword)) {
    // NOTE: probably Phrase
    return 11;
  } else {
    console.log(keyword,'pos?');
    return 0;
  }
  // return wordPos;
}

const sqlFindWord = async function(word){
  return await app.sql.query("SELECT word AS term, tid AS pos, sense AS v,exam FROM ?? WHERE LOWER(word) LIKE LOWER(?) ORDER BY tid, seq;",[table.senses,word]);
}

const sqlInsert = async function(val){
  await app.sql.query('INSERT INTO ?? (word, tid, sense, exam, seq, kid) VALUES (?,?,?,?,?,?);',[
    'senses_test',val.word,val.tid,val.sense,val.exam,val.seq, val.kid
  ]).catch(
    e=>console.error(e.message)
  );
}

const sqlUpdate = async function(val){
  // table.senses,row.word
  await app.sql.query('UPDATE ?? SET word=?, tid=?, sense=?, exam=?, seq=?, kid=? WHERE `id`=?;',[
    'senses_test',val.word,val.tid,val.sense,val.exam,val.seq, val.kid,val.id
  ]).catch(
    e=>console.error(e.message)
  );
}
const sqlGetNullId = async function(){
  // table.senses,row.word
  var raw = await app.sql.query('SELECT id FROM ?? WHERE sense IS NULL LIMIT 1;',['senses_test']).catch(
    e=>console.error(e.message)
  );
  if (raw.length) {
    return raw[0].id;
  }
  return 0;
}