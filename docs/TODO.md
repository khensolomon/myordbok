# Todo

## PWA rewrite

- [x] Myanmar interface language (paused for review: `MYANMAR_OPEN` in app/i18n/index.js; reviewers add `?ui=my` to any address)
- [ ] Myanmar text of About, Privacy and Terms (drafted for review)
- [ ] Offline: phrases and sentences on the device; a Myanmar thesaurus pack
- [ ] Myanmar text of the sums' messages (shared/query)
- [x] Feedback and contact form (own, replacing the Google Form and the contact email)
- [x] Offline data: word lists for everyone; definitions and related words as separate opt-in packs
- [x] Comments
- [x] Backups of the app database (myordbok-app)
- [x] Fonts page (/myanmar-fonts): retired, with a page saying so
- [x] Live edits and the studio
- [ ] Review of the Myanmar interface text by a native speaker
- [ ] Studio: a new Myanmar headword with its pronunciation (IPA, MLC)
- [ ] Offline copies take live edits at check-in (today they follow the release)
- [ ] Search suggestions for headwords only the live layer has
- [x] A word's family on the entry (dataset lookup `family`)
- [x] The offline related pack with the family (`make data-packs`, 2026-11-25)
- [x] Tauri adapters (http, boot) and the app project (`src-tauri/`), with an Android test build in GitHub Actions
- [x] The app on Play: new upload key (valid from 2026-11-24), signed AAB builds (App workflow, play-aab)
- [x] The app on Play: closed testing, then production (version code 1202, 2026-11-25)
- [ ] The app on Play: the next bundle, with the adaptive icon and the comment menu; then the Play icon (Google workflow, listing ▸ icon)
- [x] The iOS build in GitHub Actions (macOS runner, App Store Connect API key), uploaded to TestFlight
- [ ] The app on the App Store: review of version 26.11.25 (build 1205 or later), released by hand
- [ ] On the release day: the earlier in-app purchases (offlineaccess, upgrade, subscription_silver) off sale on both stores
- [x] Sign in with Apple on the website, removable (setting signin.apple)
- [x] Linking the app to an account (myordbok.com/link, Linked devices on the Account page)
- [x] A sitemap of the headwords, following each data release; robots.txt naming it
- [ ] CI secrets
- [ ] LICENSE: copyright holder's name

## Stores and the app

- [x] One Run workflow with a Command box, the commands described once (shared/commands.js)
- [ ] Workspace → Tools: forms built from shared/commands.js, the command line to copy
- [ ] Results back to the workspace (GitHub's OIDC token, no secret)
- [ ] More commands: web (deploy again, release, health), database (migrations), data (build from lai, packs), backup, screenshots
- [ ] iOS sign-in inside the app (ASWebAuthenticationSession) instead of Safari
- [ ] App Store header and search picture (one 16:9 universal asset, 5244 × 2950)
- [ ] Server-side purchase checks (Apple's In-App Purchase key; Play's purchases API), only should supporter status follow the account
- [ ] The iap plugin's bug upstream (initPlugin not public: lost in release builds)
- [ ] The apps' content security policy; assetlinks.json and apple-app-site-association
- [ ] Accessibility checked with VoiceOver and TalkBack, larger text; then App Accessibility on App Store Connect
