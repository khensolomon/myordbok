# Changelog

## 26.11.9+42

- A rating that cannot load says so instead of sending a signed-in reader to the sign-in page and back

## 26.11.9+41

- Each meaning has its own thumbs up and down and a suggest button that edits only that meaning, right under it
- The side card rates the entry as a whole and adds a missing meaning; thumbs replace the heart icons
- A meaning's ratings start afresh when the meaning is corrected
- Lookups carry each sense's id (dataset search code synced)

## 26.11.9+40

- Signed-in members like or dislike an entry and suggest changes to its meanings, a new meaning, or removing one, from the entry page
- A member's suggestion waits for review; an editor's own is approved and reaches the dictionary with the next release
- After signing in from an entry, the reader comes back to that entry

## 26.11.9+39

- A sign-in provider that is not set up names the missing setting on the account page

## 26.11.9+38

- About explains sign-in: what is kept, why, and a link to Privacy

## 26.11.9+37

- Local sign-in works from the dev server on :8000: the callback is always localhost:8787

## 26.11.9+36

- Local GitHub sign-in uses the same GitHub app as beta and production

## 26.11.9+35

- Sign in with Google or GitHub: the account page, the account button in the header, sign out
- The same verified email through either provider is the same member; unverified emails are neither stored nor matched
- make grant gives a member a role by their sign-in email

## 26.11.9+34

- Refused API requests get the standard message 'Access denied.'

## 26.11.9+33

- The production Worker is named myordbok; the local-only configuration is myordbok-local, so a deploy without --env can never overwrite production

## 26.11.9+32

- The API answers the app's own pages only: other websites and scripts are refused on beta and production
- Rate limits per visitor, stricter for the routes that read many rows; repeated lookups come from the edge cache

## 26.11.8+31

- One request decides what a query is: an entry, a phrase, a sentence or nothing found, so a slow connection waits once
- Myanmar text written without spaces is split into the dictionary's headwords and shown one word at a time; syllables no headword covers are marked
- Punctuation around a single word no longer hides it (love!, ချစ်။)

## 26.11.8+30

- Each spelling the dataset holds is its own headword: a search for 'god' shows God and god separately
- A phrase shows its words as headwords, the sense that fits first and marked; the phrase and its Myanmar reading move beside them

## 26.11.8+29

- Phrases that are not entries, such as 'king of Denmark' or 'big house', are read from their words: the Myanmar of the whole phrase, then the sense of each word that fits
- More questions understood: who is, where is, what does X mean, how do you say X in Myanmar, X in Burmese
- docs/query.md: how a query is read, and what is shown for each kind

## 26.11.8+28

- Search reads what was typed first: numbers in Myanmar and English words, sums and percentages, the time and date answered on the device
- Questions such as 'what is love' or 'similar word of love' open the word, saying how the question was read
- No entry: did you mean, words starting the same way, and a way to suggest the word; sentences shown one word at a time

## 26.11.8+27

- Terms: MyOrdbok is a free, non-commercial service for general information; use is personal, educational and non-commercial, as in the previous terms

## 26.11.8+26

- Terms of Use rewritten for the new app: a short summary; free use for study, teaching, work and personal purposes; quoting with credit welcome, bulk copying, scraping and sharing the offline download not; WordNet and Moby Thesaurus under their own terms; the MIT licence covers the code only; accuracy and draft meanings; accounts and contributions (licence to publish, editor review, removal of abuse); Myanmar fonts; liability; how to report a problem
- The contact address placeholder and the repository link live in one place (app/core/config.js) for the About, Privacy and Terms pages

## 26.11.8+25

- Header links quieter on wider screens: no capsule, the current page under a barely-there pill and an even paler hover, both still gliding; phones keep the icon capsule

## 26.11.8+24

- Header links in a glass capsule on every screen size: a raised lens marks the page you are on and glides to the new link when the page changes; a light tint follows the pointer from link to link
- A thin brand-blue bar across the top of every page

## 26.11.8+23

