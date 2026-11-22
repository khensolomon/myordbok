# Architecture

MyOrdbok is a single-page HTML5 app (PWA) backed by a Cloudflare Worker and
D1. One codebase serves the web and the MyOrdbok app for iOS and Android
(Tauri).
The dictionary data comes from a separate, private dataset.

## Layout

```
app/                  client: plain ES modules, JSDoc types, no framework
  index.html          page shell (header, footer, import map)
  main.js             start-up and router
  core/               dom helper, router, routes, store, icons, link markup
  reader/             home, definition, Test yourself and practice, info pages, <mo-search>
  workspace/          workspace for every member (lazy, never precached)
  data/               dictionary access; offline packs plug in here
  platform/web/       browser adapters: boot, http
  platform/tauri/     app adapters: same exports, through the Tauri plugins
  styles/             tokens, base, app
  static/             logo, icon, app icons, Noto Sans Myanmar (400, 600)
  sw.js               service worker (web build only)
src-tauri/            the app (Tauri 2): Rust start-up, config, permissions, icon source
worker/               Cloudflare Worker: /api routes, static assets
backup/               Worker myordbok-backup: weekly backup of myordbok-app to R2 (deployed by hand)
shared/               used by app and worker: errors, roles, validation, version, markup, quiz, Myanmar spelling slips
  query/              reads what was typed: numbers, maths, time, questions
  zawgyi/             Google's Zawgyi detector and converter (Apache 2.0, its own LICENSE)
  search/             lookup code copied from the dataset (make dataset-sync)
assets/db/
  migrations/         app database schema (wrangler migrations)
  seed.dev.sql        sample dictionary: real tables, made-up rows
scripts/              build, dev server, version, data releases, backups and restore (Node stdlib; esbuild to minify)
tests/                node:test; tests/helpers/d1.js runs D1 code on node:sqlite
```

## Decisions

- **No build step in development.** Browsers load the source modules
  directly. The build minifies each file, adds content hashes, an import map
  from original to hashed paths, modulepreload links and the precache list.
- **Live edits over the build.** The dictionary tables are only ever
  written by a data release. An edit an admin or owner approved is laid
  over the build as an entry is read (`shared/layer.js`,
  `worker/lib/layer.js`), held per isolate for 30 seconds so a lookup
  costs no extra query, until a release carries it into the dataset.
- **Minified, one file at a time.** Comments, spaces and local names go
  (esbuild, a build-time tool only; the one exception to Node's standard
  library in `scripts/`). Each file stays its own module, so hashing, the
  import map and page-by-page loading are unchanged; it saves about 30% of
  what readers download. Each file has a source map beside it that carries
  the code as written, never precached. `--no-minify` builds the files as
  written, for debugging.
- **Platform through the import map.** App code imports `#platform/…` and
  `#shared/…`. The build maps `#platform/` to `platform/web/` or
  `platform/tauri/`; there are no runtime platform checks. A missing Tauri
  adapter stops the build, and a test compares adapter exports.
- **Deep links.** Every route is a real URL. The Worker serves `index.html`
  for any unknown app path, and the service worker does the same offline.
  A missing file (a path with an extension other than `.html`) is a 404,
  never the page: a script import or the service worker would take the page
  for the file.
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
  every build lands in `myordbok-beta` first, where beta previews it, and
  is then promoted into `myordbok-live`, which live reads. While
  a promotion imports, live reads `myordbok-beta` (the same build),
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
- **An answer reads like an entry.** Numbers, sums, shares and the time are
  laid out on the same timeline as a definition (`app/reader/answer.js`): the
  answer is the headword, and each section is named for what it answers
  (number, sum, shares, time, date) where an entry names its part of speech.
  Each line has a copy button. The side card goes below the answer at every
  width, since there is nothing to rate or suggest; an entry keeps it in the
  right column on wide screens.
