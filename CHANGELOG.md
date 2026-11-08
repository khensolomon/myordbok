# Changelog

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
