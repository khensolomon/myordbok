# MyOrdbok — common tasks. Run `make` to list them.
#
# Anything that changes something remote (Cloudflare, GitHub) is a dry run
# unless APPLY=1 is given. Local commands never touch remote data.

WRANGLER := npx wrangler
APP      := myordbok-app
APPLY    ?=
DATA     := node scripts/data.js
# Where exported edits are written; keep it outside this public repository.
OUT      ?= exports

.DEFAULT_GOAL := help
.PHONY: help install dev api db-migrate data-sample data-local db-reset test build build-beta build-tauri \
        version dataset-sync db-status db-migrate-remote data-setup data-status data-beta data-live data-publish data-stats data-packs data-promote edits-export data-switch \
        grant deploy-beta deploy-live logs-beta logs-live release clean \
        backup-deploy backup-now backup-list backup-pull restore sponsors-import data-release

help: ## List the commands
	@awk 'BEGIN {FS = ":.*## "} /^## / {printf "\n\033[1m%s\033[0m\n", substr($$0, 4)} /^[a-z-]+:.*## / {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

## Local development

install: ## Install tools (wrangler)
	npm ci

dev: ## App on :8000 from source, /api proxied to :8787
	node scripts/serve.js

api: build ## Worker + local D1 on :8787 (builds dist/web first)
	$(WRANGLER) dev --local --port 8787

db-migrate: ## Create or update the local app database
	$(WRANGLER) d1 migrations apply $(APP) --local

data-sample: ## Load the sample dictionary into the local myordbok-live
	$(WRANGLER) d1 execute LIVE --local --yes --file assets/db/seed.dev.sql

data-local: ## Load a real build into the local myordbok-live: FILE=…/build/myordbok.sql
	@test -n "$(FILE)" || { echo 'Give FILE=path/to/build/myordbok.sql'; exit 1; }
	$(WRANGLER) d1 execute LIVE --local --yes --file "$(FILE)"

db-reset: ## Delete the local databases, then migrate and load the sample
	rm -rf .wrangler/state/v3/d1
	$(MAKE) db-migrate data-sample

## Checks and builds

test: ## Run the test suite
	npm test

build: ## Live build → dist/web, minified (NOMINIFY=1 keeps the files as written)
	node scripts/build.js $(if $(NOMINIFY),--no-minify)

build-beta: ## Beta build → dist/web, marked noindex
	node scripts/build.js --noindex

build-tauri: ## Tauri build → dist/tauri (needs the Tauri adapters)
	node scripts/build.js --target tauri

version: ## Next version + CHANGELOG entry: NOTE="…" [APPLY=1]
	@test -n "$(NOTE)" || { echo 'Give NOTE="what changed"'; exit 1; }
	node scripts/version.js --note "$(NOTE)" $(if $(APPLY),--apply)

dataset-sync: ## Copy the lookup code from the dataset, check the sample: DATASET=…/myordbok [APPLY=1]
	@test -n "$(DATASET)" || { echo 'Give DATASET=path/to/lai/myordbok (branch dataset)'; exit 1; }
	node --disable-warning=ExperimentalWarning scripts/dataset-sync.js --dataset "$(DATASET)" $(if $(filter 1,$(APPLY)),--apply)

## App database on Cloudflare (dry run unless APPLY=1)

db-status: ## Remote migrations: applied and pending (read-only)
	$(WRANGLER) d1 migrations list $(APP) --remote --env beta

db-migrate-remote: ## Apply pending migrations to myordbok-app on Cloudflare [APPLY=1]
ifeq ($(APPLY),1)
	$(WRANGLER) d1 migrations apply $(APP) --remote --env beta
else
	$(WRANGLER) d1 migrations list $(APP) --remote --env beta
	@echo 'Dry run. Add APPLY=1 to apply. This database also serves live.'
endif

## Dictionary data (dry run unless APPLY=1; LOCAL=1 for the local databases)

data-setup: ## Create myordbok-app, myordbok-beta and myordbok-live if missing, write their ids into wrangler.toml [APPLY=1]
	$(DATA) setup $(if $(filter 1,$(APPLY)),--apply)

