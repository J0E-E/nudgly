# Nudgly

ADHD reminder and nudge app: tasks, lists, habits, and persistent nudges. Cross-platform (web + mobile via Capacitor).

## Epic 1: Project Setup & Infrastructure

- **Backend:** Django + DRF, PostgreSQL, Redis. Health endpoint: `GET /health/` (status, database, redis).
- **Frontend:** React (Vite + TypeScript), Capacitor, React Router. Single health screen that calls the API and displays status.
- **Docker:** `docker compose up` runs postgres, redis, django_api, frontend (SPA served by nginx), and nginx as the single entrypoint on port 9000.

## Quick start

### Using Docker (recommended)

1. Copy env and start stack:
   ```bash
   cp .env.example .env
   docker compose up --build
   ```
2. Open [http://localhost:9000](http://localhost:9000). The health screen shows API, database, and Redis status.
3. Health endpoint: [http://localhost:9000/health/](http://localhost:9000/health/).

### Local development (without Docker)

**Backend**

1. Copy env: `cp .env.example .env` and set `DATABASE_URL` and `REDIS_URL` (e.g. local Postgres and Redis).
2. Create a virtualenv, install deps, run migrations and server:
   ```bash
   cd backend
   python -m venv .venv && . .venv/bin/activate   # or: . ../.venv/bin/activate
   pip install -r requirements.txt
   python manage.py migrate
   python manage.py runserver
   ```
   API: [http://localhost:8000/health/](http://localhost:8000/health/).

**Frontend**

1. From repo root:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
2. Open [http://localhost:5173](http://localhost:5173). Set `VITE_API_BASE_URL=http://localhost:8000` in `.env` if the API runs on 8000.

## Pre-commit hooks

Pre-commit runs **format**, **lint**, and **tests** before each commit.

1. **One-time setup** (from repo root):
   ```bash
   pip install -r backend/requirements-dev.txt   # or: pip install pre-commit ruff
   pre-commit install
   ```
   Ensure the frontend has deps installed: `cd frontend && npm install`.

2. **On every commit** the hooks run:
   - **Backend:** Ruff format + Ruff check (fix) on `backend/`; then Django tests.
   - **Frontend:** Prettier format, ESLint, then Vitest.

   For **backend tests** to pass, use a shell where the backend venv is activated (or install backend deps: `cd backend && pip install -r requirements.txt`). Ruff runs in its own env and does not require the venv.

3. **Run manually** (all hooks on all files):
   ```bash
   pre-commit run --all-files
   ```

Config: [.pre-commit-config.yaml](.pre-commit-config.yaml). Backend tooling: [backend/pyproject.toml](backend/pyproject.toml), [backend/requirements-dev.txt](backend/requirements-dev.txt).

## Tests

- **Backend:** `cd backend && python manage.py test`
- **Frontend:** `cd frontend && npm run test`

**From repo root** ([package.json](package.json)): run all tests, lint, and format in one place (ensure `frontend/node_modules` exists via `cd frontend && npm install`; for backend commands, activate the backend venv or have `ruff` and Django on `PATH`):
- `npm run test` — frontend (Vitest) + backend (Django)
- `npm run lint` — frontend (ESLint) + backend (Ruff)
- `npm run lint:fix` — same as lint with Ruff auto-fix
- `npm run format` — frontend (Prettier) + backend (Ruff format)
- `npm run format:check` — check only, no writes

## Env and config

- **`.env`:** Copy from `.env.example` and fill in. Used by Docker Compose and by backend/frontend when run locally. **Do not commit `.env`** (it is in `.gitignore`).
- **`.env.example`:** Committed; documents all required and optional variables.

## Project layout

- `backend/` – Django API (config, core app, health endpoint).
- `frontend/` – React + Vite + Capacitor app.
- `nginx/` – nginx config for Docker (reverse proxy).
- `docker-compose.yml` – postgres, redis, django_api, frontend, nginx.
