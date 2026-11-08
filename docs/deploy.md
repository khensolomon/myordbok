# Deploying to Cloudflare

MyOrdbok runs as a Cloudflare Worker with static assets and three D1
databases:

| Database | Binding | Holds | Changed by |
|---|---|---|---|
| `myordbok` | `DB` | members, sign-in, reactions, comments, studio edits, which slot each site reads | the app; migrations in `assets/db/migrations` |
| `myordbok-dict-a` | `DICT_A` | the dictionary, one release | `make data-publish` |
| `myordbok-dict-b` | `DICT_B` | the dictionary, the other release | `make data-publish` |

| Environment | Domain | Deployed from | Dictionary |
|---|---|---|---|
| local | localhost | `make api` | local slot A: the public sample, or a build you load |
| beta | beta.myordbok.com | every push to `dev` | the slot named for beta in `dict_release` |
| production | myordbok.com | push to `master`, once switched on | the slot named for production |

All three databases are shared by beta and production.

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

The app database `myordbok` (`526dfd31-5d80-40ce-82aa-8f9c94e27456`) already
exists and is set in `wrangler.toml`. Create the two dictionary slots; the
command reuses databases that already exist and writes their ids into
`wrangler.toml` for the top level, beta and production:

```bash
npx wrangler login          # once, in a browser
make data-setup             # dry run: shows what exists and what would be created
make data-setup APPLY=1
git commit -am "Dictionary database ids"   # ids are identifiers, not secrets
```

Then the app tables:

```bash
make db-status              # lists applied and pending migrations
make db-migrate-remote      # dry run: shows what would be applied
make db-migrate-remote APPLY=1
```

If `0001_init.sql` from 26.11.7 was applied to `myordbok` before, its tables
are still there: `make db-status` shows `0001_init.sql` as applied and
`0001_app.sql` as pending. That early schema held no real data, so the
simplest fix is to empty the database and start clean (Cloudflare dashboard →
D1 → myordbok → Console):

```sql
DROP TABLE IF EXISTS changes; DROP TABLE IF EXISTS suggestions;
DROP TABLE IF EXISTS comments; DROP TABLE IF EXISTS reactions;
DROP TABLE IF EXISTS role_grants; DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS identities; DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS emd_sense; DROP TABLE IF EXISTS med_sense;
DROP TABLE IF EXISTS eng_word; DROP TABLE IF EXISTS mya_word;
DROP TABLE IF EXISTS word_type; DELETE FROM d1_migrations;
```

then `make db-migrate-remote APPLY=1` again.

Finally publish the first dictionary (see [Data releases](#data-releases)).
Until then beta answers `/api/lookup` with "No dictionary has been published".

Beta and production read the same database, so every migration must keep
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

Locally the Worker reads slot A (`DICT_SLOT = "a"` in `wrangler.toml`). It
holds the public sample from `assets/db/seed.dev.sql`, a few made-up entries
with the real tables. To work with the real dictionary on your machine:

```bash
make data-local FILE=../lai/myordbok/build/myordbok.sql   # about 10 seconds
make data-sample                                          # back to the sample
```

The local databases live under `.wrangler/`, which git ignores.

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

## Data releases

The dictionary is built from the TSV files of the private dataset
(`khensolomon/lai`, branch `dataset`, folder `myordbok/`). The TSV files are
the source of truth; D1 only ever receives a complete build, never a partial
change. A release goes into the slot no site reads, is checked there, and
only then does a site switch to it, so a failed import never reaches readers.

```bash
# In the dataset checkout
python3 scripts/db_build.py --apply          # build/myordbok.sql, 75 search checks

# Here
make data-status                             # what each slot holds, what each site reads
make data-publish FILE=../lai/myordbok/build/myordbok.sql            # dry run
make data-publish FILE=../lai/myordbok/build/myordbok.sql APPLY=1    # import, check, point beta at it
# look at beta.myordbok.com
make data-switch SITE=production APPLY=1     # production follows beta
```

`data-publish` imports into the free slot (`--file` replaces every table),
checks each table against the row counts the build wrote into `meta`, points
beta at it, and marks studio edits that the build now contains as merged.
It refuses to start while beta and production read different slots, so
there is never a third version in play.

Rollback: `make data-switch SITE=production SLOT=a APPLY=1` (or `SITE=beta`)
points a site back at the previous release, which is still intact in the
other slot. Sites pick up a switch within 30 seconds.

When the dataset changes its lookup code (`search/search.mjs`,
`search/search.sql`), copy it here; the same command checks that the public
sample still has the build's tables and columns:

```bash
make dataset-sync DATASET=../lai/myordbok            # dry run
make dataset-sync DATASET=../lai/myordbok APPLY=1    # writes shared/search/
```

## Studio edits

Corrections, additions and deletions made in the studio never touch the
dictionary tables. Each is a row in `dict_edits` (app database) and moves
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

Before writing, each edit's old value is compared with the dictionary the
sites read. One that no longer matches (someone changed the sense since)
becomes a `conflict` with the reason, instead of a patch line the dataset
script would reject. Successive edits of one field are joined into one line.

After the dataset scripts apply the files, commit the dataset, build, and
publish as above; the publish marks the edits `merged`. Readers see an
approved edit from that release on, not before.

`OUT` must be outside this repository (the default `exports/` is ignored by
git), because exported files hold dataset text.

## Cutover

1. Freeze edits on the Django site, then publish a dictionary release built
   from the final dataset and switch production to it.
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
  The data commands without `LOCAL=1` act on Cloudflare and need your
  `wrangler login`; CI never runs them.
- Never commit API tokens; they live only in GitHub environment secrets and
  in `npx wrangler login` on the maintainer's machine.
