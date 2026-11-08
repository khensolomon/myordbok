# Deploying to Cloudflare

MyOrdbok runs as a Cloudflare Worker with static assets and three D1
databases, each with one fixed role:

| Database | Binding | Holds | Changed by |
|---|---|---|---|
| `myordbok-app` | `APP` | members, sign-in, reactions, comments, studio edits, which dictionary database each site reads | the app; migrations in `assets/db/migrations` |
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
make data-status                                                     # the build in each database, who reads it
make data-publish FILE=../lai/myordbok/build/myordbok.sql            # dry run
make data-publish FILE=../lai/myordbok/build/myordbok.sql APPLY=1    # → myordbok-dataset; beta previews it
# check beta.myordbok.com
make data-promote FILE=../lai/myordbok/build/myordbok.sql APPLY=1    # → myordbok-dictionary; production gets it
```

**Publish** imports the build into `myordbok-dataset` (`--file` replaces every
table), checks each table against the row counts the build wrote into
`meta`, points beta at it, and marks studio edits the build now contains as
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

## Studio edits

Corrections, additions and deletions made in the studio never touch the
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

## Cutover

1. Freeze edits on the Django site, then publish and promote a dictionary
   build made from the final dataset.
2. In GitHub, set the variable `PRODUCTION_ENABLED` to `true`.
3. In Cloudflare DNS, delete the `myordbok.com` record that points to the
   Django site (the Worker creates its own).
4. `make release APPLY=1`. The production job waits for approval, then
   deploys to myordbok.com.
5. Keep the Django site running read-only for a few weeks as a fallback.

Rollback: **Workers & Pages → myordbok-production → Deployments** lists every
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
