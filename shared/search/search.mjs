/**
 * MyOrdbok lookup: the JavaScript implementation of the reference search in
 * scripts/db_build.py. Both run the statements of search.sql in the same
 * stages and must pass search/tests.json, so the Cloudflare Worker (D1) and
 * the offline app (SQLite in the browser) give the same result as the
 * Python reference. No dependencies.
 *
 * Usage in a Worker (search.sql imported as text, e.g. a wrangler `Text`
 * rule for `**\/*.sql`):
 *
 *   import sql from "./search.sql";
 *   import { parseStatements, search, d1Database } from "./search.mjs";
 *   const statements = parseStatements(sql);
 *   const result = await search(d1Database(env.DB), statements, "went");
 *
 * @module search
 */

/** Part of speech codes of eng_form.pos. */
export const POS = { n: "noun", v: "verb", a: "adjective", r: "adverb" };

/** Form codes of eng_form.type. */
export const FORM = {
  1: "plural", 2: "third person", 3: "past", 4: "past participle", 5: "-ing",
  6: "comparative", 7: "superlative", 8: "present",
};

const MYANMAR = /[က-႟]/;

/**
 * A database the lookup can run statements on.
 * @typedef {object} Database
 * @property {(sql: string, params: Array<string|number>) => Promise<Array<Array<any>>>} all
 *   Run one statement; resolve to its rows as arrays of column values.
 */

/**
 * Split search.sql into its named statements.
 * @param {string} text Contents of search.sql.
 * @returns {Record<string, string>} Statement SQL by name.
 */
export function parseStatements(text) {
  const out = {};
  let name = null;
  let lines = [];
  for (const line of text.split("\n")) {
    const match = /^-- name: (\w+)\s*$/.exec(line);
    if (match) {
      if (name) out[name] = lines.join("\n").trim();
      name = match[1];
      lines = [];
    } else if (name && !line.startsWith("--")) {
      lines.push(line);
    }
  }
  if (name) out[name] = lines.join("\n").trim();
  return out;
}

/**
 * Database adapter for Cloudflare D1.
 * @param {any} d1 A D1 binding (env.DB).
 * @returns {Database}
 */
export function d1Database(d1) {
  return { all: (sql, params) => d1.prepare(sql).bind(...params).raw() };
}

/**
 * Database adapter for node:sqlite (DatabaseSync); also fits other
 * synchronous SQLite bindings with prepare(sql).all(...params).
 * @param {any} db An open database.
 * @returns {Database}
 */
export function sqliteDatabase(db) {
  const cache = new Map();
  return {
    all: async (sql, params) => {
      let statement = cache.get(sql);
      if (!statement) {
        statement = db.prepare(sql);
        if (typeof statement.setReturnArrays === "function") statement.setReturnArrays(true);
        cache.set(sql, statement);
      }
      const rows = statement.all(...params);
      return rows.map((row) => (Array.isArray(row) ? row : Object.values(row)));
    },
  };
}

/**
 * Normalise the query as the reference does: NFC, whitespace collapsed.
 * @param {string} query
 * @returns {string}
 */
export function normalise(query) {
  return query.normalize("NFC").split(/\s+/).filter(Boolean).join(" ");
}

/**
 * Look a word up.
 * @param {Database} db
 * @param {Record<string, string>} statements From parseStatements(search.sql).
 * @param {string} query What the user typed.
 * @returns {Promise<object>} The same structure as search() in scripts/db_build.py.
 */
export async function search(db, statements, query) {
  const text = normalise(query);
  const q = (name, ...params) => {
    const sql = statements[name];
    if (!sql) throw new Error(`search.sql has no statement ${name}`);
    return db.all(sql, params);
  };
  const js = (values) => JSON.stringify([...values]);

  if (MYANMAR.test(text)) {
    const [senses, word] = await Promise.all([q("my_entries", text), q("my_pronunciation", text)]);
    return {
      query: text, language: "my",
      pronunciation: word.length ? [word[0][0], word[0][1]] : null,
      entries: senses.map(([type, sense, example, etymology]) => ({ type, sense, example, etymology })),
    };
  }

  const own = (await q("word_ids", text)).map((r) => r[0]);
  let [entries, variantOf, formsOf] = await Promise.all([
    q("entries", js(own)), q("variant_of", text), q("forms_of", js(own)),
  ]);
  let ids = own;
  if (!entries.length && variantOf.length) {
    ids = own.concat(variantOf.map((r) => r[0]).filter((w) => !own.includes(w)));
    entries = await q("entries", js(ids));
  }
  const roots = [...new Set(formsOf.map((r) => r[0]))].sort(compareText);
  const [forms, rootRows, every, opposite, related] = await Promise.all([
    q("forms", js(ids)),
    formsOf.length ? q("root_senses", js(roots)) : Promise.resolve([]),
    q("synsets_of", js(ids)).then((rows) => rows.map((r) => r[0])),
    q("opposite", js(ids)),
    q("related", js(ids)),
  ]);
  const own_meanings = [...new Set(entries.map((r) => r[5]).filter((s) => s))].sort((a, b) => a - b);
  const meanings = own_meanings.length ? own_meanings : every;
  const wordsOf = async (synsets) =>
    synsets.length ? (await q("words_of", js(synsets), js(ids))).map((r) => r[0]) : [];
  const [similarIds, broaderIds] = await Promise.all([
    every.length ? q("similar", js(every)).then((rows) => rows.map((r) => r[0])) : Promise.resolve([]),
    every.length ? q("broader", js(every)).then((rows) => rows.map((r) => r[0])) : Promise.resolve([]),
  ]);
  const [synonyms, similar, broader] = await Promise.all([
    wordsOf(meanings), wordsOf(similarIds), wordsOf(broaderIds),
  ]);
  return {
    query: text, language: "en",
    entries: entries.map(([word, type, kind, sense, example]) => ({ word, type, kind, sense, example })),
    variant_of: variantOf.map((r) => r[1]),
    forms_of: formsOf.map(([root, pos, type]) => [root, POS[pos], FORM[type]]),
    root_senses: Object.fromEntries(rootRows.map(([word, senses]) => [word, senses])),
    forms: forms.map(([word, pos, type]) => [word, POS[pos], FORM[type]]),
    synonyms, similar, broader,
    opposite: opposite.map((r) => r[0]),
    related: related.map((r) => r[0]),
  };
}

/** Code-point order, as Python's sorted() orders strings. */
function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}