data-status: ## The build in each dictionary database, what each site reads, edits by status
	$(DATA) status $(if $(LOCAL),--local)

data-beta: ## Release a build to beta: offline packs, then publish with statistics: FILE=… [APPLY=1]
	@test -n "$(FILE)" || { echo 'Give FILE=path/to/build/myordbok.sql'; exit 1; }
	$(DATA) beta --file "$(FILE)" $(if $(filter 1,$(APPLY)),--apply) $(if $(LOCAL),--local)

data-live: ## Promote the build beta previews to live (the file data-beta used) [FILE=…] [APPLY=1]
	$(DATA) live $(if $(FILE),--file "$(FILE)") $(if $(filter 1,$(APPLY)),--apply) $(if $(LOCAL),--local)

data-publish: ## Step: a build → myordbok-beta, checked; beta previews it: FILE=… [APPLY=1]
	@test -n "$(FILE)" || { echo 'Give FILE=path/to/build/myordbok.sql'; exit 1; }
	$(DATA) publish --file "$(FILE)" $(if $(filter 1,$(APPLY)),--apply) $(if $(LOCAL),--local)

data-stats: ## A build's statistics → myordbok-app, for the workspace: FILE=… [APPLY=1]
	@test -n "$(FILE)" || { echo 'Give FILE=path/to/build/myordbok.db (or .sql)'; exit 1; }
	$(DATA) stats --file "$(FILE)" $(if $(filter 1,$(APPLY)),--apply) $(if $(LOCAL),--local)

data-packs: ## Step: offline packs of a build → R2 myordbok/offline/: FILE=… [PACKS_OUT=dir] [APPLY=1] [LOCAL=1]
	@test -n "$(FILE)" || { echo 'Give FILE=path/to/build/myordbok.db (or .sql)'; exit 1; }
	node --no-warnings scripts/packs.js --file "$(FILE)" $(if $(PACKS_OUT),--out "$(PACKS_OUT)") $(if $(filter 1,$(APPLY)),--apply) $(if $(LOCAL),--local)

data-promote: ## Step: the build beta previews → myordbok-live for live: FILE=… [APPLY=1]
	@test -n "$(FILE)" || { echo 'Give FILE=path/to/build/myordbok.sql (the build beta previews)'; exit 1; }
	$(DATA) promote --file "$(FILE)" $(if $(filter 1,$(APPLY)),--apply) $(if $(LOCAL),--local)

data-release: ## Approved edits → dataset scripts → build → (your yes) commit → beta: DATASET=../lai/myordbok [APPLY=1]
	node --disable-warning=ExperimentalWarning scripts/data-release.js --dataset "$(or $(DATASET),../lai/myordbok)" $(if $(filter 1,$(APPLY)),--apply) $(if $(LOCAL),--local)

edits-export: ## Approved workspace edits → dataset patch files in OUT=… [APPLY=1]
	$(DATA) export --out "$(OUT)" $(if $(filter 1,$(APPLY)),--apply) $(if $(LOCAL),--local)

grant: ## Give a member a role by sign-in email: EMAIL=… ROLE=member|editor|admin|owner [APPLY=1]
	@test -n "$(EMAIL)" -a -n "$(ROLE)" || { echo 'Give EMAIL=address ROLE=member|editor|admin|owner'; exit 1; }
	$(DATA) grant --email "$(EMAIL)" --role $(ROLE) $(if $(filter 1,$(APPLY)),--apply) $(if $(LOCAL),--local)

data-switch: ## Repairs only: point SITE=beta|live at TO=beta|live [APPLY=1]
	@test -n "$(SITE)" -a -n "$(TO)" || { echo 'Give SITE=beta|live TO=beta|live'; exit 1; }
	$(DATA) switch --env $(SITE) --to $(TO) $(if $(filter 1,$(APPLY)),--apply) $(if $(LOCAL),--local)

## Backups of myordbok-app (docs/deploy.md, Backups; dry run unless APPLY=1)

BACKUP_CFG := -c backup/wrangler.toml
BACKUPS    := node --disable-warning=ExperimentalWarning scripts/backup.js

