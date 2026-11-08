# Changelog

## 26.11.8+10

- Header: plain text navigation (Home, Grammar, Fonts, About) that scrolls away; no logo and no empty space for one on the home page
- One search bar for every page, in the page shell: the logo on its left (the icon alone on phones), sticky under the header while the page scrolls; on the home page it is the centrepiece
- Search box: lower (44 px), its background follows rest, hover and focus; a smaller search button inside it; suggestions open inside the same box instead of a separate panel
- Header, search bar, content and footer share one column and one left edge; the footer is a left-aligned line of text without the icon

## 26.11.8+9

- Databases renamed, each with one fixed role: myordbok-app (APP: members, reactions, comments, studio edits), myordbok-dataset (DATASET: every new build lands here; beta previews it) and myordbok-dictionary (DICTIONARY: what production readers get). They replace myordbok, myordbok-dict-a and myordbok-dict-b
- Releases in two steps: make data-publish (build → myordbok-dataset, checked, beta) and make data-promote (the same build → myordbok-dictionary; production reads myordbok-dataset meanwhile, so readers never wait). A promotion that stops part way leaves production on the dataset and blocks new publishes until it is finished
- make data-setup creates all three databases if missing and writes their ids; make data-switch SITE= TO=dataset|dictionary is kept for repairs; rollback is a release of the previous build, or D1 Time Travel on myordbok-dictionary
- dict_release records reads (dataset or dictionary) and build per site; the Worker binding DB is now APP, DICT_SLOT is now DICT_DB, and /api/health names the database in use
- Edits export against myordbok-dictionary and wait while beta previews a build that is not promoted yet
- Docs updated: deploy guide (databases, dictionary releases, studio edits), architecture, Makefile help, wrangler.toml and migration comments

## 26.11.8+8

- Fix: a test assumed wrangler.toml still had placeholder dictionary ids

## 26.11.8+7

- An empty dictionary slot answers 503 with how to fill it (locally make data-sample or make data-local, remotely make data-publish) instead of a raw SQL error

## 26.11.8+6

- make data-setup creates the dictionary databases (or finds them) and writes their ids into wrangler.toml for every environment; data commands also refuse ids that are not UUIDs

## 26.11.8+5

- Data commands stop before contacting Cloudflare while wrangler.toml still has placeholder database ids for the dictionary slots, and say how to fix it

## 26.11.8+4

- Dictionary data now comes from the private dataset build (khensolomon/lai, branch dataset), the TSV files staying the source of truth; the app never writes to the dictionary tables
- Two dictionary slots (D1 myordbok-dict-a and myordbok-dict-b): a release is imported into the free slot, checked against its row counts, then switched to; switching back is the rollback (make data-publish, data-switch, data-status)
- Studio edits get their own table, dict_edits (pending, approved, exported, merged or conflict); make edits-export writes approved edits as the dataset scripts' patch files and turns stale edits into conflicts
- App database schema rewritten as assets/db/migrations/0001_app.sql: members, identities, sessions, role grants, reactions, comments, dict_edits, dict_exports, dict_release; reactions and comments name headwords by spelling
- Database files moved under assets/db/; seed.dev.sql is a made-up sample in the real tables (make data-sample, make data-local FILE= for a real build on your machine)
- The Worker runs the dataset's own lookup (shared/search, kept in step by make dataset-sync): /api/lookup and /api/suggest replace /api/search and /api/entry; /api/health reports the dictionary in use
- Definition page shows the full result: senses by part of speech with draft and awaiting-review badges, a root's entry under its forms (went, go), spelling variants, forms, synonyms, similar, broader, opposite and related words, Myanmar pronunciation, and the dataset markup (labels, patterns, highlights)
- Fix: Myanmar headwords no longer break at large sizes
- Tests run the Worker and the release tool against node:sqlite with the real migration and the sample; Node 22.13 or later

## 26.11.8+3

- Fix: make api and npm run dev:api build dist/web first, so a fresh clone starts without the missing assets directory error

## 26.11.8+2

