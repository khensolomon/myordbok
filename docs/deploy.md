# Deploying to Cloudflare

MyOrdbok runs as a Cloudflare Worker with static assets and one D1 database.

| Environment | Domain | Deployed from | D1 |
|---|---|---|---|
| local | localhost | `make api` | local SQLite file |
| beta | beta.myordbok.com | every push to `dev` | `myordbok` (shared) |
| production | myordbok.com | push to `master`, once switched on | `myordbok` (shared) |

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

### 2. Database

The D1 database `myordbok` (`526dfd31-5d80-40ce-82aa-8f9c94e27456`) already
exists and is set in `wrangler.toml`.

```bash
npx wrangler login          # once, in a browser
make db-status              # lists applied and pending migrations
make db-migrate-remote      # dry run: shows what would be applied
make db-migrate-remote APPLY=1
```

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
make db-migrate db-seed     # first time only: local database
make api                    # terminal 1: worker + local D1 on :8787
make dev                    # terminal 2: app on :8000
```

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

## Cutover

1. Freeze edits on the Django site and run the final data migration into D1.
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
- Local commands (`make api`, `make db-*`) use a SQLite file under
  `.wrangler/` and never reach the remote database. A fresh clone has no
  access to real data.
- Never commit API tokens; they live only in GitHub environment secrets and
  in `npx wrangler login` on the maintainer's machine.
