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
  workspace/          workspace for editors and admins (lazy, never precached)
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
- **Workspace edits wait in their own table.** `dict_edits` records each
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
  the original library's readings it is tested against. A phrase that is not
  an entry (`king of Denmark`) is read from its words' entries
  (`/api/phrase`). Which of entry, phrase, sentence or nothing a query is
  comes from one request, `/api/read`; Myanmar text, written without spaces,
  is split into the dictionary's headwords. The full map is in
  [query.md](query.md).
- **The API serves the app only.** On beta and production the Worker
  refuses requests that are not from its own pages (`Sec-Fetch-Site`),
  limits each visitor per minute, and answers repeated lookups from the edge
  cache (`worker/lib/guard.js`; docs/deploy.md, The API).
- **Sign-in is Google or GitHub, one member per person.** The Worker runs
  the OAuth code flow with PKCE; members are recognised by the provider
  account or, when the provider has verified it, the email, so likes and
  suggestions stay with one person whichever provider is used. Sessions are
  random tokens kept only as hashes (docs/deploy.md, Sign-in).
- **Members contribute on the entry itself, at two levels.** Each sense has
  its own thumbs up and down and ✎, which opens an editor for that sense
  alone under its row; the side card rates the entry as a whole and adds a
  missing meaning (`/api/reactions`, `/api/senses`, `/api/edits`;
  `worker/routes/contribute.js`). Sense ids come with every lookup (the
  dataset's `search()` returns them) and outlive rebuilds; a sense's thumbs
  count only for the meaning they were given for (`sense_reactions.text_hash`),
  so a corrected meaning starts afresh. The value a change replaces is read
  by the Worker from the dictionary, not taken from the browser. A member's
  suggestion waits for an editor; an editor's own is approved and reaches
  readers with the next dictionary release. Every write needs a session and
  an Origin header from the site.
- **The workspace (`/workspace`) is one place for every member, laid out
  like a studio**: a rail of sections, a list, the work area, an inspector
  and a status bar; on phones the rail becomes a bottom bar and the list and
  the item take turns. The rail follows the role: members see Overview,
  Contributions and Account; editors and admins also Suggestions. Overview
  is the home: a member's own figures, or for editors and admins searches
  per day, the words searched most and searched but missing, suggestions,
  members and the meanings rated down most (`/api/workspace/overview`).
  Account is also where signing in happens (`/account` and every sign-in
  link lead there, `?return=` going back afterwards) and where a member
  deletes the account: waiting suggestions, ratings, comments and sign-ins
  go; reviewed suggestions stay under user 0, "Former member".
  A suggestion opens as a
  diff inside its entry as it is now; editors approve or decline (A, D; J and
  K move through the list), authors withdraw while it waits
  (`/api/workspace/*`; `worker/routes/workspace.js`). Its code loads only
  when opened.
- **The interface speaks English or Myanmar** (`app/i18n/`). Interface
  text is written in English inside `t()`, and `my.js` gives the Myanmar
  for each; a text with no Myanmar is an error, and `tests/i18n.test.js`
  checks every `t()` against `my.js` (missing, unused, placeholders). The
  device's language decides until the header's language button is used
  (`mo:lang`); `<html lang>` is set before the first paint and the page
  reloads on a change. In Myanmar, numbers and dates use Myanmar digits and
  parts of speech their Myanmar names. Dictionary content is never
  translated. About, Privacy and Terms stay in English for now, with a
  notice; server messages are translated by error code for the generic ones.
- **Dictionary statistics are counted where the build is made.** Counting
  the dictionary in D1 on each workspace visit would read every row; instead
  `scripts/stats.js` counts the build file once (`make data-publish`, or
  `make data-stats`) and keeps one row per build in `build_stats`. The
  Overview reads it, with the build before for the change; the part every
  member sees is kept at the edge for ten minutes.
- **Offline packs come from the release, not from D1.** `make data-packs`
  (`scripts/packs.js`) runs the same lookup as the Worker over a build, word by
  word, and writes gzip files to R2 under the build (`myordbok-packs/<build>/`):
  word lists (everyone), English and Myanmar senses, English related words
  (members, or everyone by the admin setting `offline.access`). The app keeps
  them in IndexedDB (`app/data/offline.js`): word lists by themselves once a
  day at most, the rest chosen on `/offline`. Offline, one word's answer and
  the search box's suggestions come from the device, marked as such on the
  page; phrases, sentences, ratings and suggestions still need the network.
  Downloads cost R2 reads and one Worker request per file, never D1 rows.
- **Contact goes through the site, not email.** MyOrdbok has no address of
  its own: `/contact` sends feedback, questions, problems and words to add to
  the `messages` table (`POST /api/messages`), read by admins in the
  workspace's Inbox, where a sender's address (if left) opens a reply in the
  admin's own mail. Spam: a field people never see drops the message when
  filled, plus the same-origin rule and the stricter rate limit.
- **Searches are counted, not logged.** Each search page (`/api/read`)
  adds one to `search_counts` (day, language, word, found), after the answer
  is sent and including answers from the edge cache
  (`worker/lib/counts.js`). No identity, no time of day; terms over 60
  characters, typing suggestions, numbers and sums are not counted.
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
2. Reactions, comments and suggestions; workspace review queue.
3. Workspace: edit and review screens over `dict_edits`.
4. Offline packs: the dataset build as a download, searched with the same
   lookup code in the browser.
5. Tauri adapters.
6. Query: Zawgyi detection, multi-word headwords inside sentences.