- **Forms and related words sit on the entry's timeline.** Forms are shown
  inside the part of speech they belong to (the noun's forms under the noun,
  the verb's under the verb); forms of a part of speech the entry has no
  meanings for get a section of their own. Synonyms, opposites and other
  related words close the timeline as one more section (`#synonyms`,
  `#opposite` stay as anchors).
- **No word, a guide.** `/definition` with no word shows how to search, with
  examples of each kind of query that open when tapped, and the dictionary
  in figures from the statistics already kept per build (`/api/stats`, read
  from `build_stats`, kept at the edge for an hour); the home page's logo
  leads there.
- **The home page shows recent and popular searches.** Recent searches stay
  on the device (`mo:recent`, `app/data/recent.js`, twelve at most, cleared
  there). "Searched most this week" is `/api/popular`: found words searched
  at least three times in the last seven days, from `search_counts` only,
  kept at the edge for an hour; rarer words never show, so one person's
  searches cannot appear.
- **The API serves the app only.** On beta and live the Worker
  refuses requests that are not from its own pages (`Sec-Fetch-Site`),
  limits each visitor per minute, and answers repeated lookups from the edge
  cache (`worker/lib/guard.js`; docs/deploy.md, The API).
- **Sign-in is Google, GitHub or Apple, one member per person.** The Worker
  runs the OAuth code flow (PKCE for Google and GitHub); members are
  recognised by the provider account or, when the provider has verified it,
  the email, so likes and suggestions stay with one person whichever
  provider is used. Sessions are random tokens kept only as hashes
  (docs/deploy.md, Sign-in). Apple sits apart (`worker/lib/apple.js`) and
  behind its own setting, down to existing accounts only and then off, so
  it can be removed without locking anyone out.
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
- **The app signs in through the website** (`/link`, `worker/routes/link.js`):
  it shows a code, the member approves it on myordbok.com, and the app is
  given a session of its own, sent as a bearer token instead of the cookie;
  the Account page lists linked devices.
- **The workspace (`/workspace`) is one place for every member, laid out
  like a studio**: a rail of sections, a list, the work area and an
  inspector; on phones the rail becomes a bar at the top with the section's
  name and a menu button that opens the sections, and the list and the item
  take turns. The rail follows the role: every member has Overview,
  Contributions, Ratings, the offline copy, the Inbox and Account; editors
  also Suggestions, the Studio, Comments, Questions and Votes; members shown
  the statistics, and editors, Searches; admins Members, Notices and
  Settings; the owner Sponsors. A section that is a long list (Suggestions,
  Comments, Searches, Ratings, Questions, Votes, the Inbox, Members) has the
  three columns: the list with its filters and search, the chosen row, and
  its facts and actions (`app/workspace/list-bar.js`, `columns.js`).
  Ratings, Questions and Votes show the entry concerned as the dictionary
  has it now beside the row. Overview
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
- **Four levels, each including the ones below** (`shared/roles.js`):
  member, editor, admin, owner. Owners give and take every level, admins move
  members and editors between those two; nobody changes their own level and
  the site always keeps an active owner. Changes are made in the workspace's
  Members section, each kept in `role_grants` with who made it; suspending
  signs the member out everywhere.
- **One navigation, laid out by the window's width, not the device**
  (`index.html`, `app.css`): under 1024px a floating glass tab bar of four
  icons (Home, Liked, Practice, You); from 1024px a glass sidebar with
  words, the name above and Grammar, fonts and Support below. The website
  and the app share it. Under 1024px the search is a screen of its own
  while the field has focus, closed by Cancel, by a search (Enter and the
  search button alike) or by a suggestion; the page under it stays put.
  On a definition the bar holds Back and the field. Under 1024px the
  field is drawn as the phone's own search field: filled, a magnifier
  first, searched by the keyboard's Search key, and Cancel at its end
  while searching. The entry's thumb sits on the headword's line (pressed,
  the entry is in Liked). In the app the window stays still and <body>
  scrolls (`app/core/scroll.js`), so the page bounces at its ends with the
  phone's own momentum while the tab bar stays put; scripts only watch
  touches (passive), never hold a scroll. The bar over a definition is
  fixed there, so the page bounces under it, and a pull down at the top
  of a page asks it again (`app/core/pull.js`): the phone's own activity
  spinner in the gap the pull opens, its spokes appearing with the pull, a
  light tap at the mark, the gap held open while the page loads.
- **Forms are named** under their part of speech: plural, third person,
  past, past participle, -ing form, comparative, superlative, as the
  dataset labels them (one word that is two forms shows both names).
- **You (`/you`, `app/reader/you.js`) holds everything personal:** sign-in
  (or the account, with Sign out and the workspace), the offline copy,
  theme, language, usage statistics, and the site's pages (on phones the
  footer gives way to it). Members manage the offline copy at `/offline`;
  visitors see what the device keeps and, while definitions are for
  members, a sign-in.
