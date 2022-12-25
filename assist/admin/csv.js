import {db,load,seek} from 'lethil';
import path from 'path';
import {config,  glossary} from '../anchor/index.js';
import * as csv from 'csv';

const {dictionaries, table} = config.setting;

const outputDirectory = '/dev/lidea/assets/tmp/';

/**
 * Word -> wordListUnique, wordMapDerive
 * Sense -> senseList
 * Thesaurus -> thesaurusList
 * @param {any} req
 * SQLite testing
 */
export async function main(req){
  await wordListUnique(req);
  await wordMapDerive(req);
  await senseList(req);
  await thesaurusList(req);
  return 'done';
}

/**
 * export word CSV -> list
 * @param {any} req
 * returns {Promise<String>} Promise array
 */
export async function wordListUnique(req){
  const fileName = '-delete-word-list-unique.csv';
  const writeStream = seek.writeStream(path.join(outputDirectory,fileName));
  const stringifier = csv.stringify({
    header: true,
    columns: ["id", "word", "derived"],
    quoted: true,
    escape:'"'
  });
  listOfWord().then((raw)=>{
    raw.forEach((v) => stringifier.write(v));
  }).finally(()=>{
    console.log('word-list.unique:', fileName);
  });
  // [
  //   {id:'1',word:'a/b',sense:'3',exam:'4',wseq:'5'},
  //   {id:'2',word:'c,d',sense:'2',exam:'3',wseq:'4'},
  //   {id:'30',word:'c\\d',sense:'2',exam:'3',wseq:'4'},
  //   {wseq:'30',word:'c"a"',sense:'2',exam:'3',id:'410'},
  // ].forEach((v) => stringifier.write(v));
  // stringifier.pipe(writeStream);
  stringifier.pipe(writeStream);
  return 'done';
}

/**
 * export derive CSV -> map
 * @param {any} req
 */
export async function wordMapDerive(req){
  const fileName = '-delete-word-map-derive.csv';
  const writeStream = seek.writeStream(path.join(outputDirectory,fileName));
  const stringifier = csv.stringify({
    header: true,
    columns: ["id", "dete", "wrid", "wrig", "wrig"],
    quoted: true,
    escape:'"'
  });
  listOfDerive().then((raw)=>{
    raw.forEach((v) => stringifier.write(v));
  }).finally(()=>{
    console.log('word-map.derive:', fileName);
  });
  stringifier.pipe(writeStream);
  return 'done';
}

/**
 * export sense CSV -> list
 * @param {any} req
 */
export async function senseList(req){
  const fileName = '-delete-sense-list-all.csv';
  const writeStream = seek.writeStream(path.join(outputDirectory,fileName));
  const stringifier = csv.stringify({
    header: true,
    columns: ["id", "word", "sense", "exam", "wseq"],
    quoted: true,
    escape:'"'
  });
  listOfSense().then((raw)=>{
    raw.forEach((v) => stringifier.write(v));
  }).finally(()=>{
    console.log('sense-list.all:', fileName);
  });
  stringifier.pipe(writeStream);
  return 'done';
}

/**
 * export thesaurus CSV -> list
 * @param {any} req
 */
export async function thesaurusList(req){
  const fileName = '-delete-thesaurus-list-all.csv';
  const writeStream = seek.writeStream(path.join(outputDirectory,fileName));
  const stringifier = csv.stringify({
    header: true,
    columns: ["wrid", "wlid"],
    quoted: true,
    escape:'"'
  });
  listOfThesaurus().then((raw)=>{
    raw.forEach((v) => stringifier.write(v));
  }).finally(()=>{
    console.log('thesaurus-list.all:', fileName);
  });
  stringifier.pipe(writeStream);
  return 'done';
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
    "SELECT id, word, derived FROM ??;",
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