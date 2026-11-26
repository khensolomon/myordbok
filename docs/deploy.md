# Deploying to Cloudflare

MyOrdbok runs as a Cloudflare Worker with static assets and three D1
databases, each with one fixed role:

| Database | Binding | Holds | Changed by |
|---|---|---|---|
| `myordbok-app` | `APP` | members, sign-in, reactions, comments, workspace edits, which dictionary database each site reads; backed up weekly ([Backups](#backups)) | the app; migrations in `assets/db/migrations` |
| `myordbok-beta` | `BETA` | the newest dictionary build; beta previews it | `make data-publish` |
| `myordbok-live` | `LIVE` | the dictionary live readers get | `make data-promote` |

| Environment | Domain | Deployed from | Reads the dictionary from |
|---|---|---|---|
| local | localhost | `make api` | the local `myordbok-live`: the public sample, or a build loaded by hand |
| beta | beta.myordbok.com | every push to `dev` | `myordbok-beta` |
| live | myordbok.com | push to `master`, after approval | `myordbok-live` (`myordbok-beta` only while a promotion runs) |

Both sites are bound to all three databases; `dict_release` in
`myordbok-app` records which dictionary database each one reads.

Beta stays up permanently as the test site.

## What to do

Every `make` command here is a dry run until `APPLY=1` is added. `make`
alone lists them all.

### Updating the dictionary

The TSV files of the private dataset (`khensolomon/lai`, branch `dataset`,
folder `myordbok/`) are the source of truth. Text moves in two directions,
and both end the same way: beta first, then live.

```text
 workspace edits ──► TSV            TSV ──► beta ──► live
 (myordbok-app)      (lai)          (lai)   (myordbok-beta)  (myordbok-live)
   make data-release                  db_build.py + make data-beta, then make data-live
```

> [!IMPORTANT]
> **Workspace → TSV** (edits approved in the workspace or made in the
> studio). One command writes them into the TSV files, builds, and puts the
> build on beta:
>
> ```bash
> make data-release              # dry run: the edits, any conflicts
> make data-release APPLY=1      # → TSV, build, the diff to confirm, commit, push, beta
> make data-live APPLY=1         # after checking beta.myordbok.com
> ```
>
> Details: [One command: make data-release](#one-command-make-data-release).
> Edits an admin or owner approved are already shown to readers
> ([Live edits](#live-edits)); the release makes them permanent.

> [!IMPORTANT]
> **TSV → sites** (the TSV files changed in the dataset itself, by hand or
> by its scripts). Build there, then publish from here:
>
> ```bash
> # in the dataset checkout (../lai/myordbok)
> python3 scripts/db_build.py --apply
>
> # here
> make data-beta FILE=../lai/myordbok/build/myordbok.sql APPLY=1
> make data-live APPLY=1         # after checking beta.myordbok.com
> ```
>
> Details: [Dictionary releases](#dictionary-releases).

> [!NOTE]
> Run `make data-release` before changing the TSV files by hand when edits
> wait in the workspace: an edit made against text the dataset has since
> changed becomes a conflict. `make data-status` shows the build each site
> reads and how many edits wait.

### Everything else

| To | Run | Details |
|---|---|---|
| work on the app locally | `make db-reset` once, then `make api` and `make dev` | [Daily work](#daily-work) |
| put code on beta | push to `dev` | [Daily work](#daily-work) |
| record a version | `make version NOTE="…" APPLY=1` | [Daily work](#daily-work) |
| see which build each site reads | `make data-status` | [Dictionary releases](#dictionary-releases) |
| change one word's meanings from the site | Workspace → Studio | [The studio](#the-studio) |
| show an approved edit to readers now | approve it as admin or owner, or **Make live** | [Live edits](#live-edits) |
| undo a dictionary release | build the earlier dataset commit and release it | [Dictionary releases](#dictionary-releases) (Rollback) |
| apply a database migration | `make db-migrate-remote APPLY=1` | [Databases](#2-databases) |
| give a member a level | Workspace → Members; `make grant EMAIL=… ROLE=… APPLY=1` in an emergency | [Sign-in](#sign-in) |
| get deleted rows back | `make restore TABLE=… WHERE="…"` | [Restoring rows](#restoring-rows) |
| take a backup now | `make backup-now APPLY=1` | [Backups](#backups) |
| watch the logs | `make logs-beta`, `make logs-live` | |
| release code to live | `make release APPLY=1`, then approve in GitHub | [Branches and releases](#branches-and-releases) |
| put back an earlier code version | Workers & Pages → myordbok-live → Deployments | [Branches and releases](#branches-and-releases) |

## One-time setup

### 1. Domain

1. Confirm the `myordbok.com` zone is active in the Cloudflare dashboard
   (DNS is managed by Cloudflare).
2. In **DNS → Records**, delete any existing record named `beta`. The Worker
   creates its own record for `beta.myordbok.com` on first deploy and fails
   if one already exists.
3. `myordbok.com` is a custom domain of the Worker `myordbok-live`. A
   Worker cannot take a domain while a DNS record of that name exists.

### 2. Databases

One command creates whichever of the three databases are missing (existing
ones are reused) and writes their ids into `wrangler.toml` for the top level,
beta and live:

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
live (see [Dictionary releases](#dictionary-releases)). Until then the
API answers lookups with "No dictionary has been released to beta" (or
live).

Beta and live share `myordbok-app`, so every migration must keep
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
2. Create environment **live**:
   - Deployment branches: `master` only.
   - Required reviewers: the maintainer (each live deploy waits for
     approval).
   - The same two secrets.

Then **Settings → Secrets and variables → Actions → Variables**:
`LIVE_ENABLED` set to `true` lets a push to `master` deploy live; any
other value holds live deploys back.

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

Google, GitHub and Apple sign-in (`worker/routes/auth.js`,
`worker/lib/apple.js`). One GitHub OAuth App
serves beta, live and local development (localhost is one of its
callbacks), so its secret is also in the maintainer's `.dev.vars`. One Google
OAuth client serves beta and live, and a separate one local
development.

| Provider | Callback URLs registered |
|---|---|
| GitHub app "MyOrdbok" | `https://beta.myordbok.com/api/auth/github/callback`, `https://myordbok.com/api/auth/github/callback` (wildcard matching off, device flow off) |
| Google client (web) | `https://beta.myordbok.com/api/auth/google/callback`, `https://myordbok.com/api/auth/google/callback` |
| GitHub app, also | `http://localhost:8787/api/auth/github/callback` |
| Google local client | `http://localhost:8787/api/auth/google/callback` |

Client ids are public and live in `wrangler.toml` (`GITHUB_CLIENT_ID`,
`GOOGLE_CLIENT_ID`; Apple's `APPLE_SIGNIN_SERVICE_ID`, `APPLE_SIGNIN_KEY_ID`,
`APPLE_TEAM_ID`). Secrets never enter the repository:

```bash
npx wrangler secret put GITHUB_CLIENT_SECRET --env beta
npx wrangler secret put GOOGLE_CLIENT_SECRET --env beta
npx wrangler secret put GITHUB_CLIENT_SECRET --env live
npx wrangler secret put GOOGLE_CLIENT_SECRET --env live
npx wrangler secret put APPLE_SIGNIN_KEY --env beta < AuthKey_<key id>.p8
npx wrangler secret put APPLE_SIGNIN_KEY --env live < AuthKey_<key id>.p8
```

Sign in with Apple, at developer.apple.com (Certificates, Identifiers &
Profiles): the App ID `com.myordbok.app` with Sign In with Apple, as the
primary App ID; the Services ID `com.myordbok.web`, configured with the
domains `myordbok.com`, `beta.myordbok.com` and their return URLs
`https://<domain>/api/auth/apple/callback` (Apple takes no localhost, so
Apple is tried on beta); a key with Sign in with Apple, whose `.p8` is
`APPLE_SIGNIN_KEY`. Without all four values Apple is not offered.

Apple is meant to be removable. The setting **Sign in with Apple**
(workspace Settings, `signin.apple`): **On**; **Existing accounts only**,
where members who already use Apple still sign in and their Account page
asks them to add Google or GitHub, and no new account or link uses Apple;
**Off**, where it is not offered. Members → Sign-in → **Apple only** shows
who would be locked out. Before ending the Apple Developer membership: a
few weeks on Existing accounts only, then Off, then the secret and the
wrangler.toml values removed. An email Apple relays (Hide My Email) is
neither stored nor matched, so those members link other providers from
their Account page while signed in.

Locally: `make db-migrate`, copy
`.dev.vars.example` to `.dev.vars` and fill in the secrets, then `make api`.
Sign in from `http://localhost:8787` or from the dev server on :8000; either
way the sign-in ends on :8787, the registered callback. Use `localhost`, not
`127.0.0.1`: cookies and the registered callbacks are on `localhost`.

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

Every file in `assets/db/migrations/` is applied the same way, to
`myordbok-app` on Cloudflare and locally: `make db-migrate-remote APPLY=1`
and `make db-migrate`. Each file says at its top what it adds. Apply a
migration before the code that uses it reaches beta or live; until then
only the features that use its tables fail.

The build statistics the workspace shows are kept by `make data-publish`
for each build; `make data-stats FILE=…/build/myordbok.db APPLY=1` keeps
them for a build published without them.

On a new site, after signing in once, make yourself owner; owners then give
and take every level in the workspace (Members), and `make grant` remains
for emergencies:

```bash
make grant EMAIL=you@example.com ROLE=owner            # dry run
make grant EMAIL=you@example.com ROLE=owner APPLY=1
```

The sign-in buttons follow `GET /api/site` (`signin`): the providers
configured, and Apple unless its setting is Off.

How members are recognised: a provider account seen before is its member; a
second provider used while signed in is linked to that member; otherwise a
verified email that a member already has links the new provider account to
that member, so one person keeps one account. Unverified emails are neither
stored nor matched. A suspended member cannot sign in, and their sessions
stop working at once. Sessions last 30 days and are stored only as hashes.

The app signs in through the website (`worker/routes/link.js`): it shows a
code (ABCD-EFGH) and opens the chosen sign-in in the system browser, coming
back to `myordbok.com/link?code=…`, where the member sees which kind of
device asks and links it or cancels. The app asks after its code every few
seconds with a secret of its own and, once linked, is given a session token
sent as `Authorization: Bearer …`, kept a year. Codes last ten minutes. The
Account page lists linked devices, each removable; signing out in the app
ends its session too. Linking and removing work while the site is read-only.

Google keeps the consent screen in **Testing** until it is published: only
the test users listed there can sign in. Google deletes OAuth clients unused
for six months.

## Daily work

```bash
make db-reset               # first time: local app database + sample dictionary
make api                    # terminal 1: worker + local D1 on :8787
make dev                    # terminal 2: app on :8000
```

Locally the Worker reads the local `myordbok-live`
(`DICT_DB = "live"` in `wrangler.toml`). `make db-reset` fills it with
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
committed straight to `master` would break the fast-forward, and so would a
pull request merged into `master` on GitHub: merge pull requests into `dev`.

A push to `master` deploys live once the deploy is approved in GitHub
(environment **live**).

A bad version on live is put back from **Workers & Pages → myordbok-live →
Deployments**, which lists every version; then the fix is made on `dev` and
released again.

## Dictionary releases

TSV → sites. The dictionary is built from the TSV files of the private dataset
(`khensolomon/lai`, branch `dataset`, folder `myordbok/`). The TSV files are
the source of truth; D1 only ever receives a complete build, never a partial
change. A build reaches readers in two steps: beta first, then live.

```bash
# In the dataset checkout
python3 scripts/db_build.py --apply          # build/myordbok.sql, after its search checks

# Here
make data-status                                                  # the build in each database, who reads it
make data-beta FILE=../lai/myordbok/build/myordbok.sql            # dry run
make data-beta FILE=../lai/myordbok/build/myordbok.sql APPLY=1    # packs → R2, then → myordbok-beta; beta previews it
# check beta.myordbok.com
make data-live APPLY=1                                            # the same build → myordbok-live; live gets it
```

**data-beta** uploads the build's offline packs first, so beta never lists a
build whose packs are missing, then publishes it (below). It remembers the
file in `~/.local/state/myordbok/release.json` (outside the repository).
**data-live** promotes that file (below), and refuses when the file changed
after it went to beta: a rebuilt file goes through beta again. `FILE=…`
names another file, which must still be the build beta previews. The steps
also run on their own: `data-packs`, `data-publish`, `data-promote`.

**Publish** imports the build into `myordbok-beta` (`--file` replaces every
table), checks each table against the row counts the build wrote into
`meta`, points beta at it, and marks workspace edits the build now contains as
merged. Live is not touched; a failed import only affects beta.

**Promote** takes the build beta previews to live without a moment
where readers have nothing to read:

1. Live reads `myordbok-beta`, which holds the same build, and the
   command waits 35 seconds until no Worker still reads `myordbok-live`.
2. The build is imported into `myordbok-live` and checked.
3. Live reads `myordbok-live` again (within 30 seconds).

The file must be the build beta previews; any other is refused. If a
promotion stops part way (network, a failed check), live simply keeps
reading `myordbok-beta`, and nothing new can be published until the same
`make data-promote … APPLY=1` is run again and finishes. `make data-status`
says when that is the case.

**Rollback** is a release of the previous build: build it from the earlier
dataset commit, publish, check beta, promote. For an emergency on live
alone, D1 Time Travel restores `myordbok-live` to a moment before the
promotion (`npx wrangler d1 time-travel restore myordbok-live
--timestamp=… --env beta`); the dictionary is unavailable while it restores.

`make data-switch SITE=beta|live TO=beta|live` points one site
at one database by hand, for repairs only.

When the dataset changes its lookup code (`search/search.mjs`,
`search/search.sql`), copy it here. The command first runs the dataset's
lookup on the sample and refuses one that lacks what the app relies on (a
sense id on every entry; the unary `+` in `similar` and `broader`), then
checks that the public sample still has the build's tables and columns:

```bash
make dataset-sync DATASET=../lai/myordbok            # dry run
make dataset-sync DATASET=../lai/myordbok APPLY=1    # writes shared/search/
```

## Workspace edits

Workspace → TSV. Corrections, additions and deletions made in the workspace never touch the
dictionary tables; they reach the dictionary through the dataset, built and
released like any other change.

### The studio

Workspace → **Studio** (editors, admins, owners) lists the words that have
edits (all, those no release holds yet, those live), and searching it adds
the dictionary's own words, so any word can be opened. A word opens with
every meaning on a sheet: its part of speech, its status or label (every
row of `type_sense`), its text and its example can be changed, the meaning
removed, and a new one added. Save sends each change as an edit, the same
edits the ✎ form on an entry makes, so review, live edits and the release
treat them alike; `emd_edit.py` and `med_edit.py` apply part of speech as
`wrte` and status as `wrkd`. Under the sheet is the word's history: every
edit, by whom, and where it stands.

- A change to a meaning that has an approved change waiting for the release
  is refused until an admin makes that one live, or the release is run: the
  two would be in conflict.
- An added meaning is a draft and has no id until a release, so its status
  is changed after that release.
- A new Myanmar headword needs its pronunciation and is added in the
  dataset.

### Live edits

An approved edit can be shown to readers before that release: the Worker
lays it over the build when an entry is read (`worker/lib/layer.js`,
migration 0014). The dataset stays the source, and the release below is
unchanged; the layer only covers the wait.

- **Who.** An admin's or owner's approval makes an edit live, as does their
  own change. An editor's approval, or own change, waits for the release; an
  admin can make it live from Suggestions (**Make live**), or take a live
  one off again (**Take off the site**).
- **When readers see it.** Within about five minutes: the layer is read
  again every 30 seconds, and an answer is cached for up to five minutes.
- **When it leaves the layer.** Once the build a site reads contains it.
  Live keeps showing it from the layer between `make data-beta` and
  `make data-live`. An edit the release finds in conflict leaves at once.
- **Safe by construction.** An edit applies only where the build still
  holds the text it was made against, the rule the release follows, so a
  build that already has it, or a dataset that moved on, is shown as built.
- **Limits.** The copy on a device, the search suggestions and the
  statistics follow the release: a headword only the layer has opens when
  searched in full, but is not suggested while typing. At most 2,000 edits
  are live at once; a release empties the layer.
- **Switch.** Settings → Contributions → **Live edits** off shows the build
  alone; edits stay marked and show again when it is turned on.

### One command: make data-release

```bash
make data-release                    # dry run: the edits, conflicts, and each dataset script without --apply
make data-release APPLY=1            # applies, builds, shows the diff, asks, then commits, pushes and publishes to beta
# check beta.myordbok.com
make data-live APPLY=1               # live, as for any release
```

`DATASET=` names the dataset checkout's `myordbok` folder (default
`../lai/myordbok`); it must be on branch `dataset`, clean, and not behind
`origin/dataset`. The release (`scripts/data-release.js`):

1. exports the approved edits into the dataset scripts' input files,
   checked against what live readers see (conflicts stay in the
   workspace, with the reason);
2. runs each file through its dataset script, first without `--apply`;
3. applies them, writes a CHANGELOG entry in the dataset's style, and runs
   `scripts/db_build.py --apply` with its search checks;
4. shows the dataset's diff and asks **Commit to the dataset, push and
   publish to beta?** A no, or any failure up to here, puts the dataset back
   as it was and marks no edit;
5. on yes: commits (`Workspace edits, export NNNN: …`) and pushes the
   dataset, marks the edits exported, builds again so the build names that
   commit, and runs the same steps as `make data-beta`.

The dataset changes only through its own scripts; the release runs them in
order and writes nothing else but the CHANGELOG entry. Releasing needs
live to have the build beta previews, as exporting does. The
workspace Overview shows editors how many approved edits wait, and when beta
is ahead of live.

### Step by step

The steps also run on their own. Each edit is a row in `dict_edits` (`myordbok-app`) and moves
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
`myordbok-live`, what live readers see; the export waits while
beta previews a build that is not promoted yet. An edit whose old value no
longer matches (the sense changed since)
becomes a `conflict` with the reason, instead of a patch line the dataset
script would reject. Successive edits of one field are joined into one line.

After the dataset scripts apply the files, commit the dataset, build, publish
and promote as above; the publish marks the edits `merged`. Beta shows an
approved edit from that publish on, live from the promotion.

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

`make sponsors-import` brings in a list of supporters kept as a
`sponsors.json` file (the format of the earlier site), from a copy outside
the repository:

```bash
make sponsors-import FILE=~/sponsors.json          # dry run: each donor, shown or anonymous
make sponsors-import FILE=~/sponsors.json APPLY=1
rm ~/sponsors.json
```

A donor marked as consenting whose note says they wish to remain anonymous
is imported as anonymous; the dry run lists them, to check with each one.

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

### What search engines read

The app builds its pages in the browser, and not every reader runs scripts:
Google does, in a second pass; most other crawlers and link previews do
not. So the Worker writes into the definition page what it is about, before
sending it (`worker/routes/page.js`), the same for every reader:

- **A title, a description and one sentence** in the page:
  “love” in Myanmar (noun, verb): ချစ်ခြင်း, ချစ်ခင်မှု, ချစ်သူ, …
  (`shared/summary.js`). The parts of speech are named once and the meanings
  follow as one run of plain words: the first 2 of each part, at most 12
  words or phrases, with no labels, examples, forms, statuses, or mark of
  where one meaning ends. The app replaces the sentence with the entry.
- **One address per headword** (`rel="canonical"`), however it was typed.
- **No entry** answers 404 and is not indexed; phrases, sentences, sums and
  questions are sent as they are and not indexed. Beta is never indexed.
- **The same limit as the API**: page requests count towards the heavy rate
  limit; over it, the page goes out without the sentence.
- **A sitemap** of every headword that has meanings: `/sitemap.xml` lists
  `/sitemap/en-1.xml`, `/sitemap/my-1.xml` and so on, 25,000 addresses to a
  file, made from the dictionary the site reads and kept at the edge for a
  day, so it follows each data release by itself (`worker/routes/sitemap.js`).
- **`/robots.txt`**: on live, everything but `/api/`, `/workspace` and
  `/account`, and the sitemap's address; on beta and locally, nothing.
- **Addresses of the earlier site** are redirected: `/dictionary` and
  `/dictionary/…` to the home page, `/cookie-policy` to `/privacy`,
  `/health` to `/api/health`.

The entry itself (examples, forms, related words, statuses, ids) is only in
the API, which answers the app's own pages. What the sentence gives away is
the price of being found: anything a search engine can read, a script can.

### The API

The API serves the app, not the public. On beta and live
(`API_GUARD = "1"` in `wrangler.toml`; `worker/lib/guard.js`):

- **Own pages only.** A request must carry `Sec-Fetch-Site: same-origin`,
  which browsers set and web pages cannot. Other websites and scripts that
  leave the header out get 403. A script can forge the header, so this keeps
  the API to the app in browsers; the limits below are what slow a script.
  Browsers older than about 2023 (Safari before iOS 16.4) do not send the
  header; for them a `Referer` on the site itself counts instead.
- **Rate limits per visitor (IP address)**, counted by Cloudflare at each
  location: 120 a minute for lookups, suggestions and the rest
  (`RATE_LOOKUP`); 40 a minute for `read`, `phrase` and `spelling`, which
  read many rows each, and for `messages`, `pronunciation`, `quiz` and
  `help`, which write or fetch from elsewhere (`RATE_HEAVY`). Over the limit: 429, and the app says to wait a minute. Change
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

Writes: every `POST` must carry the site's own `Origin`, or the app's
`X-MyOrdbok-App` header; those a member makes also need the session cookie
(HttpOnly, Secure, SameSite=Lax). The app sends no cookie, and a page on
another site cannot send the app's header without a CORS preflight, which
the Worker never answers.

## The app

The MyOrdbok app for iOS and Android is `src-tauri/` (Tauri 2) holding the
build of `app/` (`node scripts/build.js --target tauri --api …`). It takes
over the store listings of the earlier Flutter app: package name and bundle
ID `com.myordbok.app` (Play, App Store id1570959654).

### Building

Through the Run workflow (below): `google build apk`, `google build bundle`
or `apple build testflight` (the App workflow, `app.yml`, does the build).
The run tests, builds the app's files, then the app, and leaves it among
the run's artifacts:

- **test-apk** (`google build apk`), asking beta or live: `myordbok-<server>-<version>-test.apk`,
  signed with a key made for the run. It installs on a phone for testing
  (allow installing from the browser or file manager) and cannot update an
  install from Play.
- **play-aab** (`google build bundle`), always asking live:
  `myordbok-play-<version>.aab`, signed with the upload key, kept as the
  run's artifact, then, with `--apply`, put on the track asked for (closed
  testing, Alpha, unless another) by `scripts/play-upload.js` (the Play Developer
  API, as the secret `GOOGLE_PLAY_ACCOUNT`, below): the testers' Play Store
  offers it as an update once Play has reviewed it; a release still in
  review there is replaced. Refused (Google not knowing a new service account
  yet answers 403 for up to a day), the artifact is uploaded by hand: Play
  Console → the app → **Test and release** → closed testing → Alpha →
  **Create new release**. Play accepts each version code once: the next bundle comes
  from a later version (`make release`).
- **ios-testflight** (`apple build testflight`), asking beta or live: the iOS app, built on GitHub's
  Xcode 27 image (`runs-on: xcode-27`; the run stops unless the iOS SDK is
  27 or later, which App Store Connect requires from April 2027), signed
  and uploaded to App Store Connect. When Apple asks for a newer SDK, the
  label and the Rust cache key move to the next Xcode image together. After Apple's processing
  (minutes to an hour, with an email) it is under **TestFlight**, to install
  on an iPhone with the TestFlight app; the same build is the one submitted
  for review. Each build number is accepted once, as on Play.

The run's **Use workflow from** list picks the branch: `dev` builds what is
not yet released.

Version: the store version is the site's date part (`26.11.21`); the
Android version code is 1000 plus the build number (`scripts/app-config.js`),
above every Flutter upload (44) and rising with every release.

### Play service account

The upload to closed testing, the store listing, and later the server's check of in-app
purchases, sign in as one Google service account:

1. Google Cloud Console: a project with the **Google Play Android Developer
   API** enabled; a service account; its JSON key.
2. Play Console (the account's home, not the app) → **Users and
   permissions** → **Invite new users**: the service account's email
   (`client_email` in the key); **App permissions** → MyOrdbok: Release apps
   to testing tracks; View financial data; Manage orders and subscriptions.
3. The repository's secret `GOOGLE_PLAY_ACCOUNT`: the whole JSON key.

Checked without uploading: `GOOGLE_PLAY_ACCOUNT="$(cat key.json)" node
scripts/play-upload.js some.aab` signs in, opens an edit and deletes it.

### Tools: the Run workflow

Every tool is a command, described once in `shared/commands.js`: its
words, its fields, whether it changes anything, where it runs and the only
secrets it gets. GitHub → **Actions → Run → Run workflow**, and paste the
command into **Command** (the workspace builds it; `node scripts/run.js
list` lists them all). GitHub signs the person in and checks they may run
the repository's workflows; the run then checks the command word by word
(`scripts/run.js plan`) and stops on anything not in its description,
before a secret is handed out or a store touched. A command that changes
something only shows the change unless it ends in `--apply`.

| Command | Does |
|---|---|
| `google status` | What every Play track holds |
| `google build apk` / `bundle` | A test APK; the Play bundle onto a track (`--track`, `--rollout`, `--notes`; sent with `--apply`) |
| `google release promote` | A tested release onto another track without building (`--from alpha --to production --rollout 20`) |
| `google release rollout` / `halt` / `resume` | A staged rollout widened (100 completes it), stopped, started again |
| `google listing` | The listing from `store/play/<language>/` (`--part texts|screenshots|icon|feature`) |
| `apple status` | Versions, builds and in-app purchases |
| `apple build testflight` | The iOS app to TestFlight |
| `apple listing` | Texts and screenshots from `store/app-store/en-US/`; makes the version when none is being prepared |
| `apple review build` / `submit` | The build chosen for the version; sent for review (`--release manual|after-approval`) |
| `apple release` | The approved version released |

The same line runs on a computer of one's own with the secrets in the
environment: `make run CMD="google status"`.

The files and each store's limits are listed at the top of
`scripts/play-listing.js` and `scripts/app-store.js`. Screenshots are taken
of the app with `make store-shots` (`scripts/store-shots.mjs`), the icon
drawn with `node scripts/app-icon.js render` (one design: iOS, Android's
adaptive icon, Play).

The App Store key needs the App Manager or Admin role for the listing and
the review. Two things stay in App Store Connect itself: the App Privacy
answers, and a first in-app purchase, which goes for review only with a
version, chosen on that version's page (so that first submission is made
there; `submit` says so).

### Play upload key

Play builds (an AAB) are signed with the upload key, kept as repository
secrets. The Flutter app's upload key is lost, so Play has to accept a new
one first (Play Console → the app → **Test and release → App integrity →
App signing → Request upload key reset**):

1. On a computer with a JDK, make the key, and keep the file and the
   passwords somewhere safe outside the repository:
   `keytool -genkeypair -v -keystore myordbok-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`
2. Export its certificate for Play:
   `keytool -export -rfc -keystore myordbok-upload.jks -alias upload -file upload_certificate.pem`
3. Request the reset with that `.pem`. Play answers within a few days. This
   needs Play App Signing on the app, which apps uploaded as AABs have.
4. Add the secrets (GitHub → Settings → Secrets and variables → Actions):
   `ANDROID_UPLOAD_KEYSTORE` (the `.jks` as base64: `base64 -w0 myordbok-upload.jks`),
   `ANDROID_UPLOAD_PASSWORD`, `ANDROID_UPLOAD_ALIAS`.

Play takes bundles signed with the new key from the date its email gives.
A **play-aab** run stops at its first step when a secret is missing or the
keystore does not open with them.

### App Store Connect API key

The iOS build signs and uploads through an App Store Connect API key (App
Store Connect → Users and Access → Integrations → App Store Connect API →
Team Keys, access **Admin**, so that Xcode may make the distribution
certificate and profile). Its three secrets: `APPLE_API_ISSUER` (the Issuer
ID above the keys table), `APPLE_API_KEY` (the Key ID) and
`APPLE_API_KEY_P8` (the text of the `.p8`, which Apple lets download once).
The team (`AY23P8UZ8P`) is in `src-tauri/tauri.conf.json`; it is no secret.

### Old builds

`APP_MIN` in `wrangler.toml` (per environment) is the lowest app build the
API still serves; an app below it shows **Update MyOrdbok** over everything,
with a link to its store. It stays `0` until a change to the API would break
an older app: then set it to the first build that works with the change,
and release the app before the Worker.

### What the app does differently

- The API through the HTTP plugin, naming the app in `X-MyOrdbok-App`
  (`android/26.11.21+161`); the guard lets it through within the same
  limits and logs it apart (`app` in `rate_limited`).
- Signing in links the app to the account on the website (Sign-in above);
  the workspace opens on the website.
- On iOS, no asking for gifts (`data-store-hidden`).
- No Google Analytics (the consent banner and Analytics belong to the
  website's hosts only).
- Links to other sites open in the system browser.
- A light haptic tap on the tabs, searching and the thumbs
  (tauri-plugin-haptics); no scrollbar drawn and no tap highlight
  (`html[data-app]`); the phone's own typeface; <body> scrolls, so the page
  bounces natively and the tab bar stays put; no keyboard accessory bar
  and no link preview on iOS (`tauri.conf.json`).

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