- **Liked (`/liked`, `app/reader/liked.js`) is the member's own ratings:**
  entries and meanings rated helpful, or not helpful, newest first; a
  meaning changed since it was rated is marked Updated. No list of its own
  is kept.
- **Keyboard:** `/` or Ctrl+K (⌘K) puts the cursor in the search field;
  the workspace has J/K to move, A/D to approve or decline, 1–4 for a
  message's state.
- **The interface speaks English or Myanmar** (`app/i18n/`). Interface
  text is written in English inside `t()`, and `my.js` gives the Myanmar
  for each; a text with no Myanmar is an error, and `tests/i18n.test.js`
  checks every `t()` against `my.js` (missing, unused, placeholders). The
  device's language decides until the language is chosen on You
  (`mo:lang`); `<html lang>` is set before the first paint and the page
  reloads on a change. While `MYANMAR_OPEN` is false (`app/i18n/index.js`)
  the Myanmar interface is paused for review: readers get English and no
  language choice; `?ui=my` on any address turns it on for one device,
  `?ui=en` off. In Myanmar, numbers and dates use Myanmar digits and
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
  word, and writes gzip files to R2 under the build (`myordbok/offline/<build>/`, the one private bucket for every MyOrdbok file):
  word lists (everyone), English and Myanmar senses, English related words
  (members, or everyone by the admin setting `offline.access`). The app keeps
  them in IndexedDB (`app/data/offline.js`): word lists by themselves once a
  day at most, the rest chosen on `/offline`. Offline, the device reads a
  query as the server does (`app/data/read-offline.js`, the same shared code
  over IndexedDB): a word, a phrase read from its words, a sentence split into
  words, or "did you mean" from the word list; all marked as the copy on the
  device. Ratings, comments and suggestions still need the network.
  Downloads cost R2 reads and one Worker request per file, and one counter
  row write.
- **Long lists get their own section.** Searches (`?s=searches`, editors)
  lists every word in `search_counts` today, over 3, 5, 7, 30 or 90 days or
  all time,
  not found first, 50 a page with offset paging, and opens a word with its
  days; a word never found that is now an `eng_word`/`mya_word` headword is
  marked, so the list shrinks as words are added, with no table of its own.
  The filtered list downloads as CSV (formula-like cells defused). Ratings
  pages the same way, one kind at a time, the site's ranked not helpful
  first.
- **The offline copy is sealed, and its download held to a few a day.**
  Each definition answer is stored in IndexedDB encrypted with AES-GCM under
  a key the browser makes on that device and keeps non-extractable
  (`app/data/seal.js`, IndexedDB version 2 adds its `keys` store); storage
  tools show random bytes, and only the site running there opens them. Word
  lists stay plain (public through suggestions anyway); an answer stored
  unsealed is read as it is and sealed by the next download. This stops a
  glance, not the owner of the device, who can run the site's code: hence a
  member downloads definitions at most `offline.daily` times a day
  (`users.offline_today`, `offline_total`, shown in Members), and marker
  entries in the data (`scripts/markers.js`) show a copy for what it is.
