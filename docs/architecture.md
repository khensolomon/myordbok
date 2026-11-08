# Architecture

MyOrdbok is a single-page HTML5 app (PWA) backed by a Cloudflare Worker and
D1. One codebase serves the web today and Tauri desktop and mobile later.
The dictionary data comes from a separate, private dataset.

## Layout

```
app/                  client: plain ES modules, JSDoc types, no framework
  index.html          page shell (header, footer, import map)
  main.js             start-up and router
  core/               dom helper, router, routes, store, icons, link markup
  reader/             home, definition, info pages, <mo-search>
  workspace/          studio for editors and admins (lazy, never precached)
  data/               dictionary access; offline packs plug in here
  platform/web/       browser adapters: boot, http, storage
  platform/tauri/     reserved: same exports, native implementations
  styles/             tokens, base, app
  static/             logo, icon, app icons, Noto Sans Myanmar (400, 600)
  sw.js               service worker (web build only)
worker/               Cloudflare Worker: /api routes, static assets
shared/               used by app and worker: errors, roles, validation, version, markup
  query/              reads what was typed: numbers, maths, time, questions
  search/             lookup code copied from the dataset (make dataset-sync)
assets/db/
  migrations/         app database schema (wrangler migrations)
  seed.dev.sql        sample dictionary: real tables, made-up rows
scripts/              build, dev server, version, data releases (Node stdlib only)
tests/                node:test; tests/helpers/d1.js runs D1 code on node:sqlite
```

## Decisions

- **No build step in development.** Browsers load the source modules
  directly. The production build only adds content hashes, an import map from
  original to hashed paths, modulepreload links and the precache list.
- **Platform through the import map.** App code imports `#platform/…` and
  `#shared/…`. The build maps `#platform/` to `platform/web/` or
  `platform/tauri/`; there are no runtime platform checks. A missing Tauri
  adapter stops the build, and a test compares adapter exports.
- **Deep links.** Every route is a real URL. The Worker serves `index.html`
  for any unknown app path, and the service worker does the same offline.
  Paths keep the previous site's URLs (`/definition?q=…`, `/grammar`,
  `/myanmar-fonts`) so existing links and search rankings carry over.
- **The dataset is the source of truth.** The dictionary is a set of TSV
  files in a private repository. Its build (`scripts/db_build.py`) produces
  the SQLite database the app reads, and its lookup (`search/search.mjs` and
  `search.sql`, copied to `shared/search/`) is the one the Worker runs, so
  the dataset's own search tests describe what the site answers. This
  repository holds only a made-up sample in the same tables.
- **Three databases, each with one fixed role.** `myordbok-app` holds
  everything the app writes. The dictionary is only ever imported whole:
  every build lands in `myordbok-dataset` first, where beta previews it, and
  is then promoted into `myordbok-dictionary`, which production reads. While
  a promotion imports, production reads `myordbok-dataset` (the same build),
  so readers never wait; `dict_release` records which database each site
  reads. The names say what each database is at any moment, which is why
  this was chosen over two interchangeable copies.
- **Studio edits wait in their own table.** `dict_edits` records each
  correction, addition or deletion with the value it replaces. Approved edits
  are exported as the dataset's patch files, applied there by its scripts,
  and reach readers with the next release, which marks them merged. Stale
  edits become conflicts instead of overwriting newer work.
- **Grammar is content, not dictionary data.** The Myanmar grammar
  (`assets/data/thuddar`) ships with the app: the build checks it and writes
  one JSON file per topic to `/data/grammar/` (`scripts/grammar-data.js`), the
  service worker keeps them for offline use, and the dev server serves the
  same files from the same function. It never goes to D1.
- **What was typed is read before anything is fetched.** `shared/query`
  classifies each query in the browser. Numbers (digits in either script, or
  number words in Myanmar and English) are read in words both ways; sums are
  worked out by its own parser (never `eval`), with calculator percentages
  (`10% of 70`, `70 + 10%`); the time and date come from the device clock.
  None of these reach the dictionary. A sum that reads two ways (`10 % 19`)
  asks which was meant, and one with no answer says why. A question around a
  word (`what is love`, `similar word of love`) opens the word's page with
  the question kept (`asked=`) and the part asked about as the anchor
  (`#synonyms`); `exact=1` looks up the text as typed. The Myanmar number
  reading is a rewrite of myanmar-notation with decimals, negatives, exact
  digits and the reverse direction; `tests/fixtures/numeral-my.json` holds
  the original library's readings it is tested against.
- **Nothing found is still an answer.** A word the dictionary lacks gets
  "did you mean" (`/api/spelling`: headwords one edit away, checked in one
  query), words that start the same way, and a way to ask for it. A sentence
  is shown one word at a time (`&w=`), each word fetched only when opened and
  kept for the session, the next fetched ahead unless the reader saves data.
- **Ids belong to a build, words do not.** Reactions and comments name the
  headword by spelling, so they survive any rebuild.
- **Roles are checked on the server on every write**, reading the role from
  D1: `member` reacts, comments and suggests; `editor` edits and reviews;
  `admin` also grants and removes levels. The first admin is created from the
  command line, never by the app.
- **Offline.** The service worker keeps the app shell. Dictionary data is
  downloaded on request as versioned packs and stored through the storage
  adapter (IndexedDB on the web, files or SQLite in Tauri). `/api` is never
  served from the service worker cache.
- **Fail fast.** Errors carry a stable code (`shared/errors.js`) and reach the
  screen or the log; nothing falls back silently.
- **Analytics only with consent.** Google Analytics loads on the public
  hosts after the visitor allows it (`app/core/consent.js`); the choice
  stays on the device and can be changed on the privacy page.
- **Deployment.** Beta and production are Wrangler environments bound to the
  same three databases. See [deploy.md](deploy.md).

## Next

1. Google and GitHub sign-in (OAuth with PKCE in the Worker, server-side
   sessions), the You menu, member roles.
2. Reactions, comments and suggestions; studio review queue.
3. Studio: edit and review screens over `dict_edits`.
4. Offline packs: the dataset build as a download, searched with the same
   lookup code in the browser.
5. Tauri adapters.
6. Query: Zawgyi detection, Myanmar sentences split into words.