- Cloudflare setup: beta (beta.myordbok.com, noindex) and production Wrangler environments sharing the D1 database; deployment guide in docs/deploy.md
- GitHub Actions: test every push and pull request; deploy dev to beta; deploy master to production once PRODUCTION_ENABLED is set
- Makefile with commented commands; remote and release commands are dry runs unless APPLY=1
- Google Analytics (G-E74XPBN0S9), loaded only after consent and only on myordbok.com and beta
- Privacy page, including a control to change the analytics choice

## 26.11.7+1

Rewrite begins: the Django version is replaced by an HTML5 app (PWA) on
Cloudflare Workers and D1, in plain JavaScript modules with JSDoc.

- Remove the Django app, Docker setup, deploy workflows and the previous
  front end (`assets/com`, `icon`, `img`, `queries`, `script`, `scss`)
- Add the app shell: router with deep links, search with live suggestions,
  definition page (timeline on wide screens, cards on phones), light and dark
  theme, Myanmar3 web font shipped with the app
- Add PWA manifest, app icons and a service worker that keeps the shell
  available offline; the studio is never precached
- Add platform adapters (`app/platform/web`), with `app/platform/tauri`
  reserved for desktop and mobile builds
- Add the Worker API: `/api/health`, `/api/search`, `/api/entry/:lang/:word`
- Add the D1 schema: dictionary tables, members and roles, sessions,
  change log, reactions (like / dislike), suggestions and comments
- Add stdlib-only scripts: build (hashing, import map, precache), dev server,
  version bump with dry run
- Add tests on Node's built-in runner
- Version scheme is now `yy.mm.dd+changes`

## Previous version (Django)

### 1.9.7

- Introduce <> in instead of [list:*]
- Update dependencies

### 1.9.6

- add antonym & anth-class
  - Provided by `view_antonym`

### 1.9.3-4-5

- Update dependencies
- Add prepare environment for `.env` & `package.json`, calling `environment()`

### 1.9.1-2

- ThemeMode [auto, light, dark]
- Suggestion on non-definition
- Fonts counter db integrations & robot JSON generator

### 1.9.0

- Improved performance, rewrite data-structure
- Todo
  - [ ] oem word source and its relative langs

### 1.8.2-3-4-5-6-7

- NEN
- Cookie consent
- devtool remove on production
- Animation
  - [x] word progress
- Color
  - [x] Theme mode (light and dark)
- TypeOf
  - [x] type (law, medical, physic, religion, grammar, biology, dated etc)
- SEO
  - [x] headings
- Add suggestion
  - [x] form link
  - [x] soundex
- Modified info(data)
- Privacy policy, Terms of service and Cookie policy are updated
  - [x] cookie SameSite=Lax
- Style (search)
  - word: 59652
  - sense: 101876
  - usage: 55418

### 1.8.1

- MED
- Theme mode
- js interactive with vue (component)
- Authentication (firebase)

### 1.8.0

- Move thuddar and glossary.info to rep
- Improved flat, gist, orth, sea, setup, sqlite, thuddar, wordbreak
- Move  to rep
- Fixed thuddar section
- Update time of individual dictionary

### 1.7.9

- Customized input form for mobile
- Update dependencies
- Add list_cache
- Change file.cache directory

### 1.7.8

Font noticed

Glossary

- word: 58845
- definition: 100855
- example: 54138

### 1.7.7

testing

### 1.7.6

Package

- myanmar-notation: 1.5.1
- mathjs: 11.6.0
- word-thesaurus: 1.0.2

Glossary

- usage: 87.5
- completion: 69.3
- word: 58521
- definition: 100485
- example: 53829

### 1.7.0

Package

- pug: 3.0.2
- myanmar-notation: 1.4.5
- mathjs: 9.2.0

Glossary

- usage: 87.5
- completion: 69.2
- word: 58505
- definition: 100472
- example: 53807

### 1.6.3

Package

- pug: 3.0.2
- myanmar-notation: 1.4.5
- mathjs: 9.2.0

Glossary

- usage: 87.5
- completion: 69.2
- word: 58541
- definition: 100480
- example: 53738

### 1.0

Feature

- album
- artist
- queue
