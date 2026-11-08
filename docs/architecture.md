# Architecture

MyOrdbok is a single-page HTML5 app (PWA) backed by a Cloudflare Worker and
D1. One codebase serves the web today and Tauri desktop and mobile later.

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
  static/             logo, icon, app icons, Myanmar3 font
  sw.js               service worker (web build only)
worker/               Cloudflare Worker: /api routes, static assets
shared/               used by app and worker: errors, roles, validation, version
db/migrations/        D1 schema (wrangler migrations)
scripts/              build, dev server, version bump (Node stdlib only)
tests/                node:test
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
- **D1 is the single source of truth.** Headwords are stored once
  (`eng_word`, `mya_word`); senses refer to them by `wrid`.
- **Every edit is logged.** `changes` is append-only. It provides history,
  revert (a revert is a new change), attribution, and the version number that
  offline clients sync from.
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
- **Deployment.** Beta and production are Wrangler environments sharing one
  D1 database; see [deploy.md](deploy.md).

## Next

1. Google and GitHub sign-in (OAuth with PKCE in the Worker, server-side
   sessions), the You menu, member roles.
2. Reactions, comments and suggestions; studio review queue.
3. Data migration from the dataset into D1 (dry run by default).
4. Offline packs and delta sync.
5. Tauri adapters.
