# MyOrdbok — common tasks. Run `make` to list them.
#
# Anything that changes something remote (Cloudflare, GitHub) is a dry run
# unless APPLY=1 is given. Local commands never touch remote data.

WRANGLER := npx wrangler
DB       := myordbok
APPLY    ?=
DATA     := node scripts/data.js
# Where exported edits are written; keep it outside this public repository.
OUT      ?= exports

.DEFAULT_GOAL := help
.PHONY: help install dev api db-migrate data-sample data-local db-reset test build build-beta build-tauri \
        version dataset-sync db-status db-migrate-remote data-setup data-status edits-export data-publish data-switch \
        deploy-beta deploy-production logs-beta release clean

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
	$(WRANGLER) d1 migrations apply $(DB) --local

data-sample: ## Load the sample dictionary into the local slot A
	$(WRANGLER) d1 execute DICT_A --local --yes --file assets/db/seed.dev.sql

data-local: ## Load a real build into the local slot A: FILE=…/build/myordbok.sql
	@test -n "$(FILE)" || { echo 'Give FILE=path/to/build/myordbok.sql'; exit 1; }
	$(WRANGLER) d1 execute DICT_A --local --yes --file "$(FILE)"

db-reset: ## Delete the local databases, then migrate and load the sample
	rm -rf .wrangler/state/v3/d1
	$(MAKE) db-migrate data-sample

## Checks and builds

test: ## Run the test suite
	npm test

build: ## Production build → dist/web
	node scripts/build.js

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
	$(WRANGLER) d1 migrations list $(DB) --remote --env beta

db-migrate-remote: ## Apply pending migrations to the shared remote D1 [APPLY=1]
ifeq ($(APPLY),1)
	$(WRANGLER) d1 migrations apply $(DB) --remote --env beta
else
	$(WRANGLER) d1 migrations list $(DB) --remote --env beta
	@echo 'Dry run. Add APPLY=1 to apply. This database also serves production.'
endif

## Dictionary data (dry run unless APPLY=1; LOCAL=1 for the local databases)

data-setup: ## Create the dictionary databases and write their ids into wrangler.toml [APPLY=1]
	$(DATA) setup $(if $(filter 1,$(APPLY)),--apply)

data-status: ## Which build each slot holds and each site reads; edits by status
	$(DATA) status $(if $(LOCAL),--local)

edits-export: ## Approved studio edits → dataset patch files in OUT=… [APPLY=1]
	$(DATA) export --out "$(OUT)" $(if $(filter 1,$(APPLY)),--apply) $(if $(LOCAL),--local)

data-publish: ## Import a build into the free slot, check it, point beta at it: FILE=… [APPLY=1]
	@test -n "$(FILE)" || { echo 'Give FILE=path/to/build/myordbok.sql'; exit 1; }
	$(DATA) publish --file "$(FILE)" $(if $(filter 1,$(APPLY)),--apply) $(if $(LOCAL),--local)

data-switch: ## Point a site at a slot: SITE=production|beta [SLOT=a|b] [APPLY=1]
	@test -n "$(SITE)" || { echo 'Give SITE=production (promote beta) or SITE=beta SLOT=a|b (roll back)'; exit 1; }
	$(DATA) switch --env $(SITE) $(if $(SLOT),--slot $(SLOT)) $(if $(filter 1,$(APPLY)),--apply) $(if $(LOCAL),--local)

## Deploy (dry run unless APPLY=1)

deploy-beta: test ## Build and deploy beta.myordbok.com [APPLY=1]
	node scripts/build.js --noindex
	$(WRANGLER) deploy --env beta $(if $(filter 1,$(APPLY)),,--dry-run)
	@test "$(APPLY)" = 1 || echo 'Dry run. Add APPLY=1 to deploy.'

deploy-production: test ## Build and deploy myordbok.com — cutover only [APPLY=1]
	node scripts/build.js
	$(WRANGLER) deploy --env production $(if $(filter 1,$(APPLY)),,--dry-run)
	@test "$(APPLY)" = 1 || echo 'Dry run. Add APPLY=1 to deploy. This replaces the live site.'

logs-beta: ## Stream live logs from beta
	$(WRANGLER) tail --env beta

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