- **Switches, not releases.** `settings` (key, JSON value) holds what admins
  start, stop or pause in the workspace (Settings), each read when used
  (`worker/lib/settings.js`): read-only mode (every write but signing in and
  the settings refused), new accounts, suggestions, ratings, comments
  (open, closed or hidden, with a daily limit and a smaller one for an
  account's first day; the same text twice a day is refused), the contact
  form, counting searches and how long counts are kept, the home page's
  most-searched list and its threshold, offline access and whether word
  lists arrive by themselves, Test yourself and Help the dictionary. Pages learn the switches from `/api/site`
  (kept at the edge for a minute) and hide controls that would fail; the
  Worker refuses the writes either way.
- **Comments sit under the entry.** `comments` (lang, word, body) holds
  plain text from signed-in members, shown at once with the member's name,
  newest first, loaded when the section nears the screen and never offline.
  Five in ten minutes per member at most; the author deletes their own,
  editors hide or show any in the workspace (Comments), and the admin
  setting `comments.open` closes new ones.
- **Supporters live in the app database, not in the repository.**
  `donors` (a name as it may be shown, whether it is shown, an optional
  member account, the owner's note) and `donations` (day, US cents after
  fees, method) are kept by the owner in the workspace (Sponsors). The
  Support page (`/support`, linked from the header with the one warm colour)
  gets totals and, by year, the names of donors who agreed to be shown, and
  counts the rest as anonymous (`/api/support`, ten minutes at the edge); no
  amount is ever beside a name, and no email or payment detail is kept. A
  quiet line on the home page links to it unless Settings turns it off
  (`support.ask`), the reader hid it (for four months, on that device), or
  the member is a linked donor.
- **Statistics can be shared without a level.** `users.insights` lets an
  admin show a member the Overview's figures, Searches and the whole site's
  ratings, read only (`seesStatistics` in `shared/roles.js`); nothing else
  changes for them. Admins also delete search counts older than a number
  of days (at least 30) from Searches.
- **Offline use is counted, not tracked.** `usage_counts` (day, name, n)
  holds plain counters: each pack download, as new or as an update (the app
  sends `x-pack-update` when it replaces a copy), and a daily check-in
  (`POST /api/usage`) from a device keeping definitions, with the packs it
  keeps and how many words it answered offline since the last one (tallied
  on the device). No words, no device id: "devices today" is exact, distinct
  devices over longer spans are not. Editors see the last seven days on the
  workspace Overview. The table is general; other counters can share it.
- **Contact goes through the site, not email.** MyOrdbok has no address of
  its own: `/contact` sends feedback, questions, problems and words to add to
  the `messages` table (`POST /api/messages`), read by admins in the
  workspace's Inbox. A member who wrote while signed in reads the answer, and
  the message's state, in their own Inbox (`GET /api/messages`, migration
  0015); nothing is mailed, and the workspace's badge counts the answers not
  yet seen. A visitor has no Inbox: their address (if left) opens a reply in
  the admin's own mail. Saved answers, in both languages, start either kind.
  Spam: a field people never see drops the message when
  filled, plus the same-origin rule and the stricter rate limit.
- **Site notices are scheduled, not posted.** Admins write them in the
  workspace's Notices section (`notices` table, `worker/routes/notices.js`,
  `shared/notices.js`): maintenance, information or a celebration, in English,
  Myanmar or both, for everyone, members or editors, with a start and end and
  an optional earlier date to announce it from; a yearly one repeats on the
  same days (fixed dates only; lunar days are scheduled each year).
  Maintenance and information show as a bar under the header on every page,
  maintenance with its window in the reader's own time; a celebration
  replaces the language line on the home page. `/api/notices` is kept at the
  edge for five minutes; signed-in readers ask with `?for=me`, uncached, for
  the notices of their level. A notice closed by a reader stays closed on that
  device until it is edited.
