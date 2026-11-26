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

Signing in links the app (`/api/link`): the app shows a code, the reader
signs in on the website and approves it at `/link`, and the app, asking every
few seconds, receives its own session token. On iOS the website opens in
Apple's sign-in sheet over the app (`tauri-plugin-web-sheet`, vendored in
`src-tauri/plugins/`: ASWebAuthenticationSession, sharing Safari's sign-ins),
as the App Store asks; `/link?sheet=1` ends the sheet on `myordbok://linked`
once answered, and the app closes it itself on seeing the approval. On
Android the website opens in the browser.

What the store apps send elsewhere: `/support` (the website's own asking
for gifts) leads to More (`STORE_MOVED`, `app/core/routes.js`).

What the iOS and Android apps leave out: every element marked
`data-store-hidden` (asking for gifts outside the store), as Apple and Google
allow no asking for money outside their own payments.

Supporting, in their place: the More page offers a one-time Supporter
purchase and three tips through the store (`app/core/support.js`; the
`tauri-plugin-iap` plugin, StoreKit 2 and Google Play Billing). Nothing is
unlocked by them. At each launch the store is asked quietly what the account
owns: the Supporter purchase, or the earlier Flutter app's one-time
purchases (`offlineaccess`, `upgrade`, `subscription_silver`), whose buyers
are supporters and are thanked once. Products, in App Store Connect and the
Play Console alike:

| ID | Type | Price |
|---|---|---|
| `supporter` | non-consumable | 2.99 USD |
| `tip_small` | consumable | 0.99 USD |
| `tip_medium` | consumable | 4.99 USD |
| `tip_large` | consumable | 9.99 USD |

Google Play takes back a purchase not acknowledged within three days, and a
tip can be given again only once used up (consumed): the app acknowledges the
Supporter purchase and uses up each tip as soon as it sees them. The App Store
finishes both by itself.

The offline copy is the web's, in IndexedDB (`app/data/offline.js`), which
the system web views keep. A native store (files or SQLite) is for when a
phone is seen to clear it or to be too slow.
