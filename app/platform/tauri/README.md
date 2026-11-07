# Tauri platform adapters (reserved)

Desktop and mobile builds use the same app code as the web. Only the modules
in this folder differ, and they are selected at build time through the import
map (`#platform/…`), never by runtime checks.

Each file in `../web/` needs a counterpart here exporting the same names:

| Module | Web | Tauri (planned) |
|---|---|---|
| `boot.js` | registers the service worker | no service worker; native updater |
| `http.js` | `fetch` | Tauri HTTP plugin (no CORS) |
| `storage.js` | IndexedDB | files or SQLite through plugins |

`npm run build:tauri` stops with an error until every adapter exists, and
`tests/platform.test.js` checks that the exports match.