- **Searches are counted, not logged.** Each search page (`/api/read`)
  adds one to `search_counts` (day, language, word, found), after the answer
  is sent and including answers from the edge cache
  (`worker/lib/counts.js`). No identity, no time of day; terms over 60
  characters, typing suggestions, numbers and sums are not counted.
- **What was searched and not found is sorted, not just listed.** In the
  workspace's Searches an editor labels a word never found (to add, a
  misspelling, not a word), one key a word or many at once (`search_marks`,
  migration 0016). The label belongs to the word, so it outlives the daily
  counts. The default list holds what is still to sort and what is to add;
  filters narrow it by label, number of searches, days searched, shape, and
  first searched in the period; the list as filtered downloads as CSV.
- **The workspace's lists are narrowed in the address.** Searches, the Inbox
  and Members each take their filters as address parameters, so a view can
  be bookmarked and shared; the server does the filtering and searching, and
  each list loads further pages on request. Searches and the Inbox act on
  several rows at once (a label; a state, thanks, deletion), never more than
  200; Members has no such actions on purpose: levels and suspensions are
  changed one member at a time. Searches and Members download as CSV.
- **A sense is read as items.** Every text column of the dictionary holds
  items separated by ` | `; `;` and `,` are punctuation (the dataset's
  Readme, "Items and markup"). `shared/markup.js` splits and classifies
  them: an item that is one bracket is a note, `[figurative]` shown as a
  label before the glosses and `[compare:…]`, `[Pali:…]` as the name and its
  value after them; in an English headword's sense `[en:…]` is the sense
  explained in English, shown under it; every other item is a gloss or an
  example, one a line. Editors edit a field one item a line, and a
  suggestion the dataset's build would refuse (`;` between glosses, a pipe
  without its spaces, unbalanced brackets, `[en:…]` before the glosses) is
  refused when it is made. A rating holds while the glosses stay the same:
  the notes, the English explanation and the separator are not the meaning
  (`worker/lib/meaning.js`).
- **Nothing found is still an answer, and says which kind.** `/api/read`
  tells a word the dictionary knows but has not defined (it is in `eng_word`
  or `mya_word`: WordNet, Moby and the forms table) from one it does not know.
  A known word is the heading, "Recognised word · not yet defined"; an
  unknown word with a headword one slip away, or one editors marked a
  misspelling in Searches, is "Did you mean …?" with that word's meaning one
  press away; otherwise "Not a word we know yet". Myanmar slips (ျ/ြ, ိ/ီ, a
  tone mark) come from `shared/myanmar-variants.js`. Below come the nearest
  Myanmar meaning of a word with the same meaning (`nearest`, said to be
  that word's, never shown as the word's own), the related words in full
  (only those with an entry, `with_entry`, link), words starting the same
  way, and a way to suggest it. Invisible characters (zero-width space, soft
  hyphen, direction marks) are taken out of every query, and the page says
  so. A sentence is shown one word at a time (`&w=`), each word fetched only
  when opened and kept for the session, the next fetched ahead unless the
  reader saves data.
- **Test yourself is made on the device.** Under an English entry, a round
  of three questions is made from its reviewed meanings and a few other
  words' (`shared/quiz.js`): which Myanmar meaning is the word's, which word
  a Myanmar meaning is, or hearing it, or typing it; a gap in its own example
  with its own forms; which of its meanings an example uses. Wrong choices
  are never meanings the word has. Nothing is fetched until the reader
  starts. Words come back after 1, 3, 7 and 21 days (`/practice`); progress
  is kept in the browser and, signed in, merged with the account's copy on
  every save (`quiz_progress`, migration 0019). With the reader's consent
  for usage statistics, answers are counted per question and choice, with no
  reader kept (`quiz_answers`); a question can be reported as wrong
  (`quiz_reports`); editors see both in the workspace's Questions.
