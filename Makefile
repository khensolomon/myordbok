# MyOrdbok — common tasks. Run `make` to list them.
#
# Anything that changes something remote (Cloudflare, GitHub) is a dry run
# unless APPLY=1 is given. Local commands never touch remote data.

WRANGLER := npx wrangler
DB       := myordbok
APPLY    ?=

.DEFAULT_GOAL := help
.PHONY: help install dev api db-migrate db-seed db-reset test build build-beta build-tauri \
        version db-status db-migrate-remote deploy-beta deploy-production logs-beta release clean

help: ## List the commands
	@awk 'BEGIN {FS = ":.*## "} /^## / {printf "\n\033[1m%s\033[0m\n", substr($$0, 4)} /^[a-z-]+:.*## / {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

## Local development

install: ## Install tools (wrangler)
	npm ci

dev: ## App on :8000 from source, /api proxied to :8787
	node scripts/serve.js

api: build ## Worker + local D1 on :8787 (builds dist/web first)
	$(WRANGLER) dev --local --port 8787

db-migrate: ## Create or update the local database
	$(WRANGLER) d1 migrations apply $(DB) --local

db-seed: ## Add sample entries to the local database
	$(WRANGLER) d1 execute $(DB) --local --file db/seed.dev.sql

db-reset: ## Delete the local database, then migrate and seed
	rm -rf .wrangler/state/v3/d1
	$(MAKE) db-migrate db-seed

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

## Cloudflare (dry run unless APPLY=1)

db-status: ## Remote migrations: applied and pending (read-only)
	$(WRANGLER) d1 migrations list $(DB) --remote --env beta

db-migrate-remote: ## Apply pending migrations to the shared remote D1 [APPLY=1]
ifeq ($(APPLY),1)
	$(WRANGLER) d1 migrations apply $(DB) --remote --env beta
else
	$(WRANGLER) d1 migrations list $(DB) --remote --env beta
	@echo 'Dry run. Add APPLY=1 to apply. This database also serves production.'
endif

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
