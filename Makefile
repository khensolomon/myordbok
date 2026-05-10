.DEFAULT_GOAL := help
.PHONY: help production development clean stop docker django run mysqldump args

# Conditionally include .env if it exists, to prevent errors in production environments
ifneq (,$(wildcard ./.env))
  include .env
  export
endif

# --- CONFIGURATION ---
# Check if docker.production.yml exists
PROD_CONF := $(wildcard docker.production.yml)
PROD_FLAG := $(if $(PROD_CONF),-f $(PROD_CONF),)

# Capture all arguments after the first word
EXTRA_ARGS = $(filter-out $@,$(MAKECMDGOALS))

# --- HELP MENU ---
help: ## Show this help menu with all available commands
	@echo "-----------------------------------------------------------------------"
	@echo "   ZAIDEIH CONSOLE (2026)"
	@echo "-----------------------------------------------------------------------"
	@grep -E '^[a-zA-Z][a-zA-Z0-9_-]*:.*## ' Makefile | sort | awk 'BEGIN {FS = ":.*## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Usage Examples:"
	@echo "  make django migrate"
	@echo "  make django makemigrations api"
	@echo "  make run frontend npm install"
	@echo "  make stop -v"
	@echo "-----------------------------------------------------------------------"


r2: ## Run the r2.py script with any additional arguments (e.g., 'make r2 -- arg1 arg2')
	@python ~/dev/lets/server/r2.py $(EXTRA_ARGS)

secrets: ## Run the secrets.py script with any additional arguments (e.g., 'make secrets -- --check')
	python ~/dev/lets/server/secrets.py $(EXTRA_ARGS)

# Generate .env from origin.env if it doesn't exist
env: ## Load environment variables from origin.env (if it exists) and export them for use in the Makefile
	~/dev/notes/scripts/env.sh ./origin.env

# --- CORE COMMANDS ---
compose-build: ## Build Docker images before starting containers
	@echo "=> Building assets..."
	@npm run build
	@echo "=> Starting Docker containers..."
	@docker compose up -d $(EXTRA_ARGS)

compose-clean: ## Clean up Docker containers and volumes
	@echo "=> Cleaning up Docker containers and volumes..."
	@docker compose down -v $(EXTRA_ARGS)

compose-nuke: ## Nuclear option: Stop containers, remove volumes, and prune all images
	@echo "=> Removing all unused images..."
	@docker image prune -a
	@echo "=> Full nuclear cleanup of everything Docker-related..."
	@docker system prune -a --volumes

production: ## Production Mode: Uses base + prod (if exists)
	docker compose -f docker-compose.yml $(PROD_FLAG) up -d $(EXTRA_ARGS)
	@echo "Running in Production Mode (Prod config detected: $(if $(PROD_CONF),Yes,No))"

development: ## Development Mode: Uses base + dev config
	docker compose -f docker-compose.yml -f docker.development.yml up -d $(EXTRA_ARGS)
	docker compose exec web python manage.py makemigrations
	docker compose exec web python manage.py migrate
	@echo "Running in Development Mode"


clean: # Stop, remove volumes, and clean up images
	@echo "Stopping containers and wiping volumes..."
	docker compose down -v --remove-orphans
	@echo "Pruning unused docker resources..."
	docker system prune -f --filter "label=com.docker.compose.project=$(shell basename $(CURDIR))"
	@echo "Cleanup complete."

stop: ## Stop all running containers. Supports args like -v
	docker compose down $(EXTRA_ARGS) -v

# --- DYNAMIC RUNNERS ---
# docker compose exec web python manage.py migrate
docker: ## Docker Compose: Run any docker compose command (e.g., 'make docker ps')
	docker compose $(EXTRA_ARGS)

django: ## Django Manage: Run any command (e.g., 'make django shell')
	docker compose exec web python manage.py $(EXTRA_ARGS)

run: ## Docker Run: Run a command in a specific service (e.g., 'make run frontend npm install')
	docker compose run --rm $(EXTRA_ARGS)

mysqldump: ## MySQL Dump: Run mysqldump in the database service
# 	mysqldump -u $(DB_USER) -p $(DB_NAME) > $(STORAGE_ROOT)/$(APP_NAME)/mysql/latest.sql
	@echo "mysqldump -u $(DB_USER) -p $(DB_NAME) > $(DB_DIR)/latest.sql"

collectstatic: ## Build frontend and collect static files (for production)
	npm run build
	python manage.py collectstatic --noinput

ssh-dev: ## SSH into the development container
	ssh $(SSH_USER)@$(SSH_HOST)

# --- UTILITY / TESTING ---

args: ## Test Variable: Pass a specific arg (e.g., 'make args args=hello')
	@echo "Hello! Test args is running with the argument: $(args)"

# --- THE MAGIC GUARD ---
# This prevents 'make' from throwing an error for the extra arguments passed
%:
	@: