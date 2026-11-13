# A comprehensive online Myanmar dictionary

The browser-based version of [MyOrdbok][home] — designed for fast, accessible 🇲🇲 Myanmar dictionary lookups without requiring installation.

![GitHub stars](https://img.shields.io/github/stars/khensolomon/myordbok)
![License](https://img.shields.io/github/license/khensolomon/myordbok)
![Last commit](https://img.shields.io/github/last-commit/khensolomon/myordbok)

- Works ⚡ instantly in your browser, installable as an app (PWA)
- Search across **200,000+ terms**, English → Myanmar and Myanmar → English
- Built specifically for Myanmar language structure: Myanmar text written
  without spaces is split into words
- No account needed to read; analytics only with consent
- Works offline once the dictionary is downloaded
- Interface in English or Myanmar

## Features

| Category        | Details                                                                 |
|-----------------|-------------------------------------------------------------------------|
| Definitions     | Meanings grouped by part of speech on a timeline, with each part's forms (`loves, loved, loving`) beside it, and synonyms and opposites |
| Smart search    | Suggestions while typing, "did you mean", phrases (`king of Norway`) read from their words, sentences one word at a time, Myanmar typed in Zawgyi read in Unicode |
| Answers         | Numbers read in words both ways (`10000`, `၁၀၀၀၀`, `ten thousand`), sums (`x=3/4*12`, `10% of 70`), shares, the time and date, laid out like an entry with copy buttons |
| Home            | Recent searches (kept on the device) and the words searched most this week |
| Members         | Sign in with Google or GitHub to rate meanings, suggest corrections and new meanings, and download the definitions for offline use |
| Workspace       | Overview and usage statistics, contributions, ratings, offline copy and account for every member; suggestion review for editors; members and the contact inbox for admins |
| Grammar         | Instant Myanmar [grammar][grammar] lookup                               |
| Fonts           | Integrated Myanmar [fonts][fonts] support                               |
| Apps            | Available on the [App Store][appstore], [Google play][playStore].       |

Keyboard: `/` or Ctrl+K (⌘K) goes to the search field.

```bash
git clone https://github.com/khensolomon/myordbok.git
```

## Development

A single-page HTML5 app (PWA) in plain JavaScript modules with JSDoc, served
by a Cloudflare Worker with D1 and R2. No framework and no bundler; Node
22.13+ and wrangler are the only tools. Tauri desktop and mobile builds reuse
the same code through platform adapters (see
[docs/architecture.md](docs/architecture.md)).

```bash
make install              # wrangler only
make db-reset             # local D1: app tables + a small made-up sample dictionary
make api                  # worker + local D1 on :8787
make dev                  # app on :8000, no build step, /api proxied to :8787
make test                 # node:test, no dependencies
```

The dictionary itself is built in a separate, private repository; this one
holds only a made-up sample in the same tables. A build reaches the sites in
two commands, each a dry run unless `APPLY=1` is given (the steps they run,
`data-packs`, `data-publish` and `data-promote`, also run on their own):

```bash
make data-beta FILE=…/myordbok.sql APPLY=1      # offline packs → R2, then → myordbok-beta: beta previews it
make data-live APPLY=1                          # the same build → myordbok-live, read by live
make db-migrate-remote APPLY=1                  # app database migrations on Cloudflare
make data-release APPLY=1                       # approved workspace edits → dataset → build → (your yes) → beta
make restore TABLE=comments WHERE="id = 42"     # rows gone since the weekly backup; APPLY=1 to put them back
make grant EMAIL=… ROLE=member|editor|admin|owner APPLY=1   # LOCAL=1 for the local database
```

Every push to `dev` is tested and deployed to beta by GitHub Actions.
`make release APPLY=1` fast-forwards `master` to `dev`; live is deployed
with `make deploy-live APPLY=1` once it replaces the current site.
Versions are `yy.mm.dd+N` (`make version NOTE="…" APPLY=1`). `make` lists
every command; deployment, branches and releases are described in
[docs/deploy.md](docs/deploy.md).

## Privacy & Security

We value your privacy. Reading, searching and offline use need **no account**, so your search history stays with you. Recent searches stay on the device; the server only counts how often each word is searched, never who searched it. Signing in with Google or GitHub is optional and used to rate meanings, suggest edits and download definitions for offline use. Google Analytics runs only after visitors allow it. For a detailed breakdown of how data is handled, see the [Privacy Policy](https://myordbok.com/privacy).

---

## Who is this for?

- Myanmar language learners
- Translators and linguists
- Developers working with Myanmar text
- Anyone needing a fast, web-based dictionary

---

## Contributing

Contributions are welcome!

- ⭐ Star the project
- 🐛 Report issues
- 🔧 Submit pull requests

---

*MyOrdbok — Empowering language learning for the Myanmar community.*

The Zawgyi detector and converter in `shared/zawgyi/` are Google's [myanmar-tools](https://github.com/google/myanmar-tools), under the Apache License 2.0 (`shared/zawgyi/LICENSE`).

[appStore]: https://apps.apple.com/us/app/myordbok/id1570959654
[playStore]: https://play.google.com/store/apps/details?id=com.myordbok.app

[home]: //myordbok.com
[grammar]: //myordbok.com/grammar
[fonts]: //myordbok.com/myanmar-fonts