- Myanmar text uses Noto Sans Myanmar with true regular and semibold weights (SIL Open Font License, shipped with the app) instead of Myanmar3, whose bold was faked by the browser; about the same size to download
- Grammar: terms being explained get a soft blue highlight instead of bold
- Grammar terms without a section of their own show as chips like the others

## 26.11.8+22

- Grammar topics: a back button before the title replaces the Grammar link; opened from the list it returns to the list where it was left, otherwise it opens the list
- Back and forward put every page back where it was scrolled to

## 26.11.8+21

- Grammar pages: /grammar lists the nine parts of speech and the other topics with their Myanmar and English names; /grammar/<slug> shows a topic's sections, classifications (linked to their sections), example words, example sentences and tables, with the contents beside the text on wide screens and above it on phones, and previous/next topics
- Grammar content is built from assets/data/thuddar into /data/grammar/ and kept for offline use; malformed data stops the build with the file named; the English parts of speech appear on the part-of-speech topic
- About page rewritten with current information: the name, live figures and last update from the dictionary in use, how meanings are checked, aim, how the dictionary grows, how to help (GitHub issues until sign-in), support (PayPal, GitHub Sponsors), the running version explained, and sources (WordNet, Moby Thesaurus, မြန်မာသဒ္ဒါ); visit counts, the language list, social sharing, Google Forms and outdated notes removed
- /api/health also returns the dictionary's row counts; links to a place on the same page (#…) scroll there, also when opened directly

## 26.11.8+20

- Suggestion rows are square under the hairline; only the last row rounds, at the bottom, inside the box's corners
- Open suggestions: the box turns opaque so the page behind never shows through the list; glass again once closed

## 26.11.8+19

- Suggestion highlight follows the box: the first row rounds at the top, the last at the bottom, rows between are square

## 26.11.8+18

- Open search box: no fill behind the field; a hairline separates the field from the suggestions

## 26.11.8+17

- Focused search box: a lifting shadow instead of a blue line

## 26.11.8+16

- Search box: closed it is a pill; on focus the whole box grows 4 px outward and its corners ease to 20 px around the field's 16 px (concentric), with the button always a circle and the text never moving

## 26.11.8+15

- Definition pages: larger logo (180 px) and icon (40 px) beside the search box
- Below desktop, the header and the search bar have no bottom line; once the page scrolls under the search bar, a soft, partly transparent shadow lifts it
- Phones (Liquid Glass): the header and the search bar float without a band; the nav capsule, You button and search box carry their own glass, and a fading scrim appears behind them only once the page scrolls
- Definition pages get a second column on large screens (below the entry on smaller ones): a summary of the result (meanings, parts of speech, what is still a draft or awaiting review) and a place to like, dislike or suggest a correction, disabled until sign-in arrives
- New dislike icon in the same line style

## 26.11.8+14

- Large screens: each part of speech's line starts under the left edge of the search box, and the word lists line up with it; the outer line stays under the language badge
- Fix: a stray brace in app.css dropped the word-list styles; a test now checks every stylesheet for balanced braces

## 26.11.8+13

- The definition timeline's line runs down from the middle of the language badge again; the word lists start on the same line
- Side padding of header, search bar, content and footer grows with the window: clamp(16px, 2.5vw, 48px)

## 26.11.8+12

- The search bar shows only on the home and definition pages
- A definition is as wide as the logo and the search box; its timeline and word lists start under the left edge of the search box and follow it as the screen narrows
- Logo by screen size: full logo on desktop, the icon on tablets and large phones, none beside the search box on phones (the home page keeps the full logo above it)
- Phones: the main links become icons (home, grammar, fonts, about) in a glass capsule, the current page under a brighter lens
- Liquid Glass on the header, the footer, the search bar and the search box: blurred tinted fill, bright top edge, soft lift

## 26.11.8+11

- Home: the logo and the English ⇄ မြန်မာ line above the search box again, centred
- Header and footer span the full width; the search bar and the page content start at the left edge with a reading width; no rule above the footer
- Search box: focusing it shows the suggestions for the word already in it (on a definition page, the word looked up), the same as typing it

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
