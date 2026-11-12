# Deploying to Cloudflare

MyOrdbok runs as a Cloudflare Worker with static assets and three D1
databases, each with one fixed role:

| Database | Binding | Holds | Changed by |
|---|---|---|---|
| `myordbok-app` | `APP` | members, sign-in, reactions, comments, workspace edits, which dictionary database each site reads; backed up weekly ([Backups](#backups)) | the app; migrations in `assets/db/migrations` |
| `myordbok-dataset` | `DATASET` | the newest dictionary build; beta previews it | `make data-publish` |
| `myordbok-dictionary` | `DICTIONARY` | the dictionary production readers get | `make data-promote` |

| Environment | Domain | Deployed from | Reads the dictionary from |
|---|---|---|---|
| local | localhost | `make api` | the local `myordbok-dictionary`: the public sample, or a build loaded by hand |
| beta | beta.myordbok.com | every push to `dev` | `myordbok-dataset` |
| production | myordbok.com | push to `master`, once switched on | `myordbok-dictionary` (`myordbok-dataset` only while a promotion runs) |

Both sites are bound to all three databases; `dict_release` in
`myordbok-app` records which dictionary database each one reads.

Until cutover, myordbok.com keeps serving the previous Django site and
`master` keeps its code. Beta stays up permanently as the test site.

## One-time setup

### 1. Domain

1. Confirm the `myordbok.com` zone is active in the Cloudflare dashboard
   (DNS is managed by Cloudflare).
2. In **DNS → Records**, delete any existing record named `beta`. The Worker
   creates its own record for `beta.myordbok.com` on first deploy and fails
   if one already exists.
3. Leave the `myordbok.com` record alone until cutover.

### 2. Databases

One command creates whichever of the three databases are missing (existing
ones are reused) and writes their ids into `wrangler.toml` for the top level,
beta and production:

```bash
npx wrangler login          # once, in a browser
make data-setup             # dry run: shows what exists and what would be created
make data-setup APPLY=1
git commit -am "Database ids" && git push   # ids are identifiers, not secrets
```

Then the app tables:

```bash
make db-status              # lists applied and pending migrations
make db-migrate-remote      # dry run: shows what would be applied
make db-migrate-remote APPLY=1
```

Finally release the first dictionary: publish it to beta and promote it to
production (see [Dictionary releases](#dictionary-releases)). Until then the
API answers lookups with "No dictionary has been released to beta" (or
production).

Beta and production share `myordbok-app`, so every migration must keep
working with the code currently on both. Add columns and tables; remove or
rename only after both environments run code that no longer needs them.

### 3. API token for GitHub Actions

1. Dashboard → **My Profile → API Tokens → Create Token**.
2. Start from the **Edit Cloudflare Workers** template.
3. Add the permission **Account → D1 → Edit**.
4. **Account resources:** only the MyOrdbok account. **Zone resources:**
   only `myordbok.com`.
5. Create the token and copy it (it is shown once).
6. Note the **Account ID** (dashboard home → right-hand panel, or
   `npx wrangler whoami`).

If the first deploy fails with a permission error while creating the custom
domain, add **Zone → DNS → Edit** to the token.

### 4. GitHub

In the repository, **Settings → Environments**:

1. Create environment **beta**:
   - Deployment branches: selected branches, `dev` only.
   - Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
2. Create environment **production**:
   - Deployment branches: `master` only.
   - Required reviewers: the maintainer (each production deploy waits for
     approval).
   - The same two secrets.

Then **Settings → Secrets and variables → Actions → Variables**: leave
`PRODUCTION_ENABLED` unset until cutover.

Recommended under **Settings → Branches**: protect `master` (no force push,
no deletion, status check "Test and build" must pass).

### 5. First beta deploy

Push to `dev`. The workflow tests, builds with `noindex`, and deploys to
beta.myordbok.com. To check from a terminal first:

```bash
make deploy-beta            # dry run: builds and validates the upload
make deploy-beta APPLY=1    # real deploy from this machine
```

## Sign-in

Google and GitHub sign-in (`worker/routes/auth.js`). One GitHub OAuth App
serves beta, production and local development (localhost is one of its
callbacks), so its secret is also in the maintainer's `.dev.vars`. One Google
OAuth client serves beta and production, and a separate one local
development.

| Provider | Callback URLs registered |
|---|---|
| GitHub app "MyOrdbok" | `https://beta.myordbok.com/api/auth/github/callback`, `https://myordbok.com/api/auth/github/callback` (wildcard matching off, device flow off) |
| Google client (web) | `https://beta.myordbok.com/api/auth/google/callback`, `https://myordbok.com/api/auth/google/callback` |
| GitHub app, also | `http://localhost:8787/api/auth/github/callback` |
| Google local client | `http://localhost:8787/api/auth/google/callback` |

Client ids are public and live in `wrangler.toml` (`GITHUB_CLIENT_ID`,
`GOOGLE_CLIENT_ID`). Secrets never enter the repository:

```bash
npx wrangler secret put GITHUB_CLIENT_SECRET --env beta
npx wrangler secret put GOOGLE_CLIENT_SECRET --env beta
# the same with --env production at cutover
```

Locally: `make db-migrate` (the local app database needs 0002 too), copy
`.dev.vars.example` to `.dev.vars` and fill in the secrets, then `make api`.
Sign in from `http://localhost:8787` or from the dev server on :8000; either
way the sign-in ends on :8787, the registered callback. Use `localhost`, not
`127.0.0.1`: cookies and the registered callbacks are on `localhost`.

The app database needs migration 0002 (members' email) before sign-in works:
`make db-migrate-remote APPLY=1`.

Offline packs: once, create the bucket the packs live in. `make data-beta`
uploads each build's packs; on their own (a promotion needs none; the packs
are kept per build):

```bash
npx wrangler r2 bucket create myordbok               # once: every MyOrdbok file, private
make data-packs FILE=…/build/myordbok.db              # dry run: builds and reports sizes
make data-packs FILE=…/build/myordbok.db APPLY=1      # uploads to R2
```

Packs are written next to the build (`build/packs/<build>/`), never inside
this repository. Who may download the definitions is a setting admins
change in the workspace (Settings).

Every new file in `assets/db/migrations/` is applied the same way, on each
site's database and locally: `make db-migrate-remote APPLY=1` and
`make db-migrate`. 0003 adds ratings per meaning; 0004 adds search counts
(the workspace overview) and user 0, "Former member", which deleted
accounts' reviewed suggestions are moved to; 0005 adds the contact form's
messages (the Inbox) and site settings (offline access). 0006 gives messages
their states (unread, read, replied, done) and notes, and adds the build
statistics the workspace shows: `make data-publish` keeps them for each new
build; for the build already published, once: `make data-stats FILE=…/build/myordbok.db APPLY=1`.
0007 adds the owner level above admin; the first admin (the one who set the
site up) becomes owner. Owners give and take every level in the workspace
(Members); `make grant EMAIL=… ROLE=owner APPLY=1` remains for emergencies.

After signing in once, give the owner the admin role:

```bash
make grant EMAIL=you@example.com ROLE=admin            # dry run
make grant EMAIL=you@example.com ROLE=admin APPLY=1
```

How members are recognised: a provider account seen before is its member; a
second provider used while signed in is linked to that member; otherwise a
verified email that a member already has links the new provider account to
that member, so one person keeps one account. Unverified emails are neither
stored nor matched. A suspended member cannot sign in, and their sessions
stop working at once. Sessions last 30 days and are stored only as hashes.

Google keeps the consent screen in **Testing** until it is published: only
the test users listed there can sign in. Google deletes OAuth clients unused
for six months.

## Daily work

```bash
make db-reset               # first time: local app database + sample dictionary
make api                    # terminal 1: worker + local D1 on :8787
make dev                    # terminal 2: app on :8000
```

Locally the Worker reads the local `myordbok-dictionary`
(`DICT_DB = "dictionary"` in `wrangler.toml`). `make db-reset` fills it with
the public sample from `assets/db/seed.dev.sql`: a few made-up entries in the
real tables. For the real dictionary on the local machine:

```bash
make data-local FILE=../lai/myordbok/build/myordbok.sql   # about 10 seconds
make data-sample                                          # back to the sample
```

The local databases live under `.wrangler/`, which git ignores. Wrangler keys
each local database by its `database_id`, so after `make data-setup` changes
an id, the local copy starts empty: run `make db-reset` (and `make data-local`
for the real build) again.

Commit to `dev` and push; beta updates in about a minute. Record each change
in the changelog:

```bash
make version NOTE="Add Google sign-in"           # dry run
make version NOTE="Add Google sign-in" APPLY=1   # writes package.json and CHANGELOG.md
```

## Branches and releases

- `dev` is where work happens. It is always deployable and always on beta.
- `master` holds released versions only. Nothing is committed to it directly.
- A release fast-forwards `master` to `dev`. No merge commit is created, so
  `master` never has a commit that `dev` lacks: `dev` is either equal to
  `master` or ahead of it.

```bash
make release            # dry run: lists the commits that would go to master
make release APPLY=1    # runs the tests, then fast-forwards master
```

Fixes for a released version are made on `dev` and released again; a fix
committed straight to `master` would break the fast-forward.

Do not release to `master` before cutover: `master` still represents the
live Django site until then.

## Dictionary releases

The dictionary is built from the TSV files of the private dataset
(`khensolomon/lai`, branch `dataset`, folder `myordbok/`). The TSV files are
the source of truth; D1 only ever receives a complete build, never a partial
change. A build reaches readers in two steps: beta first, then production.

```bash
# In the dataset checkout
python3 scripts/db_build.py --apply          # build/myordbok.sql, 75 search checks

# Here
make data-status                                                  # the build in each database, who reads it
make data-beta FILE=../lai/myordbok/build/myordbok.sql            # dry run
make data-beta FILE=../lai/myordbok/build/myordbok.sql APPLY=1    # packs → R2, then → myordbok-dataset; beta previews it
# check beta.myordbok.com
make data-live APPLY=1                                            # the same build → myordbok-dictionary; production gets it
```

**data-beta** uploads the build's offline packs first, so beta never lists a
build whose packs are missing, then publishes it (below). It remembers the
file in `~/.local/state/myordbok/release.json` (outside the repository).
**data-live** promotes that file (below), and refuses when the file changed
after it went to beta: a rebuilt file goes through beta again. `FILE=…`
names another file, which must still be the build beta previews. The steps
also run on their own: `data-packs`, `data-publish`, `data-promote`.

**Publish** imports the build into `myordbok-dataset` (`--file` replaces every
table), checks each table against the row counts the build wrote into
`meta`, points beta at it, and marks workspace edits the build now contains as
merged. Production is not touched; a failed import only affects beta.

**Promote** takes the build beta previews to production without a moment
where readers have nothing to read:

1. Production reads `myordbok-dataset`, which holds the same build, and the
   command waits 35 seconds until no Worker still reads `myordbok-dictionary`.
2. The build is imported into `myordbok-dictionary` and checked.
3. Production reads `myordbok-dictionary` again (within 30 seconds).

The file must be the build beta previews; any other is refused. If a
promotion stops part way (network, a failed check), production simply keeps
reading `myordbok-dataset`, and nothing new can be published until the same
`make data-promote … APPLY=1` is run again and finishes. `make data-status`
says when that is the case.

**Rollback** is a release of the previous build: build it from the earlier
dataset commit, publish, check beta, promote. For an emergency on production
alone, D1 Time Travel restores `myordbok-dictionary` to a moment before the
promotion (`npx wrangler d1 time-travel restore myordbok-dictionary
--timestamp=… --env beta`); the dictionary is unavailable while it restores.

`make data-switch SITE=beta|production TO=dataset|dictionary` points one site
at one database by hand, for repairs only.

When the dataset changes its lookup code (`search/search.mjs`,
`search/search.sql`), copy it here; the same command checks that the public
sample still has the build's tables and columns:

```bash
make dataset-sync DATASET=../lai/myordbok            # dry run
make dataset-sync DATASET=../lai/myordbok APPLY=1    # writes shared/search/
```

## Workspace edits

Corrections, additions and deletions made in the workspace never touch the
dictionary tables. Each is a row in `dict_edits` (`myordbok-app`) and moves
through: `pending` → `approved` or `rejected` by an editor → `exported` →
`merged` (or `conflict`).

```bash
make edits-export OUT=../lai/myordbok/edits            # dry run: lists files and conflicts
make edits-export OUT=../lai/myordbok/edits APPLY=1    # writes export-NNNN/*.tsv
```

The files are in the dataset scripts' own formats, and the command prints how
to run each one:

| File | Dataset script |
|---|---|
| `emd_patch.tsv` | `scripts/emd_edit.py` |
| `emd_new.tsv`, `emd_more.tsv` | `scripts/emd_add.py`, `… --existing` |
| `med_patch.tsv` | `scripts/med_edit.py` |
| `med_new.tsv`, `med_more.tsv` | `scripts/med_add.py`, `… --existing` |

Before writing, each edit's old value is compared with
`myordbok-dictionary`, what production readers see; the export waits while
beta previews a build that is not promoted yet. An edit whose old value no
longer matches (the sense changed since)
becomes a `conflict` with the reason, instead of a patch line the dataset
script would reject. Successive edits of one field are joined into one line.

After the dataset scripts apply the files, commit the dataset, build, publish
and promote as above; the publish marks the edits `merged`. Beta shows an
approved edit from that publish on, production from the promotion.

`OUT` must be outside this repository (the default `exports/` is ignored by
git), because exported files hold dataset text.

## Backups

`myordbok-app` holds what cannot be rebuilt: members, comments, suggestions,
ratings, messages, settings. The dictionary databases are not backed up;
they are rebuilt from the dataset. Two layers protect `myordbok-app`:

| | Covers | Restores |
|---|---|---|
| D1 Time Travel | any minute of the last 30 days | the whole database, back to that minute |
| Weekly backup | each week, kept for 12 weeks (never fewer than 12 backups) | single rows that are gone |

Time Travel is for a disaster (a bad migration, a mass deletion): everything
after the chosen minute is lost, so it is the last resort. The weekly backup
is for the common case: a comment, a member or a suggestion deleted by
mistake, put back while everything written since stays.

### How it runs

A separate Worker, `myordbok-backup` (`backup/worker.js`,
`backup/wrangler.toml`), runs every Sunday at 20:17 UTC (02:47 on Monday in
Myanmar). It starts a Cloudflare Workflow that:

1. asks the D1 export API for a dump of `myordbok-app` and waits for it;
2. downloads it, gzips it, and stores it in the private bucket `myordbok` as
   `backup/myordbok-app/YYYY-MM-DD-HHMM.sql.gz` (UTC), with the export's Time
   Travel bookmark in the object's metadata;
3. deletes backups past the retention and writes
   `backup/myordbok-app/index.json`, the list of those kept.

Each step is retried on its own. Runs, failed or not, are in Cloudflare under
**Workers & Pages → Workflows → myordbok-backup**. The workspace Overview shows
administrators when the newest backup was made, and warns once it is more
than 8 days old. While the export runs (seconds for this database), D1
answers its queries more slowly.

### Setup (once)

1. An API token: **My Profile → API Tokens → Create Token → Custom token**,
   permission **Account · D1 · Edit**, for this account only. It is used for
   nothing else.
2. The Worker and its secrets:

```bash
make backup-deploy                  # dry run: bundles and lists the bindings
make backup-deploy APPLY=1
npx wrangler secret put ACCOUNT_ID -c backup/wrangler.toml        # the account id (dashboard, right side of Overview)
npx wrangler secret put D1_EXPORT_TOKEN -c backup/wrangler.toml   # the token from step 1
make backup-now APPLY=1             # the first backup, now
make backup-list                    # a minute or two later
```

CI does not deploy `myordbok-backup`; after a change to `backup/` or
`shared/backup.js`, run `make backup-deploy APPLY=1` again.

### Restoring rows

`make restore` puts back rows that are no longer in `myordbok-app`. It never
changes or deletes a row: a row in both the backup and the database that
differs (edited since, or its id taken by a newer row) is listed and left as
it is. It is a dry run unless `APPLY=1`.

```bash
make backup-list                                        # the backups kept
make restore TABLE=comments WHERE="id = 42"             # dry run, newest backup
make restore TABLE=comments WHERE="id = 42" APPLY=1
make restore TABLE=comments WHERE="user_id = 7" BACKUP=2026-11-15-2017
make restore TABLE=comments WHERE="id = 42" BACKUP=/srv/backups/myordbok/2026-11-15-2017.sql.gz
```

The backup is loaded into an in-memory SQLite database on this machine, so
`WHERE` is any SQLite condition on the backup's copy of the table; it never
reaches Cloudflare. Without `WHERE`, every row of the table that is gone
comes back, which is rarely what is wanted: check the dry run.

Rows that point at rows that are gone stop the restore. A deleted member's
comments need the member first:

```bash
make restore TABLE=users WHERE="id = 7" APPLY=1
make restore TABLE=identities WHERE="user_id = 7" APPLY=1   # their sign-in, so they can sign in again
make restore TABLE=comments WHERE="user_id = 7" APPLY=1
```

`sessions` is never restored (it would sign people back in). Columns added
since the backup take their defaults; columns removed since are left out and
listed. `LOCAL=1` works on the local database of `wrangler dev`, for trying a
restore out on a copy.

For a whole-database restore, Time Travel:

```bash
npx wrangler d1 time-travel info myordbok-app --env beta
npx wrangler d1 time-travel restore myordbok-app --timestamp=2026-11-15T20:00:00Z --env beta
```

A backup's metadata has the bookmark of the moment it was taken (R2 →
`myordbok` → the object → Metadata), usable as `--bookmark=…` within the 30
days.

### A copy outside Cloudflare

`make backup-pull OUT=dir` copies the newest backup into `dir` (or
`BACKUP=name` for another), checking that it unpacks. A copy already there
is left alone, so a daily cron on another machine collects each weekly
backup once:

```cron
# m h dom mon dow
40 6 * * *  cd /srv/myordbok && git pull -q && make -s backup-pull OUT=/srv/backups/myordbok
50 6 * * *  find /srv/backups/myordbok -name '*.sql.gz' -mtime +400 -delete
```

That machine needs Node 22.13 or newer, `npm ci` once, and wrangler signed
in to the account (`npx wrangler login`, or `CLOUDFLARE_API_TOKEN` with
**Account · Workers R2 Storage · Read**). `make restore BACKUP=/path/to/file.sql.gz`
restores from such a copy.

## Supporters

Supporters and their donations are kept in `myordbok-app` (tables `donors`
and `donations`, migration 0012) and managed by the owner in the workspace
under **Sponsors**: add a donor, tick whether their name may be shown on
the Support page, link their member account by id or sign-in email if they
have one, and add each donation as it arrives (the amount after fees, in US
dollars). The Support page shows totals and consenting names only.

The list used to be `docs/sponsors.json` in this repository. To move it in,
once, from a copy outside the repository:

```bash
git show <a commit that has it>:docs/sponsors.json > ~/sponsors.json
make db-migrate-remote APPLY=1                     # migration 0012
make sponsors-import FILE=~/sponsors.json          # dry run: each donor, shown or anonymous
make sponsors-import FILE=~/sponsors.json APPLY=1
rm ~/sponsors.json
```

A donor marked as consenting whose note says they wish to remain anonymous
is imported as anonymous; the dry run lists them, to check with each one.

## Cutover

1. Freeze edits on the Django site, then publish and promote a dictionary
   build made from the final dataset.
2. In GitHub, set the variable `PRODUCTION_ENABLED` to `true`.
3. In Cloudflare DNS, delete the `myordbok.com` record that points to the
   Django site (the Worker creates its own).
4. `make release APPLY=1`. The production job waits for approval, then
   deploys to myordbok.com.
5. Keep the Django site running read-only for a few weeks as a fallback.

Rollback: **Workers & Pages → myordbok → Deployments** lists every
version; any earlier one can be promoted again from there.

## Analytics

Google Analytics (`G-E74XPBN0S9`) loads only on `myordbok.com` and
`beta.myordbok.com`, and only after the visitor allows it. Beta traffic can be
separated in reports by hostname. Settings worth checking in the GA property:

- **Data retention:** choose the period and state it on the privacy page.
- **Google signals** and advertising features: off, as the privacy page says.

## Security notes

- `database_id` and the account ID are identifiers, not credentials. Remote
  access needs an API token or a login to the owning Cloudflare account.
- Local commands (`make api`, `make db-*`, `make data-sample`,
  `make data-local`) use SQLite files under `.wrangler/` and never reach the
  remote databases. A fresh clone has only the public sample.
- The real dictionary never enters this repository: builds come from the
  private dataset, and exported edits go to a folder outside the repository.
  The data commands without `LOCAL=1` act on Cloudflare and need a
  `wrangler login` to the owning account; CI never runs them.
- Never commit API tokens; they live only in GitHub environment secrets and
  in `npx wrangler login` on the maintainer's machine.

### The API

The API serves the app, not the public. On beta and production
(`API_GUARD = "1"` in `wrangler.toml`; `worker/lib/guard.js`):

- **Own pages only.** A request must carry `Sec-Fetch-Site: same-origin`,
  which browsers set and web pages cannot. Other websites and scripts that
  leave the header out get 403. A script can forge the header, so this keeps
  the API to the app in browsers; the limits below are what slow a script.
  Browsers older than about 2023 (Safari before iOS 16.4) do not send the
  header; for them a `Referer` on the site itself counts instead.
- **Rate limits per visitor (IP address)**, counted by Cloudflare at each
  location: 120 a minute for lookups and suggestions (`RATE_LOOKUP`), 40 a
  minute for `read`, `phrase` and `spelling` (`RATE_HEAVY`), which read many
  rows each. Over the limit: 429, and the app says to wait a minute. Change
  the numbers in `wrangler.toml`; each environment has its own counters.
- **Edge cache.** Dictionary answers are kept at the Cloudflare location for
  as long as their Cache-Control allows (5 minutes; spelling 1 hour), so a
  word asked again does not reach D1. After a dictionary release, answers can
  be that old for that long. Cached answers still count towards the limits.
- **Logs.** Refused and rate-limited requests are logged as
  `api_refused` and `rate_limited`, with the route, the country and, for the
  limit, a 12-digit hash of the address (never the address). Watch them with
  `make logs-beta`.
- `/api/health` holds no dictionary data and is open to monitoring, within
  the lookup limit.
- Local development runs without the guard. To try it:
  `npx wrangler dev --local --var API_GUARD:1`.

In the Cloudflare dashboard, **Security → Bots → Block AI bots** keeps AI
crawlers off the site. Leave Bot Fight Mode off: it can challenge the app's
own requests.

Still to come with sign-in: every route that writes requires the session
cookie (HttpOnly, Secure, SameSite=Lax) and a matching `Origin` header. A
native app (Tauri) will need its own way in, as it is not a same-origin page.

## Marker entries

A few entries or wordings that exist only in MyOrdbok make a copy of the
dictionary recognisable. They belong to the private data build, never to
this repository: add a handful of invented headwords, or unusual wordings in
real definitions, to the data, and keep the list of them in a private file
outside the repository (one per line; `#` starts a note). To check a
suspected copy, a saved page or dump, or a page on the web:

```bash
node scripts/markers.js --markers ~/private/myordbok-markers.txt --file suspect.html
node scripts/markers.js --markers ~/private/myordbok-markers.txt --url https://example.com/word/x
```

It prints the markers found and exits 3 when any is (0 when none). Keep the
markers few, plausible and harmless to a reader who meets one, and do not
change them between builds: a marker only proves something while it is in
every copy.

