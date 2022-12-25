import {db,load} from 'lethil';
import {config, json, glossary} from '../anchor/index.js';
import sqliteDatabase from 'sqlite3';

const {dictionaries, table} = config.setting;

/**
 * export word [synmap]
 * @param {any} req
 * SQLite testing
 */
export async function main(req){
  // config.setting.glossary.sqlite = '/dev/lidea/assets/tmp/node-word.db';
  // const sqlite = new sqliteDatabase.Database(config.setting.glossary.sqlite);
  // db.serialize(() => {
  //   // db.run("CREATE TABLE lorem (info TEXT)");
  //   db.run("CREATE TABLE IF NOT EXISTS 'list' ('id' INTEGER, 'word' TEXT, 'derived' INTEGER)");
  //   db.run("CREATE TABLE IF NOT EXISTS 'map' ('wrid'  INTEGER, 'wrte'  INTEGER, 'dete'  INTEGER, 'wrig'  INTEGER)");

  //   const stmt = db.prepare("INSERT INTO lorem VALUES (?)");
  //   for (let i = 0; i < 10; i++) {
  //       stmt.run("Ipsum " + i);
  //   }
  //   stmt.finalize();

  //   db.each("SELECT rowid AS id, info FROM lorem", (err, row) => {
  //       console.log(row.id + ": " + row.info);
  //   });
  // });

  // db.close();
 await createWord();
  return 'Yes '+ config.setting.glossary.sqlite;
  // return 'Yes '+ config.setting.glossary.synmap;
}
/**
 * Word list -> list
 * param {sqliteDatabase.Database} sqlite
 * @returns {Promise<String>} Promise array
 */
async function createWord(){
  var start = Date.now();
  const sqlite = new sqliteDatabase.Database('/dev/lidea/assets/tmp/node-word.db');
  sqlite.serialize(() => {
    sqlite.run("BEGIN");
    sqlite.run("DROP TABLE IF EXISTS 'list'");
    sqlite.run("CREATE TABLE 'list' ('id' INTEGER, 'word' TEXT, 'derived' INTEGER)");
    // sqlite.run("CREATE TABLE IF NOT EXISTS 'list' ('id' INTEGER, 'word' TEXT, 'derived' INTEGER)");
    // sqlite.run("CREATE TABLE IF NOT EXISTS 'map' ('id' INTEGER, 'dete' INTEGER, 'wrid' INTEGER, 'wrig' INTEGER, 'wrte' INTEGER)");
    // sqlite.run("DELETE FROM list;");
    // sqlite.run("DELETE FROM map;");



    listOfWord().then((listWord)=>{
      // const list = sqlite.prepare("INSERT INTO list VALUES (?,?,?)");
      var i = 0, len = listWord.length;
      while (i < len) {
        // list.run(listWord[i].id, listWord[i].word, listWord[i].derived);
        sqlite.run("INSERT INTO list VALUES (?,?,?)", listWord[i].id, listWord[i].word, listWord[i].derived);
        // console.log(listWord[i].id);
        i++
      }
      // list.finalize();

      // list.on('end',function(){
      //   console.log('list finish');
      // });
    });

  });
  sqlite.run("commit", function(err){
    console.log('sqlite commit', err);
  });
  sqlite.on('end',function(err){
    console.log('sqlite end',err);
  });

  // const listWord = await listOfWord();
  // const list = sqlite.prepare("INSERT INTO list VALUES (?,?,?)");
  // var i = 0, len = listWord.length;
  // while (i < len) {
  //   list.run(listWord[i].id, listWord[i].word, listWord[i].derived);
  //   console.log(listWord[i].id);
  //   i++
  // }
  // list.finalize((err)=>{
  //   if (err == null){
  //     console.log('word','done');
  //   } else {
  //     console.log('word',err);
  //   }
  // });

  // const mapDerive = await listOfDerive();
  // const map = sqlite.prepare("INSERT INTO map VALUES (?,?,?,?,?)");
  // var i = 0, len = mapDerive.length;
  // while (i < len) {
  //   map.run(mapDerive[i].id, mapDerive[i].dete, mapDerive[i].wrid, mapDerive[i].wrig, mapDerive[i].wrte);
  //   i++
  // }
  // map.finalize();
  // sqlite.close(function() {
  //   // sqlite3 has now fully committed the changes
  //   console.log((Date.now() - start) + "ms");
  // });

  return 'done: word';
}

/**
 * Word list -> list
 * @typedef {Object} listOfWord
 * @property {number} id
 * @property {string} word
 * @property {number} derived
 *
 * @returns {Promise<Array.<listOfWord>>} Promise array
 */
async function listOfWord(){
  return db.mysql.query(
    "SELECT id, word, derived FROM ?? LIMIT 5000;",
    [table.synset]
  );
}

/**
 * Derive list -> map
 * @typedef {Object} listOfDerive
 * @property {number} id
 * @property {number} dete
 * property {string} word
 * @property {number} wrid
 * @property {number} wrig
 * @property {number} wrte
 *
 * @returns {Promise<Array.<listOfDerive>>} Promise array
 */
async function listOfDerive(){
  return db.mysql.query(
    "SELECT id, dete, wrid, wrig, wrte FROM ?? ORDER BY wrid, wrte ASC;",
    [table.synmap]
  );
}

/**
 * Sense list -> list
 * @typedef {Object} listOfSense
 * @property {number} id
 * @property {string} word
 * @property {string} sense
 * @property {string} exam
 * @property {number} wseq
 *
 * @returns {Promise<Array.<listOfSense>>} Promise array
 */
async function listOfSense(){
  return db.mysql.query(
    "SELECT id, word, sense, exam, wseq FROM ?? WHERE word IS NOT NULL AND sense IS NOT NULL ORDER BY word, wseq ASC;",
    [table.senses]
  );
}

/**
 * thesaurus list -> list
 * @typedef {Object} listOfThesaurus
 * @property {number} wrid
 * @property {number} wlid
 *
 * @returns {Promise<Array.<listOfThesaurus>>} Promise array
 */
async function listOfThesaurus(){
  return db.mysql.query(
    "SELECT wrid, wlid FROM ??;",
    [table.thesaurus]
  );
}