# LSAT Tracker tasks. Requires Python 3.11+ and Node.js 22.13+.
#
#   make run    install dependencies, build the web app and start it on http://127.0.0.1:8613
#   make dev    run the API and the Vite dev server, both reloading on changes
#   make test   run the backend and frontend test suites
#
# Run `make help` to list every target.

PORT ?= 8613
HOST ?= 127.0.0.1
WEB_PORT ?= 5183

BACKEND := backend
FRONTEND := frontend
VENV := $(BACKEND)/.venv
VENV_PYTHON := $(VENV)/bin/python
PY_STAMP := $(VENV)/.requirements-installed
NODE_STAMP := $(FRONTEND)/node_modules/.package-lock-installed

# The first interpreter on PATH that is Python 3.11 or newer. Override with PYTHON=/path/to/python3.
ifndef PYTHON
PYTHON := $(shell for candidate in python3 python3.14 python3.13 python3.12 python3.11; do \
	if command -v $$candidate >/dev/null 2>&1 && \
		$$candidate -c 'import sys; sys.exit(sys.version_info < (3, 11))' >/dev/null 2>&1; then \
		echo $$candidate; break; \
	fi; \
done)
endif

.DEFAULT_GOAL := help
.PHONY: help install run dev build test test-backend test-frontend lint check sample-pdf clean

help: ## List the available targets
	@echo "Usage: make <target> [PORT=$(PORT)]"
	@echo
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "} {printf "  %-12s %s\n", $$1, $$2}'

install: $(PY_STAMP) $(NODE_STAMP) ## Install backend and frontend dependencies

$(PY_STAMP): $(BACKEND)/requirements.txt $(BACKEND)/requirements-dev.txt
	@if [ ! -x $(VENV_PYTHON) ]; then \
		if [ -z "$(PYTHON)" ]; then \
			echo "Python 3.11 or newer is required: https://www.python.org/downloads/"; \
			echo "If it is installed under another name, run for example: make run PYTHON=python3.12"; \
			exit 1; \
		fi; \
		echo "Creating $(VENV) with $$($(PYTHON) --version)"; \
		$(PYTHON) -m venv $(VENV) || { \
			echo "Could not create a virtual environment. On Debian or Ubuntu, install python3-venv."; \
			exit 1; \
		}; \
	fi
	$(VENV_PYTHON) -m pip install --disable-pip-version-check --quiet -r $(BACKEND)/requirements-dev.txt
	@touch $@

$(NODE_STAMP): $(FRONTEND)/package.json $(FRONTEND)/package-lock.json
	@command -v npm >/dev/null 2>&1 || { echo "Node.js 22.13 or newer is required: https://nodejs.org/"; exit 1; }
	@node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 13)) { console.error("Node.js 22.13 or newer is required; found " + process.versions.node + "."); process.exit(1); }'
	cd $(FRONTEND) && npm ci --no-audit --no-fund
	@touch $@

build: $(NODE_STAMP) ## Build the web app into frontend/dist
	cd $(FRONTEND) && npm run build

run: $(PY_STAMP) build ## Install what is missing, build the web app and start the server
	cd $(BACKEND) && exec .venv/bin/python -m lsat_tracker serve --host $(HOST) --port $(PORT)

dev: $(PY_STAMP) $(NODE_STAMP) ## Run the API and the Vite dev server with hot reload
	@echo "Web app with hot reload: http://localhost:$(WEB_PORT)  (API on http://$(HOST):$(PORT)/api)"
	@(cd $(BACKEND) && exec .venv/bin/python -m lsat_tracker serve --host $(HOST) --port $(PORT) --reload) & \
	api=$$!; \
	trap 'kill $$api 2>/dev/null' EXIT INT TERM; \
	cd $(FRONTEND) && API_PORT=$(PORT) npm run dev -- --port $(WEB_PORT)

test: test-backend test-frontend ## Run all backend and frontend tests

test-backend: $(PY_STAMP)
	cd $(BACKEND) && .venv/bin/python -m pytest

test-frontend: $(NODE_STAMP)
	cd $(FRONTEND) && npm test

lint: $(PY_STAMP) $(NODE_STAMP) ## Lint and format-check the backend and frontend
	cd $(BACKEND) && .venv/bin/ruff check . && .venv/bin/ruff format --check .
	cd $(FRONTEND) && npm run lint

check: lint test build ## Run everything CI runs: lint, tests and a production build

sample-pdf: $(PY_STAMP) ## Write a synthetic score report to sample-report.pdf to try uploads
	cd $(BACKEND) && .venv/bin/python -m tests.synthetic_report ../sample-report.pdf

clean: ## Remove the virtual environment, node_modules, build output and caches
	rm -rf $(VENV) $(FRONTEND)/node_modules $(FRONTEND)/dist $(BACKEND)/.pytest_cache $(BACKEND)/.ruff_cache
	find $(BACKEND) -type d -name __pycache__ -prune -exec rm -rf {} +
