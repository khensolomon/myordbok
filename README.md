# A comprehensive online Myanmar dictionary

The browser-based version of [MyOrdbok][home] — designed for fast, accessible 🇲🇲 Myanmar dictionary lookups without requiring installation.

![GitHub stars](https://img.shields.io/github/stars/khensolomon/myordbok)
![License](https://img.shields.io/github/license/khensolomon/myordbok)
![Last commit](https://img.shields.io/github/last-commit/khensolomon/myordbok)

- Works ⚡ instantly in your browser
- Search across **200,000+ terms**
- Built specifically for Myanmar language structure
- No account needed to read; analytics only with consent
- Works offline once the dictionary is downloaded
- **Smart search** with real-time suggestions
- **Rich definitions** with grammar support
- Integrated Myanmar font rendering
- Built-in grammar lookup tools

## Features

- Optimized for fast client-side rendering
- Efficient indexing for large-scale dictionary search
- Structured dataset (57,000+ words, 100,000+ definitions)
- Designed for responsive web usage
- Custom Myanmar font handling

| Category        | Details                                                                 |
|-----------------|-------------------------------------------------------------------------|
| Grammar         | Instant Myanmar [grammar][grammar] lookup                               |
| Fonts           | Integrated Myanmar [fonts][fonts] support                               |
| Apps            | Available on the [App Store][appstore], [Google play][playStore].       |

```bash
git clone https://github.com/khensolomon/myordbok.git
```

## Development

A single-page HTML5 app (PWA) in plain JavaScript modules with JSDoc, served
by a Cloudflare Worker with D1. No framework and no bundler; Node 22.13+ and
wrangler are the only tools. Tauri desktop and mobile builds reuse the same
code through platform adapters (see [docs/architecture.md](docs/architecture.md)).

```bash
make install              # wrangler only
make db-reset             # local D1: app tables + a small made-up sample dictionary
make api                  # worker + local D1 on :8787
make dev                  # app on :8000, no build step, /api proxied to :8787
```

`make` lists every command. Anything that changes Cloudflare or GitHub is a
dry run unless `APPLY=1` is given. Deployment, branches and releases are
described in [docs/deploy.md](docs/deploy.md).

## Privacy & Security

We value your privacy. Reading, searching and offline use need **no account**, so your search history stays with you. Signing in with Google or GitHub is optional and only used to like entries, suggest edits and comment. Google Analytics runs only after visitors allow it. For a detailed breakdown of how data is handled, see the [Privacy Policy](https://myordbok.com/privacy).

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

[appStore]: https://apps.apple.com/us/app/myordbok/id1570959654
[playStore]: https://play.google.com/store/apps/details?id=com.myordbok.app

[home]: //myordbok.com
[grammar]: //myordbok.com/grammar
[fonts]: //myordbok.com/myanmar-fonts