- **Native readers help, and checks decide whose help counts.** After a
  round, a signed-in member is asked a spelling question (a word searched and
  not found against dictionary words one slip away, or spellings an editor
  typed) or whether a meaning not yet reviewed is right
  (`worker/routes/help.js`, migration 0018). Some spelling questions are
  checks with a known answer (a dictionary word against slips of it that are
  no words), alike to the reader and graded on the server; a member's votes
  count after 3 checks with 80% right. An item is ready at 5 counted votes
  with 80% agreeing; an editor decides in the workspace's Votes. A decision
  never changes the dictionary: a spelling labels the searched misspellings
  in Searches, a meaning is changed in the studio.
- **The home page has a word of the day** (`/api/today?day=`): one reviewed
  meaning with an example, the same for everyone that day, the day turning in
  the reader's own time zone; with a link that starts Test yourself on it,
  sharing, and the reader's daily round of words due.
- **A headword can be heard.** The button beside it plays
  `/api/pronunciation?q=…&tl=en|my`, which the Worker fetches from Google
  Translate's speech address and keeps at the edge and in the browser for a
  month (`worker/routes/pronunciation.js`). That address is not a documented
  service: it may refuse or end without notice, and then the button says so.
- **Words outlive builds.** Ratings of a whole entry and comments name the
  headword by spelling; ratings of a meaning name its sense id, which the
  dataset keeps across builds, and the meaning's text (`text_hash`).
- **Roles are checked on the server on every write**, reading the role from
  D1: `member` reacts, comments and suggests; `editor` edits and reviews;
  `admin` also grants and removes levels, and makes edits live; `owner` also
  gives and takes every level. The first owner is given from the command
  line (`make grant`), never by the app.
- **Releases while a page is open.** The service worker of a release takes
  over open pages at once and keeps the shell of the release before beside
  its own, so a page opened earlier still finds its own files. A copy that
  is a page standing in for a file is never used. A route whose script
  cannot be loaded, online, loads the page again once; a second failure
  within a minute is shown.
- **Offline.** The service worker keeps the app shell. Dictionary data is
  downloaded on request as versioned packs and stored in IndexedDB
  (`app/data/offline.js`), in the app as on the web. `/api` is never served
  from the service worker cache.
- **The definition page says what it is about before any script runs.**
  The Worker writes a title, a description, the address to index and one
  sentence into the app's page for `/definition?q=word`
  (`worker/routes/page.js`, `shared/summary.js`), the same for every
  reader; the app replaces the sentence with the entry. Only that sentence
  is outside the API's guard.
- **Fail fast.** Errors carry a stable code (`shared/errors.js`) and reach the
  screen or the log; nothing falls back silently.
- **Analytics only with consent.** Google Analytics loads on the public
  hosts after the visitor allows it (`app/core/consent.js`); the choice
  stays on the device and can be changed on the privacy page. The same
  choice decides whether Test yourself answers are counted.
- **Deployment.** Beta and live are Wrangler environments bound to the
  same three databases. Every push to `dev` is tested and deployed to beta by
  GitHub Actions (`.github/workflows/deploy.yml`); each release to `master`
  is deployed to live after approval. See [deploy.md](deploy.md).

- **The app holds its own files.** The iOS and Android app (`src-tauri/`)
  carries the build of `app/` (`--target tauri`); only the dictionary and
  what readers send go over the network. A change to the pages reaches
  phones with a store update, so the API keeps answering older builds; the
  lowest build it serves is `APP_MIN` (`wrangler.toml`), and an app below
  it asks to be updated. The app's requests are made natively (the HTTP
  plugin) and name the app in `X-MyOrdbok-App`, which the guard accepts
  within the same limits (`worker/lib/guard.js`). The app is used signed
  out: the workspace and signing in open the website. On iOS, nothing asks
  for gifts.

## Next

1. The app: linking it to an account made on the website (a device code
   approved at myordbok.com/link); the new look by screen size (large titles,
   Liquid Glass header and tab bar, search as its own screen, Liked; a
   sidebar on wide screens); a content security policy once tried on phones.
2. Query: multi-word headwords inside sentences.
3. Myanmar text for About, Privacy and Terms.