backup-deploy: ## Deploy the weekly backup Worker myordbok-backup [APPLY=1]
	$(WRANGLER) deploy $(BACKUP_CFG) $(if $(filter 1,$(APPLY)),,--dry-run)
	@test "$(APPLY)" = 1 || echo 'Dry run. Add APPLY=1 to deploy.'

backup-now: ## Back up myordbok-app now, besides the weekly one [APPLY=1]
ifeq ($(APPLY),1)
	$(WRANGLER) workflows trigger myordbok-backup $(BACKUP_CFG)
	@echo 'Started; it takes a minute or two. Then: make backup-list'
else
	@echo 'Dry run. Add APPLY=1 to start a backup now.'
endif

backup-list: ## The backups kept, newest first (read-only) [LOCAL=1]
	$(BACKUPS) list $(if $(LOCAL),--local)

backup-pull: ## Copy a backup off Cloudflare: OUT=dir [BACKUP=name, else the newest]
	@test -n "$(OUT)" || { echo 'Give OUT=dir, outside this repository'; exit 1; }
	$(BACKUPS) pull --out "$(OUT)" $(if $(BACKUP),--backup "$(BACKUP)") $(if $(LOCAL),--local)

restore: ## Put back rows that are gone: TABLE=… [WHERE="…"] [BACKUP=name|file.sql.gz] [SHOW=n] [APPLY=1] [LOCAL=1]
	@test -n "$(TABLE)" || { echo 'Give TABLE=name, e.g. TABLE=comments WHERE="id = 42"'; exit 1; }
	$(BACKUPS) restore --table "$(TABLE)" $(if $(WHERE),--where "$(WHERE)") $(if $(BACKUP),--backup "$(BACKUP)") $(if $(SHOW),--show $(SHOW)) $(if $(filter 1,$(APPLY)),--apply) $(if $(LOCAL),--local)

## Supporters

sponsors-import: ## Once: the old sponsors.json into myordbok-app (workspace → Sponsors): FILE=… [APPLY=1] [LOCAL=1]
	@test -n "$(FILE)" || { echo 'Give FILE=path/to/sponsors.json, outside this repository'; exit 1; }
	node --disable-warning=ExperimentalWarning scripts/sponsors.js import --file "$(FILE)" $(if $(filter 1,$(APPLY)),--apply) $(if $(LOCAL),--local)

## Deploy (dry run unless APPLY=1)

deploy-beta: test ## Build and deploy beta.myordbok.com [APPLY=1]
	node scripts/build.js --noindex
	$(WRANGLER) deploy --env beta $(if $(filter 1,$(APPLY)),,--dry-run)
	@test "$(APPLY)" = 1 || echo 'Dry run. Add APPLY=1 to deploy.'

deploy-live: test ## Build and deploy myordbok.com — cutover only [APPLY=1]
	node scripts/build.js $(if $(NOMINIFY),--no-minify)
	$(WRANGLER) deploy --env live $(if $(filter 1,$(APPLY)),,--dry-run)
	@test "$(APPLY)" = 1 || echo 'Dry run. Add APPLY=1 to deploy. This replaces the live site.'

logs-beta: ## Stream the logs of beta as they happen
	$(WRANGLER) tail --env beta

logs-live: ## Stream the logs of live as they happen
	$(WRANGLER) tail --env live

## Release

release: ## Fast-forward master to dev, keeping dev ahead [APPLY=1]
	@git fetch --quiet origin +refs/heads/dev:refs/remotes/origin/dev +refs/heads/master:refs/remotes/origin/master
	@test -z "$$(git status --porcelain)" || { echo 'Commit or stash changes first.'; exit 1; }
	@test "$$(git rev-parse HEAD)" = "$$(git rev-parse origin/dev)" || { echo 'Check out dev and make sure it is pushed and up to date.'; exit 1; }
	@git merge-base --is-ancestor origin/master origin/dev || { echo 'master has commits that dev lacks; merge master into dev first.'; exit 1; }
	@echo "Commits going to master:"; git log --oneline origin/master..origin/dev
ifeq ($(APPLY),1)
	npm test
	git push origin refs/remotes/origin/dev:refs/heads/master
else
	@echo 'Dry run. Add APPLY=1 to release.'
endif

clean: ## Remove build output (local database kept)
	rm -rf dist
