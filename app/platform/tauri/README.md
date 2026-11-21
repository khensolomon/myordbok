# Tauri platform adapters

The MyOrdbok app (iOS and Android, from `src-tauri/`) runs the same app code
as the web. Only the modules in this folder differ, selected at build time
through the import map (`#platform/…`), never by runtime checks elsewhere.

| Module | Web (`../web/`) | Tauri (here) |
|---|---|---|
| `boot.js` | registers the service worker | marks the platform on `<html data-app>`; opens links that leave the app in the system browser; asks for an update when the server no longer serves the build |
| `http.js` | `fetch`, same origin, with the session cookie | `/api/…` through the HTTP plugin to the server named at build time, with `X-MyOrdbok-App`; any other path is a file of the app |

Both export `request`, `getJSON`, `postJSON` and `mediaUrl`;
`tests/platform.test.js` checks that the exports match, and the build stops
when an adapter is missing.

The build writes two values into the page for these modules
(`scripts/build.js --target tauri --api …`): `<meta name="mo-api">`, the
server, and `<meta name="mo-version">`, the app's version.

What the app leaves to the website: the workspace and signing in (links to
`/workspace` and `/api/auth/…` open in the browser). The app sends no session
cookie.

What iOS leaves out: every element marked `data-store-hidden` (asking for
gifts), as Apple allows no asking for money outside its own payments.

The offline copy is the web's, in IndexedDB (`app/data/offline.js`), which
the system web views keep. A native store (files or SQLite) is for when a
phone is seen to clear it or to be too slow.
