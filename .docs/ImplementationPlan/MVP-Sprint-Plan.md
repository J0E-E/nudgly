# Nudgly – MVP Sprint Plan

**Purpose:** Break the MVP into small epics with explicit FE and BE components. At the end of each epic, the delivered slice can be built, tested, and validated before proceeding.

**Scope:** Per [app-idea §16 MVP Definition](../Design%20Docs/app-idea.md). Excludes calendar, team collaboration, smart nudging; includes Friends & Social.

**Standards:** Unit tests with every change; modular frontend with dependency injection; unique descriptive HTML IDs; Definition of Done per app-idea §16.

**Data Fetching & Resilience (from Epic 5 onward):** Use TanStack Query (React Query) for all server-state management. This gives caching, background refetching, stale-while-revalidate, and automatic retry out of the box. Apply optimistic updates for mutations where latency matters (e.g. completing a task). Use React error boundaries for unrecoverable UI errors. Detect network status (navigator.onLine + Capacitor Network plugin) and show a banner when offline; TanStack Query will pause mutations and retry when connectivity resumes. This is a cross-cutting concern—not a separate epic—applied as each data-fetching screen is built.

---

## Epic 1: Project Setup & Infrastructure — COMPLETED

**Objective:** Running Django API and React + Capacitor app in Docker; health check and minimal routing.

### Backend
- Django project with DRF; PostgreSQL and Redis in Docker Compose.
- Health/readiness endpoint (e.g. `GET /health`).
- CORS and env-based config for local/dev.
- Containers: `django_api`, `postgres`, `redis` (celery_worker, celery_beat, nginx can be stubbed or added later).

### Frontend
- React app with Capacitor; routing skeleton (e.g. React Router).
- Single screen that calls API health endpoint and displays status.
- Env/config for API base URL.

### Implementation Notes:
- **Status:** Done. All objectives met.
- **Backend:** Health at `GET /health/` (Django); returns JSON `{ status, database, redis }` with 200 when all ok, 503 when DB or Redis down. Config via `django-environ`; `.env` at repo root. CORS via `CORS_ALLOWED_ORIGINS` / `CORS_ALLOW_ALL_ORIGINS`. Tests use SQLite in-memory (no Postgres required).
- **Frontend:** React + Vite; React Router with single route `/` → `HealthScreen`. API base URL from `VITE_API_BASE_URL` (see `frontend/src/config/api.ts`). When served behind nginx, use empty string for same-origin; for local Vite dev use `http://localhost:8000`. Capacitor 8 present; Android/iOS not yet added (`npx cap add android|ios` when needed).
- **Docker:** nginx was added (not stubbed) as single entrypoint. App is exposed on **port 9000**: open `http://localhost:9000` for the app and `http://localhost:9000/health/` for health. nginx proxies `/` → frontend, `/health/` and `/api/` → Django.
- **Deferred:** `celery_worker` and `celery_beat` are not in Compose; add in a later epic when reminder/nudge engine is implemented.
- **Caveats:** Ensure `.env` exists (copy from `.env.example`). Backend healthcheck hits Django’s `/health/`; frontend container has no healthcheck.

---

## Epic 1b: Email System Interface — COMPLETED

**Objective:** Define an email-sending interface and provide a stdout adapter as the default implementation. No real mail provider (e.g. SendGrid) yet; the system will use the interface so a SendGrid (or other) adapter can be plugged in later.

### Backend
- **Interface:** Define an email-sender interface (e.g. `send_email(to, subject, body_plain, body_html=None, reply_to=None)` or equivalent contract). All callers (e.g. password reset, notifications) will depend on this interface, not on a concrete implementation.
- **Stdout adapter:** Implement an adapter that fulfills the interface by writing the email payload to stdout (e.g. structured log or human-readable dump: to, subject, body). No SMTP or third-party API calls.
- **Default:** Wire the application so the default implementation is the stdout adapter. Configuration (e.g. env or Django settings) should allow swapping to another adapter later (e.g. SendGrid) without changing call sites.
- **Documentation:** Document the interface contract and how to add a new adapter (e.g. for SendGrid when an account is set up).

### Frontend
- No frontend work in this epic; email is backend-only.

### Implementation Notes
- **Status:** Done. All objectives met.
- **Interface:** `core.email.interface.EmailSender` (typing.Protocol) with `send_email(to, subject, body_plain, body_html=None, reply_to=None)`. `to` accepts either a single email string or a list of strings.
- **Stdout adapter:** `core.email.adapters.stdout_adapter.StdoutAdapter`; writes payload via Python `logging` (logger.info). In typical Django dev config this goes to console; no SMTP/API. Use for dev/test only.
- **Config:** `EMAIL_SENDER` env (default `stdout`). Wired in `config/settings.py` via django-environ. Getter: `core.email.get_email_sender()`; callers use it and do not depend on a concrete class. Unknown value falls back to stdout so missing or invalid env does not break the app.
- **Caching:** The getter caches the adapter instance after first call. Tests that patch `EMAIL_SENDER` must reset `core.email._sender = None` before calling `get_email_sender()` so the patch is applied; in production, adapter is chosen once per process.
- **Adding an adapter:** See [.docs/be_docs.md](../be_docs.md) — implement the protocol, register in `get_email_sender()` in `core/email/__init__.py`, set `EMAIL_SENDER` in env. Call sites do not change.
- **Tests:** `core/tests/test_email.py` — StdoutAdapter (single/list recipients, body_plain, body_html, reply_to) and get_email_sender (default, interface contract, caching, unknown fallback). Run: `python manage.py test core.tests.test_email`.

---

## Epic 2: Authentication (Email / Password) — COMPLETED

**Objective:** Users can register, log in, log out, and reset password; JWT access/refresh; protected routes.

### Backend
- User model (email, password_hash, timezone; username optional for this epic or required per §4).
- Register: `POST /auth/register` (email, password, username per app-idea).
- Login: `POST /auth/login` → JWT access + refresh (e.g. djangorestframework-simplejwt).
- Logout: invalidate refresh (if using token blacklist) or client-side only.
- Password reset: request + confirm flow; store reset token with expiry.
- Validation: password strength, unique email/username per schema.

### Frontend
- Login screen (email, password); Register screen (email, password, username).
- Password reset: “Forgot password” → request → confirm (new password) flow.
- Auth context/store: store tokens, user identity; attach token to API requests.
- Protected route wrapper: redirect unauthenticated users to login.
- Logout control (e.g. in header or placeholder settings).

### Implementation Notes:
- **Status:** Done. All objectives met.
- **Backend:** Custom `core.User` (email as USERNAME_FIELD, username required). Auth under `/api/auth/`: register, login, logout (simplejwt blacklist), token/refresh, me, password-reset, password-reset/confirm. `PasswordResetToken` model; reset link uses `FRONTEND_ORIGIN`. Validation: password min 8 chars + letter + number; username 3–30 alphanumeric + underscore. See [.docs/be_docs.md](../be_docs.md).
- **Frontend:** Auth context stores user + access (memory), refresh (localStorage); session restore on load via refresh then GET me. API client (`apiClient.ts`) attaches Bearer and handles 401/refresh. Routes: `/login`, `/register`, `/reset-password`, `/reset-password/confirm`; `/` protected. AppHeader shows logout when authenticated. See [.docs/fe_docs.md](../fe_docs.md).
- **Caveats:** Logout view returns 200 (simplejwt TokenBlacklistView default). Ensure `FRONTEND_ORIGIN` is set for password-reset emails when not using stdout adapter.

---

## Epic 3: Authentication (OAuth – Gmail & Apple) — COMPLETED

**Objective:** Sign-in with Google and Apple in addition to email/password.

### Backend
- OAuth integration (e.g. django-allauth or custom): Gmail (Google), Apple.
- Link OAuth identity to User; create user on first sign-in if needed.
- Return same JWT contract as email login so FE is unchanged.

### Frontend
- “Sign in with Google” and “Sign in with Apple” buttons on Login/Register.
- OAuth callback handling (redirect or deep link); exchange code for tokens and update auth state.

### Implementation Notes:
- **Status:** Done. All objectives met.
- **Backend:** django-allauth for Google and Apple. Custom adapters in `core.auth.adapters`: `NudglySocialAccountAdapter` sets random placeholder username for new OAuth users; `NudglyAccountAdapter` for account settings. OAuth flow: frontend links to `GET /api/auth/oauth/google/authorize/` or `.../apple/authorize/`; backend redirects to provider; after callback, allauth creates/links user and redirects to `GET /api/auth/oauth/complete/`, which issues JWT and redirects to `{FRONTEND_ORIGIN}/auth/callback#access=...&refresh=...`. Env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`; register backend callback URL in provider consoles. Sessions and AuthenticationMiddleware used for the OAuth redirect step only. The complete view calls `request.session.flush()` before redirecting so no server-side session remains after OAuth (tokens are in the fragment only).
- **Frontend:** OAuth buttons (Google and Apple icons) on Login and Register via `OAuthButtons` component. Google links to backend; **Apple is disabled for development** (shown as “Sign in with Apple (coming soon)”) and will be enabled once the app is further along. Route `/auth/callback`: `AuthCallbackScreen` parses fragment for `access` and `refresh`, calls `loginWithOAuthTokens(access, refresh)` (stores tokens and fetches user via `getMeWithToken`), then redirects to `/`. AuthContext exposes `loginWithOAuthTokens`; authApi has `getGoogleAuthorizeUrl`, `getAppleAuthorizeUrl`, `getMeWithToken`. LoginScreen handles `?oauth_error=not_authenticated` (backend redirect when user hits complete without a session) and shows a message, then strips the query param.
- **Tests:** Backend `core/tests/test_oauth.py` (random username, adapter populate_user, oauth complete view redirect). Frontend: Login/Register tests include OAuth buttons and IDs; AuthCallbackScreen tests for missing tokens, success call, error state; LoginScreen test for `oauth_error` message.
- **Docs:** `.docs/be_docs.md` and `.docs/fe_docs.md` updated with OAuth routes and flow.
- **Plan vs implementation:** Objective referred to "Gmail"; implementation uses **Google OAuth** (Google identity, same JWT contract). No other material deviation.
- **Caveats:** `FRONTEND_ORIGIN` must be set for OAuth callback redirect. Google/Apple env vars are required for the respective providers; without them, provider login will fail. When enabling Apple on the frontend: wire `getAppleAuthorizeUrl()` to the Apple button and ensure Apple Developer console has the backend callback URL configured. If a user lands on `/auth/callback` without tokens (e.g. bookmarked), they see "Missing sign-in data" and a link back to login.

---

## Epic 4: User Profile & Username

**Objective:** Profile API; @userName required at signup and used for identity (e.g. friends later).

### Backend
- Profile: `GET /users/me`, `PATCH /users/me` (timezone, display name, etc.; per schema).
- Enforce username at signup if not done in Epic 2; uniqueness and format validation.
- Username in user representation for FE and future friend lookup.

### Frontend
- Display username (e.g. @userName) in header or profile area.
- Minimal profile view: show email, username, timezone; link to settings (can be expanded in Epic 14).

### Implementation Notes:
- **Status:** Done. All objectives met.
- **Backend:** Profile API at `/api/users/me/` (GET and PATCH) in `core.profile` module. GET returns full user payload including `needs_profile_completion` flag (true for OAuth users who haven't set a username/password). PATCH supports `timezone`, `display_name`, and profile-completion flow (`username` + `password` — only allowed when `needs_profile_completion` is true). Username validation: regex `^[a-zA-Z0-9_]{3,30}$`, case-insensitive uniqueness check. Shared `_user_payload()` helper between auth and profile views for consistent user representation. Migration `0002_add_user_display_name` adds `display_name` field.
- **Frontend:** `ProfileScreen` has two modes: (1) complete-profile form (username + password) shown when `needs_profile_completion` is true (OAuth users), (2) read-only profile view showing email, @username, timezone with link to Settings. `AppHeader` displays `@username` as a clickable link to `/profile`. `SettingsPlaceholderScreen` at `/settings` with "More options coming soon" (expanded in Epic 14). `RegisterScreen` collects username at signup with client-side pattern validation. `profileApi.ts` provides `getProfile` and `updateProfile` service functions.
- **Tests:** Backend `core/tests/test_profile.py` — 13+ tests covering GET (auth required, full payload, OAuth needs-completion flag), PATCH (timezone, display_name, partial updates, invalid values), and profile completion (username+password, duplicate username, weak password, prevents re-completion). Frontend `ProfileScreen.test.tsx` — renders both complete and incomplete profile states.
- **Docs:** `.docs/be_docs.md` and `.docs/fe_docs.md` updated with profile routes and API contract.
- **Plan vs implementation:** `display_name` is supported by the API but not shown in the frontend profile view (deferred to Epic 14 settings expansion). Timezone is displayed read-only — editing UI deferred to Epic 14. Username is immutable after initial set (by design for identity stability). OAuth profile-completion flow was added beyond the original plan to handle users who sign up via Google/Apple without a username or password.
- **Caveats:** Username cannot be changed after initial registration or profile completion. The `needs_profile_completion` flag drives the profile-completion UX for OAuth users. Backend tests require the virtual environment with `django-environ` and other dependencies installed.

---

## Epic 4b: Pre-commit Hooks (Lint & Format Auto-fix) — COMPLETED

**Objective:** Install pre-commit hooks that automatically lint and format code on every commit so style issues never reach the repo.

### Backend
- Install and configure pre-commit with hooks: `ruff check --fix` (lint auto-fix), `ruff format` (formatter).
- Add `pyproject.toml` or `ruff.toml` config for Ruff rules.
- `.pre-commit-config.yaml` at repo root.

### Frontend
- Add ESLint + Prettier as pre-commit hooks (via lint-staged + husky or pre-commit).
- Configure ESLint for TypeScript/React; Prettier for consistent formatting.
- Auto-fix on commit: `eslint --fix` then `prettier --write` on staged files.

### Implementation Notes:
- **Status:** Done. All objectives met.
- **Pre-commit framework** (`.pre-commit-config.yaml`) with 6 hooks: Ruff format, Ruff lint, Prettier, ESLint, Vitest related, Django tests.
- **Backend hooks** use official `astral-sh/ruff-pre-commit` (v0.8.0) with bundled Ruff binary. `ruff format` + `ruff check --fix` scoped to `^backend/` via `files:` filter.
- **Frontend hooks** are local hooks that `cd frontend` and strip path prefixes so tools find their configs. Prettier (`--write --ignore-unknown`) and ESLint (`--fix`) scoped to `^frontend/src/`.
- **Smart test hooks**: Frontend uses `vitest related --run` (only tests affected by staged files). Backend runs all Django tests but only when `^backend/` Python files are staged.
- **File-targeted**: Every hook uses `files:` and `types:` filters — hooks skip entirely when irrelevant files change.
- **Auto-fix flow**: Hooks auto-fix formatting/lint issues. If files are modified, commit aborts; user re-stages fixes and commits again (standard pre-commit behavior). `git add` inside hooks was attempted but is not possible — git holds an index lock during `git commit` that prevents `git add` from inside hook subprocesses.
- **Line endings**: `.gitattributes` added with `* text=auto eol=lf` to enforce LF. Prettier and Ruff both output LF; without this, Windows machines with `core.autocrlf=true` would see CRLF/LF churn causing hooks to report false modifications on every commit.
- **Manual scripts**: `npm run lint`, `npm run lint:fix`, `npm run format`, `npm run format:check` work from both `frontend/` and repo root.
- **Existing lint issues fixed**: Removed 2 unused variable assignments (F841) in `test_oauth.py` and `test_profile.py`.
- **Bulk format applied**: First run of hooks reformatted ~15 existing files (Ruff on backend, Prettier on frontend) that had minor style drift.
- **Ruff config**: `backend/pyproject.toml` — rules E, F, I, UP; line-length 88; target py311.
- **ESLint config**: `frontend/eslint.config.js` — flat config (v9+); typescript-eslint, react-hooks, react-refresh.
- **Prettier config**: `frontend/.prettierrc` — no semicolons, single quotes, tab width 2, trailing commas es5.
- **Plan vs implementation**: Used pre-commit framework (not husky/lint-staged) for both backend and frontend since pre-commit was already in place from Epic 1. Added smart test hooks beyond the original plan scope (plan only specified lint/format). `git add` auto-staging was planned but not feasible due to git index locking.
- **Caveats**: Backend test hook requires a Python environment with Django deps installed (venv or Docker). After adding `.gitattributes`, the first checkout on an existing clone may show line-ending changes — run `git add --renormalize .` to normalize once.

---

## Epic 4c: CI Pipeline (Lint, Format & Tests) — COMPLETED

**Objective:** GitHub Actions CI that runs lint/format checks and test suites on every push/PR so regressions are caught before merge.

### Backend
- CI job: `ruff check` (no auto-fix, fail on violations), `ruff format --check`, `python manage.py test`.
- Use SQLite in-memory for test DB in CI (matches existing test setup).

### Frontend
- CI job: `eslint` (no auto-fix, fail on violations), `prettier --check`, `npm test` (Vitest).
- Cache `node_modules` for faster runs.

### Shared
- Single `.github/workflows/ci.yml` with backend and frontend jobs running in parallel.
- Trigger on push to `master` and all pull requests.
- Fail-fast: if lint fails, skip tests.

### Implementation Notes:
- **Status:** Done. All objectives met.
- Single workflow file: `.github/workflows/ci.yml`
- Two parallel jobs: `Backend (lint, format, test)` and `Frontend (lint, format, test)`
- Backend: Python 3.11, pip cache (keyed on both `requirements.txt` and `requirements-dev.txt`), installs both requirements files, runs `ruff check .`, `ruff format --check .`, `python manage.py test` (SQLite in-memory, no services needed). `working-directory: backend` set as job default.
- Frontend: Node 22, npm cache via `package-lock.json`, `npm ci`, `npm run lint`, `npm run format:check`, `npm test`. `working-directory: frontend` set as job default.
- Concurrency group (`ci-${{ github.ref }}`) with `cancel-in-progress: true` to cancel stale runs on new pushes.
- Fail-fast: sequential steps within each job — lint/format failures prevent tests from running.
- No Docker services required in CI; all Django env vars have defaults, tests use SQLite in-memory.
- **Plan vs implementation:** No material deviation. All planned deliverables implemented as specified.

---

## Epic 5a: Tasks CRUD — Backend — COMPLETED

**Objective:** Task model and full REST API: create, list, edit, delete, mark complete; categories and priorities per app-idea §3–§4.

### Backend
- Task model per schema §8: title, description, due_date, category, tag, priority, recurring (nullable), status, list_id (nullable), created_at, completed_at, muted_until (nullable), created_by_user_id (nullable FK to users), plus `task_linked_friends` join table (task_id, user_id). Include friend-related fields now — the DB is rebuilt from scratch during MVP testing so there is no migration concern. Friend-field API exposure and validation is deferred to Epic 12.
- Categories and priorities: use defined enums/choices from app-idea §3.
- API: `GET /tasks` (pagination: limit/offset; filter by status, list_id later), `POST /tasks`, `GET /tasks/{id}`, `PATCH /tasks/{id}`, `DELETE /tasks/{id}`.
- Ordering: due_date (nulls last), then created_at ascending.
- Validation: title required, max 500 chars; category/priority from enum.

### Frontend
- No frontend work in this epic.

### Implementation Notes:
- **Plan vs implementation:** No material deviation. All planned deliverables implemented as specified.
- **Model:** `Task` in `core/models.py` with all §8 fields. `linked_friends` uses Django `ManyToManyField` (auto-creates join table) rather than a manually defined `task_linked_friends` table — semantically identical. `created_by` is a nullable FK with `on_delete=SET_NULL`. `list_id` is a plain `IntegerField` (no FK) since the Lists model does not exist yet.
- **Enums:** `TaskCategory` (TextChoices), `TaskPriority` (IntegerChoices 0–5), `TaskStatus` (TextChoices: pending/completed/cancelled) defined at top of `core/models.py`.
- **API:** Mounted at `/api/tasks/` via `core/tasks/` package (views, serializers, urls). Uses plain DRF `APIView` classes, not `ModelViewSet`.
- **Pagination:** Custom limit/offset implementation in views (not DRF's built-in pagination classes). Default limit 50, max 100. Response shape: `{count, limit, offset, results}`.
- **Ordering:** `F("due_date").asc(nulls_last=True), "created_at"` — uses Django's `F()` expression for null handling.
- **completed_at auto-management:** Setting status to `completed` auto-stamps `completed_at`; reverting to `pending`/`cancelled` clears it. Handled in both create and patch serializers.
- **Friend fields deferred:** `linked_friends` and `created_by` exist on the model but are not exposed in the API serializers — deferred to Epic 12 as planned.
- **Tests:** 29 tests in `core/tests/test_tasks.py` covering model behavior, all CRUD endpoints, validation, auth, ownership isolation, pagination, ordering, and status filter.

---

## Epic 5b: Tasks CRUD — Frontend — COMPLETED

**Objective:** Tasks screen UI with full CRUD interactions, powered by the API from Epic 5a. First screen to adopt TanStack Query for data fetching and resilience patterns (see Standards).

### Backend
- No backend work in this epic (API delivered in 5a).

### Frontend
- Install and configure TanStack Query (`@tanstack/react-query`); wrap app in `QueryClientProvider`. This becomes the standard for all subsequent data-fetching screens.
- Tasks screen: list tasks (checkbox to complete, title, due date, category/priority indicators).
- Add task: form (title, description, due date, category, priority, tag optional).
- Edit task: same fields; open from list row or detail.
- Delete: with confirmation (per UI/UX §7).
- Search/filter bar (by title/notes; category, priority) per UI/UX §5.1.
- Empty state, loading state, and error state.
- Optimistic update on task completion (checkbox toggle).

### Implementation Notes:
- **TanStack Query setup:** `QueryProvider` wraps `AuthProvider` (outermost provider) in `App.tsx`. Default config: `staleTime: 5min`, `gcTime: 10min`, `retry: 2` for queries, `retry: 0` for mutations. `onlineManager` is configured with `navigator.onLine` events; TanStack Query auto-pauses mutations when offline. Capacitor Network plugin integration is deferred (TODO in `QueryProvider.tsx`) — `navigator.onLine` is sufficient for web MVP but has limitations on native platforms.
- **TanStack Query + auth bridge pattern:** Each hook calls `useAuth().getApiDeps()` inside `queryFn`/`mutationFn` at call time (not closure time) so the access token is always fresh. This avoids stale closures. Follow this pattern for all future data-fetching hooks.
- **Query key factory:** `taskKeys` in `useTasks.ts` — `['tasks', 'list', { status }]`. Future screens should adopt the same `entityKeys` pattern for consistent cache invalidation.
- **`authDelete` added to `apiClient.ts`:** Returns `void`, throws on non-ok status. Available for all future delete endpoints.
- **TypeScript `enum` not used:** Project has `erasableSyntaxOnly` enabled. `TaskCategory` and `TaskStatus` are `const` objects with derived union types (`type TaskCategory = (typeof TaskCategory)[keyof typeof TaskCategory]`). Future type definitions must follow this pattern.
- **Form modals use native `<dialog>`:** `showModal()`/`close()` for focus trap and backdrop. Tests must mock `HTMLDialogElement.prototype.showModal/close` in `beforeEach` for happy-dom compatibility. Focus is saved on open and restored on close.
- **Search/filter is client-side:** The backend only supports `?status=` filter. Title/description search and category/priority filters are applied in `TasksScreen` via `useMemo` over `data.results`. This is acceptable for MVP (max 100 tasks per page). Server-side search can be added if task volume grows.
- **Routing changes:** `/` now redirects to `/tasks`. `HealthScreen` moved to `/health`. Catch-all `*` redirects to `/`.
- **Mutation error feedback:** Toggle and delete mutation errors render an inline alert banner in `TasksScreen`. Form mutations show errors inline in `TaskFormModal`.
- **Theme token added:** `--color-backdrop` for dialog overlays; `--color-success` for completed task indicators.
- **114 frontend tests** across 19 test files (27 new tests added in this epic).

---

## Epic 5c: Task Detail View (Tap-to-Expand) — COMPLETED

**Objective:** Let users view full task details inline by tapping a task row, using a tap-to-expand (accordion) pattern — the most idiomatic mobile UX for revealing detail without leaving context.

### Backend
- No backend work in this epic (all fields already returned by `GET /tasks`).

### Frontend
- **Tap-to-expand on `TaskListItem`:** Tapping the task content area (not checkbox) toggles an expanded section below the title/meta row.
- **Expanded section shows:** description (if non-empty), tag (if non-empty), created date, status / completed date (if completed), muted until (if set).
- **Action buttons relocated:** Edit and Delete buttons move from always-visible into the expanded section, decluttering the collapsed row.
- **Transition:** CSS transition for smooth expand/collapse.
- **Accessibility:** `aria-expanded` on the toggle target; keyboard Enter/Space to toggle.
- **Tests:** expand/collapse behavior, detail fields rendered when expanded, actions accessible only when expanded.

### Implementation Notes:
- **Plan vs implementation:** No material deviation. All planned deliverables implemented as specified.
- **Tap-to-expand pattern:** The content area is a native `<button>` element (not a `<div>` with `onClick`), which provides keyboard Enter/Space toggle for free without custom `onKeyDown` handling. The checkbox is in a separate wrapper so clicking it does not trigger expand.
- **CSS transition technique:** Uses the `grid-template-rows: 0fr` → `1fr` pattern on a wrapper `<div>`, with `overflow: hidden` on the inner container. This animates height smoothly without needing explicit pixel values or `max-height` hacks. The transition duration uses the shared `--transition-expand` token (250ms ease-out) defined in `theme-tokens.css`.
- **Accessibility:** `aria-expanded` on the toggle button, `aria-controls` pointing to the details panel ID, `aria-hidden` on the panel toggled in sync, and `role="region"` with `aria-labelledby` linking to the task title. `focus-visible` outline on the content button for keyboard users.
- **Action buttons relocated:** Edit and Delete buttons are rendered exclusively inside the expanded details panel. They were never rendered outside it in the previous epic (5b had them always-visible in each row); this epic moved them into the collapsible section to declutter the collapsed row.
- **Detail fields:** Description and tag are conditionally rendered (only when non-empty). Created date and status are always shown. Completed date appends to the status line when the task is completed. Muted-until is conditionally rendered when set. All dates use a shared `formatDateTime` helper (month short, day, year).
- **Tests:** 28 tests in `TaskListItem.test.tsx` covering: collapsed-by-default, expand/collapse toggle, checkbox independence, all detail fields (description, tag, created, status, completed date, muted until) with present/absent cases, action button accessibility only when expanded, and aria attribute correctness.

---

## Epic 6: Lists CRUD & Task–List Association — COMPLETED

**Objective:** Lists as grouped tasks; create/edit/delete list; move tasks to list; list delete moves tasks to default Tasks.

### Backend
- List model per schema §8: user_id, name, category, tag, priority, sort_order, muted_until, archived_at.
- API: `GET /lists`, `POST /lists`, `GET /lists/{id}`, `PATCH /lists/{id}`, `DELETE /lists/{id}`. On delete: set `tasks.list_id = null` for tasks in that list (do not cascade-delete tasks).
- `GET /tasks?list_id={id}` for tasks in a list.
- Move task: `PATCH /tasks/{id}` with `list_id`.
- List name required, max 200 chars.

### Frontend
- Lists screen: list of lists (name, category/priority); search, filter, add list.
- List detail: open list → show tasks in list; list-level actions (edit list, mute, archive, delete with confirmation).
- Add list; edit list (name, category, tag, priority).
- Add task to list from list detail (e.g. text box + Add); new tasks get list-level category/tag/priority by default.
- Per-item edit: from list detail, edit task (description, category, priority, notes) per app-idea.
- Tasks screen: filter or link to “Tasks” (list_id null) vs lists.

### Implementation Notes:
- **Plan vs implementation:** All planned deliverables implemented as specified. No material deviations.
- **Backend architecture:** List CRUD follows the same module pattern as tasks (`core/lists/` with `urls.py`, `views.py`, `serializers.py`). Serializers use plain function `list_payload()` for response formatting (consistent with `task_payload()`) plus DRF serializers for input validation only.
- **Task–list association:** Task model uses a ForeignKey to List with `on_delete=SET_NULL`, so deleting a list nullifies `task.list_id` rather than cascade-deleting tasks. The `related_name="tasks"` enables `list.tasks.all()` queries and the `task_count` annotation on list responses.
- **Filtering semantics:** `GET /tasks?list_id={id}` filters tasks by list; the special value `list_id=none` returns tasks with no list assignment (`list__isnull=True`). This enables the Tasks screen to show "unassigned" tasks separately.
- **List defaults inheritance:** When creating a task from ListDetailScreen, the list's category, tag, and priority are passed as `defaultCategory`, `defaultTag`, `defaultPriority` props to `TaskFormModal`, pre-filling the form. The `list_id` is included in the create payload automatically.
- **Archive/mute:** Lists support `archived_at` and `muted_until` fields. `GET /lists` excludes archived lists by default; pass `include_archived=true` to include them. Mute is hardcoded to +1 day from the detail screen UI.
- **Migration note:** Migration `0004` removes the old integer `list_id` field from Task and replaces it with a proper ForeignKey. Since DB is rebuilt from scratch during MVP, no data migration concerns.
- **Tests:** 39 backend tests (model, CRUD views, task-list integration including cross-user validation) and 19 frontend tests (ListsScreen and ListDetailScreen covering loading/error/render/filter/action states).

---

## Epic 7: Task Mute & Snooze — COMPLETED

**Objective:** Users can mute a task (or snooze from UI) so the nudge engine skips it until `muted_until`.

### Backend
- `muted_until` already on task model; expose in PATCH (e.g. `muted_until` ISO datetime or preset: 1h, 1d, 1wk from now).
- Validation: optional preset or explicit datetime in UTC.

### Frontend
- Task detail or row action: “Mute” / “Snooze” with options (e.g. 1h, 1d, 1wk). Set `muted_until` via API.
- Visual indicator on task when muted (e.g. icon or label until time).

### Implementation Notes:
- **Backend**: Added `mute_preset` ChoiceField (`1h`, `1d`, `1wk`) to `TaskPatchSerializer`. Cross-field validation rejects sending both `mute_preset` and `muted_until` simultaneously. Preset computes `muted_until = now + duration` server-side. Unmute via `PATCH { muted_until: null }`.
- **Frontend**: Created `SnoozeTaskDialog` (native `<dialog>`) with 3 preset buttons + conditional Unmute button. Added "Muted" pill badge in `TaskListItem` meta row (visible only when `muted_until` is in the future). "Snooze" action button in expanded task detail panel. `TasksScreen` orchestrates dialog state and calls `useUpdateTask` with `mute_preset` or `muted_until: null`.
- **Types**: Added `MutePreset` type and `MUTE_PRESET_LABELS` map to `task.ts`; extended `TaskUpdatePayload` with optional `mute_preset`.
- **Tests**: 7 new backend tests (preset durations, explicit datetime, unmute, mutual exclusivity, invalid preset). 4 new `TaskListItem` tests (muted badge visibility, snooze callback). 9 new `SnoozeTaskDialog` tests (presets, unmute, cancel).
- **No model/migration changes** required; `muted_until` field already existed.

---

## Epic 8: Reminder Schedules & Nudge Engine

> **⚠ HIGH RISK — Spike required before implementation.**
> This is the most architecturally complex epic in the MVP. It introduces Celery (Beat + worker), idempotent event processing, retry/escalation logic, and cross-model scheduling. A dedicated spike (Epic 8a) must be completed first to produce a detailed design and validate assumptions before any code is written.

### Epic 8a: Nudge Engine — Spike & Design ✅ COMPLETED

**Objective:** Produce a detailed technical design document for the nudge engine. Validate architectural decisions with a proof-of-concept.

#### Deliverables
- Design doc covering: ReminderSchedule and ReminderEvent models (schema, constraints, indexes); idempotency strategy (unique constraint on schedule_id + triggered_at bucket — validate with edge cases); Celery Beat configuration and periodic task design; worker flow (query → filter muted → create event → send notification → update next_trigger_at); retry/escalation logic and priority-to-interval mapping per §9.1; failure modes (worker crash mid-batch, Redis down, duplicate delivery).
- Proof-of-concept: Celery Beat + worker running in Docker Compose, processing a dummy schedule and writing events. Validates that the infrastructure works before building real logic.
- Output: Sub-epic breakdown (8b, 8c, 8d, …) with scope and ordering for implementation.

#### Implementation Notes:
- Full design doc: `.docs/Design Docs/nudge-engine-design.md`
- Added `celery[redis]>=5.4,<6` to requirements; Celery app in `config/celery.py`, wired in `config/__init__.py`
- Celery settings in `config/settings.py`: CELERY_BROKER_URL (Redis), CELERY_BEAT_SCHEDULE (60s tick), CELERY_TASK_ALWAYS_EAGER for tests
- ReminderSchedule + ReminderEvent models in `core/models.py` with CheckConstraint (task XOR habit_id) and UniqueConstraint (schedule + triggered_at_bucket for idempotency)
- `habit_id` is a plain IntegerField (not FK) -- Habit model does not exist until Epic 9; will become FK then
- Worker task `process_due_reminders` in `core/nudge.py` (not `core/tasks.py` which is the Task views package). Push notification is a stub (logs only) until Epic 8c.
- `core.nudge` is explicitly included via `app.conf.include` in `config/celery.py` because `autodiscover_tasks()` only finds `tasks.py` modules; without this the worker would fail with `NotRegistered`
- Idempotent insert in the worker loop is wrapped in `transaction.atomic()` — required for PostgreSQL, which aborts the entire transaction on a bare `IntegrityError` (SQLite in tests does not surface this)
- Docker Compose: `celery_worker` and `celery_beat` services added, both depend on `django_api` (healthy) to ensure migrations run first
- 17 tests in `core/tests/test_nudge_engine.py` covering models, constraints, worker logic, muting, retry advancement, deactivation, and idempotency
- Sub-epic breakdown: 8b (Schedule API & Auto-creation) -> 8c (Push Notification Infra) -> 8d (List-Level Nudges) -> 8e (Nudge Copy & Tuning)

### Epic 8b: Schedule API & Auto-creation — COMPLETED

**Objective:** Automatically create, update, and delete ReminderSchedules when tasks change; expose an acknowledge endpoint so users can dismiss active nudges.

#### Backend
- **Auto-creation:** When a task is created or updated with a `due_date`, auto-create or update a ReminderSchedule for that task. Use `PRIORITY_NUDGE_CONFIG` (defined in `core/nudge.py`) to set `retry_interval_minutes` and `max_attempts` based on the task's priority. Set `next_trigger_at` to the task's `due_date` (or `due_date - lead_time` if a lead-time offset is defined).
- **Auto-update:** When a task's `due_date`, `priority`, or `status` changes via `PATCH /tasks/{id}`, update the associated schedule. If `due_date` is cleared or task is completed/cancelled, deactivate the schedule (`is_active = False`). If priority changes, update `retry_interval_minutes` and `max_attempts`.
- **Auto-delete:** Task deletion cascades to schedules (already enforced by `on_delete=CASCADE`).
- **Reset on reactivation:** If a completed/cancelled task is set back to `pending` with a `due_date`, re-create or reactivate the schedule with `attempt_count = 0`.
- **Acknowledge endpoint:** `POST /api/reminders/{schedule_id}/acknowledge/` — sets the most recent ReminderEvent's `acknowledged = True` and deactivates the schedule (`is_active = False`). Only the task owner can acknowledge. Returns 204.
- **Read endpoint (optional):** `GET /api/tasks/{id}/schedule/` — returns the active schedule for a task (next_trigger_at, attempt_count, is_active) or 404 if none. Read-only; used by frontend to show “Next nudge” info.
- **Friend-created tasks:** Schedule's `user` FK always points to the task **owner** (the `user` field on Task), never `created_by`. The worker resolves the owner's devices/preferences.
- **Tests:** Auto-creation on task create, auto-update on due_date/priority/status change, deactivation on complete/cancel, reactivation on pending, acknowledge endpoint, ownership isolation.

#### Frontend
- No frontend work in this sub-epic (schedule management is automatic; frontend display deferred to 8e or a later polish pass).

#### Implementation Notes:
- Schedule lifecycle managed by `sync_task_schedule(task)` in `core/schedules.py` — single function handles create, update, deactivate, and reactivate
- Integrated via explicit calls in serializers (`TaskCreateSerializer.create()` and `TaskPatchSerializer.update()`), not Django signals — consistent with existing codebase pattern where all side effects live in serializers
- `next_trigger_at` computed as 9 AM on `due_date` in the user's timezone (via `zoneinfo.ZoneInfo`), converted to UTC; if the resulting datetime is in the past, `timezone.now()` is used instead (trigger immediately)
- No lead-time offset implemented — plan mentioned `due_date - lead_time` as optional; deferred since no lead-time field exists on Task yet
- Acknowledge endpoint at `POST /api/reminders/{schedule_id}/acknowledge/` in new `core/reminders/` package; read endpoint at `GET /api/tasks/{id}/schedule/` in existing tasks views
- No new migrations — all models were delivered in Epic 8a; this epic only adds application logic
- One schedule per task enforced by `filter(task=task).first()` convention, not a DB unique constraint — acceptable for MVP; concurrent requests could theoretically create duplicates but the worker handles them gracefully
- 25 tests in `core/tests/test_schedules.py` covering unit + API integration for all specified behaviors

### Epic 8c: Push Notification Infrastructure — COMPLETED

**Objective:** Register user devices, integrate with FCM (Firebase Cloud Messaging), and replace the stub notification sender in the worker with real push delivery.

> **Depends on:** Epic 8a (worker infrastructure) and Epic 13a (push notification dependencies — Firebase project setup, service account key).

#### Backend
- **DeviceToken model:** `user` (FK, CASCADE), `token` (CharField, unique), `platform` (choices: ios, android, web), `is_active` (BooleanField, default True), `created_at`, `updated_at`. Index on `(user, is_active)`.
- **Device registration API:** `POST /api/devices/register/` — upsert device token (create or reactivate if token exists). `DELETE /api/devices/{token}/` — deactivate token. Both require authentication.
- **FCM adapter:** Follow the EmailSender interface/adapter pattern. Define `NotificationSender` protocol with `send(user_id, title, body, data=None)`. Implement `FCMAdapter` using `firebase-admin` SDK. Implement `StdoutNotificationAdapter` for dev/test (logs to console). Wire via `NOTIFICATION_SENDER` env var (default `stdout`).
- **Replace stub in worker:** In `core/nudge.py`, replace `logger.info(“NUDGE: ...”)` with a call to `get_notification_sender().send(...)`. Resolve all active device tokens for `schedule.user` and send to each.
- **Stale token cleanup:** When FCM returns “invalid registration” or “not registered”, mark the token as `is_active = False`. Add a periodic Celery task (e.g. weekly) to purge tokens inactive for > 30 days.
- **Tests:** Device registration (create, upsert, deactivate), FCM adapter with mocked firebase-admin, stdout adapter, worker integration with notification sender, stale token handling.

#### Frontend
- **Device registration on login:** After successful login or app launch (if already authenticated), call `POST /api/devices/register/` with the device's push token. On Capacitor/native, use `@capacitor/push-notifications` to request permission and obtain the token. On web, use Firebase JS SDK for web push (optional; can be deferred).
- **Permission prompt:** Request notification permission on first login; if denied, show a settings hint. Do not block login flow.

#### Implementation Notes:
- **Status:** Done. All objectives met.
- **Notification adapter pattern** mirrors the email adapter exactly: `NotificationSender` protocol in `core/notifications/interface.py`, `StdoutNotificationAdapter` and `FCMAdapter` in `core/notifications/adapters/`, factory `get_notification_sender()` in `core/notifications/__init__.py`, wired via `NOTIFICATION_SENDER` env var (default `”stdout”`).
- **FCM adapter uses lazy Firebase init:** `firebase_admin.initialize_app()` runs in `FCMAdapter.__init__()` (not at module import time) to avoid crashes when `NOTIFICATION_SENDER=stdout` and no Firebase credentials are configured. This differs from the email adapter's module-level pattern and was an intentional design choice.
- **Device API** lives in `core/devices/` (views, serializers, urls, tasks). Routes: `POST /api/devices/register/`, `DELETE /api/devices/{token}/`.
- **Stale token purge** runs weekly via Celery Beat (`purge_stale_device_tokens`); deletes inactive tokens older than 30 days. FCM adapter also deactivates tokens inline on `UNREGISTERED`, `NOT_FOUND`, or `INVALID_ARGUMENT` errors.
- **Worker integration:** `get_notification_sender()` is called once per `process_due_reminders()` invocation (outside the schedule loop), not per-schedule.
- **Frontend:** `usePushNotifications` hook in `PushNotificationRegistrar` component. Listeners are added before `PushNotifications.register()` to prevent a race condition. `registeredRef` resets on logout so re-login re-registers. `permissionDenied` state exposed for a settings hint banner. Web push deferred (native only via `@capacitor/push-notifications`).
- **Migration:** `0006_devicetoken.py` adds the `DeviceToken` model.
- **Tests:** 16 tests in `test_devices.py` (model, register API, deactivate API, purge task) + 11 tests in `test_notifications.py` (stdout adapter, factory, FCM adapter with mocked firebase-admin, worker integration).

### Epic 8d: List-Level Nudges — COMPLETED

**Objective:** Send aggregate nudge reminders at the list level, summarizing pending tasks in a list.

> **Depends on:** Epic 8b (schedule auto-creation pattern). Can be parallelized with Epic 8c.

#### Backend
- **List schedule creation:** When a list has pending tasks and a user-configured reminder (or default), create a ReminderSchedule with `task = None` and a new `list` FK on ReminderSchedule (nullable FK to List, CASCADE). Extend the XOR CheckConstraint to allow `list` as a third option: exactly one of `task`, `habit_id`, or `list` must be set.
- **Priority mapping:** Use the **list's priority** (not individual task priorities) for `retry_interval_minutes` and `max_attempts` via `PRIORITY_NUDGE_CONFIG`.
- **Aggregate message:** Notification body summarizes the list: e.g. “**Adulting** has 5 items left” or “3 tasks due today in **Glow-Up Agenda**”.
- **Mute respect:** Check `list.muted_until` before sending (already handled in worker for task-level schedules; extend to list-level).
- **Tests:** List schedule creation, priority mapping from list, aggregate message formatting, mute respect, cascade delete on list deletion.

#### Frontend
- No frontend work in this sub-epic (notifications are push-based; list view already shows task counts).

#### Implementation Notes:
- **Model:** Added nullable `list` FK on `ReminderSchedule` (CASCADE). XOR constraint extended to 3-way: exactly one of `task`, `habit_id`, or `list`. Migration `0007`.
- **Trigger timing:** `_compute_next_trigger_no_due_date()` targets 9 AM in the user's timezone (today if before 9 AM, tomorrow otherwise). Only applied on schedule creation or reactivation — in-flight schedules are not reset by task count changes.
- **Sync triggers:** `sync_list_schedule(lst)` called from: task create (if `list_id` set), task patch (on `status`/`list_id` change, including old list on reassignment), task delete (if belonged to a list), and list patch (on `priority`/`archived_at` change). Not called on list create (no tasks yet).
- **Aggregate message:** `_build_list_nudge_body()` uses user's timezone for "due today" calculation. Formats: "{N} task(s) due today in {name}" or "{name} has {N} item(s) left". Notification data includes `list_id` instead of `task_id`.
- **Mute:** `_is_muted()` extended to check `schedule.list.muted_until` for list-level schedules.
- **Tests:** 21 new tests across `test_nudge_engine.py` (model constraints, worker behavior) and `test_schedules.py` (sync unit tests, API integration).
- **Deviation from plan:** The plan did not specify behavior when `sync_list_schedule` is called on an already-active schedule (e.g. adding a second task). The implementation intentionally skips updating `next_trigger_at` for active schedules to avoid pushing back an in-flight nudge cycle. Only priority-driven config changes (`retry_interval_minutes`, `max_attempts`) are applied to active schedules.

### Epic 8e: Nudge Copy & Tuning — COMPLETED

**Objective:** Replace generic notification text with the witty, sarcastic nudge messages from the app spec; add per-user rate limiting and timing refinements.

> **Depends on:** Epic 8c (push notification infra must be in place for real message delivery).

#### Backend
- **Message templates:** Define nudge message templates per priority level (from app-idea §5 tone guidelines). Store as a list of strings per priority; worker selects randomly. Examples: Priority 5 → “You literally said you'd let yourself down. Don't do that.”, Priority 0 → “This task exists. That's about all anyone can say.”
- **Template selection:** In `core/nudge.py`, after determining the schedule is due and not muted, select a message template based on `task.priority` and `attempt_number` (escalation = more urgent tone). Pass `title` and `body` to the notification sender.
- **Per-user rate limiting:** Cap nudges per user per hour (e.g. max 5/hour) to prevent notification fatigue when many tasks come due simultaneously. Implement as a simple counter check (query ReminderEvents for user in the last hour) before sending. If over limit, defer the schedule's `next_trigger_at` by the retry interval.
- **Jitter refinement:** Current jitter is +-5 minutes (random.randint). Refine to +-2 minutes for high-priority (4-5) and +-5 minutes for low-priority (0-2) to make urgent nudges more predictable.
- **Tests:** Template selection by priority, escalation tone by attempt number, rate limiting enforcement, jitter range validation by priority.

#### Frontend
- **”Next nudge” display (optional):** If `GET /api/tasks/{id}/schedule/` is available (from 8b), show “Next nudge: in 45 min” or “Last nudge: 2h ago” on the task detail expanded view. Read-only; no interaction needed.

#### Implementation Notes:
- **Templates module:** New file `core/nudge_templates.py` houses all message copy, separated from worker logic in `core/nudge.py`. Templates use `str.format()` with `{task_title}`, `{list_name}`, `{count}`, `{due_today_count}` placeholders. 54 task templates (3 per priority × 3 tiers × 6 priorities), 18 list templates (regular + due-today variants), and per-priority title sets.
- **Escalation tiers:** Three tiers (early/mid/late) derived from `attempt / max_attempts` ratio: ≤0.33 → early, ≤0.66 → mid, >0.66 → late. Note: a single-attempt schedule (attempt 1 of 1, ratio 1.0) always gets the “late” tier.
- **Rate limiting:** `MAX_NUDGES_PER_HOUR = 5`. Pre-fetched via batch query (`_prefetch_rate_limits`) before the main loop to avoid N+1. Rate-limited nudges still create a `ReminderEvent` (for idempotency) but `notification_sent=False`. The schedule's `next_trigger_at` is deferred by `retry_interval_minutes` **without** incrementing `attempt_count` — rate-limited nudges do not consume attempts. The in-memory `rate_counts` dict is also incremented after each successful send so multiple schedules for the same user in a single tick respect the limit.
- **Jitter:** `JITTER_RANGES` dict in `nudge.py`: priority 0-2 → ±5 min, priority 3 → ±3 min, priority 4-5 → ±2 min. Both task and list schedules use the target's priority for jitter via `_get_priority()`.
- **Muted + rate-limited interaction:** If a schedule is both muted and rate-limited, the muted path takes precedence (event created, no notification, attempt consumed). This is consistent with existing mute behavior — mute is a user-intentional suppression, not a temporary deferral.
- **Frontend:** “Next nudge” row in TaskListItem expanded view. Fetches `GET /api/tasks/{id}/schedule/` on expand; clears on collapse or when task is completed. Displays relative time (“in 45 min”, “in 2h”, “any moment now”). New `TaskSchedule` type, `getTaskSchedule()` API function. No new hooks — uses inline `useEffect`.
- **Title variation:** Notification titles now vary by priority (e.g., priority 0: “Hey”/”Psst”; priority 5: “This matters”/”Don't let yourself down”), replacing the fixed “Nudge!” title.
- **Tests:** 14 new tests across 4 classes: `NudgeTemplateSelectionTests` (5), `NudgeEscalationTests` (6), `NudgeRateLimitTests` (4), `JitterByPriorityTests` (3). Existing worker and integration tests updated for template-based output (assert body contains task title rather than exact format string).

---

### Epic 8f: Due Time — COMPLETED

**Objective:** Allow users to optionally set a time alongside a due date. The nudge engine uses this time instead of the hardcoded 9 AM default.

> **Depends on:** None (independent of 8e).

#### Backend
- **Model:** Add `due_time = TimeField(null=True, blank=True)` to Task, after `due_date`. Migration `0008`.
- **Serializers:** Add `due_time` to `task_payload()`, `TaskCreateSerializer`, and `TaskPatchSerializer`. Add `"due_time"` to `schedule_fields` set so changing time re-syncs the schedule. Validation: `due_time` requires `due_date`.
- **Schedule sync:** In `_compute_next_trigger()`, use `due_time` if set, else fallback to `time(9, 0)`. Pass `task.due_time` from `sync_task_schedule()`.
- **Tests:** `_compute_next_trigger` with/without due_time, past time triggers immediately, serializer validation, payload inclusion, schedule re-sync on time change.

#### Frontend
- **Types:** Add `due_time: string | null` to `Task`, `TaskCreatePayload`, `TaskUpdatePayload`.
- **TaskFormModal:** Add native `<input type="time">` after due date field, disabled when no due date set.
- **TaskListItem:** Display time in due date format (e.g., "Mar 15 at 2:30 PM"). Update `isOverdue()` to compare full datetime when `due_time` is set.

#### Implementation Notes:
- **Approach:** Separate `TimeField` rather than changing `due_date` to `DateTimeField`. Kept due_date as DateField (referenced in 15+ locations); time is truly optional. Schedule sync change was a one-liner: `due_time if due_time else time(9, 0)`.
- **View change:** `TaskDetailView.patch()` now passes `task` in serializer context (`context={"user": request.user, "task": task}`) so the patch validator can check existing `due_date` when only `due_time` is sent. This was not in the original plan but necessary for cross-field validation.
- **Cascading clear:** Clearing `due_date` via PATCH auto-clears `due_time` (and `recurring`/`stack_count` from 8g) to prevent orphaned state. Frontend `dueDate` onChange handler also clears `dueTime` and `recurring` form fields.
- **Frontend time format:** Manual 12-hour formatting via string parsing (`HH:MM` → `H:MM AM/PM`) — no external date library added. Native `<input type="time">` used.
- **Tests:** 13 tests in `core/tests/test_due_time.py` covering trigger computation (4), serializer API (6), schedule sync (3).

---

### Epic 8g: Recurring Tasks — COMPLETED

**Objective:** Implement MVP recurring tasks with stacking behavior. When a recurring task passes its due date without completion, its stack count increments (shown as "x2", "x3") and nudge intensity escalates. Completing resets the stack and advances to the next occurrence.

> **Depends on:** Epic 8f (recurring tasks with a due time should use the time field).

#### Backend
- **Model:** Add `stack_count = PositiveIntegerField(default=0)` to Task. Define valid recurring values: "daily", "weekly", "monthly", "yearly". Migration `0009`.
- **Serializers:** Add `stack_count` to payload. Change `recurring` to `ChoiceField` with valid values. Validation: `recurring` requires `due_date`. Clearing `recurring` resets `stack_count`.
- **Completion hook:** In `TaskPatchSerializer.update()`, when a recurring task is completed: advance `due_date` to next occurrence, reset status to PENDING, reset `stack_count` to 0, clear `completed_at`. The task never truly "completes" — user removes the `recurring` value to stop recurrence.
- **Recurrence logic:** New `core/recurrence.py` — `advance_due_date()` (daily +1d, weekly +7d, monthly +1mo, yearly +1yr via `dateutil.relativedelta`; skip-to-future if far past). `compute_stack_count()` — compute elapsed intervals past due datetime.
- **Stacking Celery task:** New `core/stacking.py` — `update_stack_counts()` runs every 15 min via Beat, recomputes stack_count for all pending recurring tasks. Idempotent.
- **Nudge escalation:** `select_task_nudge()` accepts `stack_count`; forces "late" tier at stack ≥ 2, "mid" at stack ≥ 1. Appends "(x{N})" to body.
- **Tests:** Advancement logic, stack computation, completion behavior, serializer validation, nudge escalation, stacking task idempotency.

#### Frontend
- **Types:** Add `stack_count: number` to `Task`. Add `RecurringOptions` const and `RECURRING_LABELS` map.
- **TaskFormModal:** Add recurring `<select>` (None/Daily/Weekly/Monthly/Yearly) after due time field.
- **TaskListItem:** Show recurring label in meta row. Show "(x{N})" stack badge when `stack_count > 0`.

#### Implementation Notes:
- **Model constraint:** `recurring` was changed from `TextField` to `CharField(max_length=10, choices=RecurringChoice.choices)` with a new `RecurringChoice` TextChoices enum on the model (migration `0010`). This enforces valid values at the database level, not just the serializer. The original plan specified `TextField` with serializer-only validation.
- **Timezone-aware advancement:** `advance_due_date()` accepts a `user_tz` parameter and computes "today" using `timezone.now().astimezone(tz).date()` instead of `date.today()`. This prevents incorrect skip-to-future behavior for users in non-server timezones.
- **Stacking scalability:** `update_stack_counts()` uses `.iterator()` to stream rows and `bulk_update()` in batches of 500, rather than per-row `save()`. This avoids loading all recurring tasks into memory at once.
- **Cascading clear on due_date removal:** PATCH `{"due_date": null}` on a task with `recurring` set auto-clears `recurring`, `stack_count`, and `due_time` in the serializer validation. This prevents orphaned state where `recurring="daily"` with `due_date=None` would crash `compute_stack_count` and `advance_due_date`. Test `test_clear_due_date_clears_recurring_and_stack` covers this.
- **`stack_count` not API-writable:** `stack_count` is not declared as a serializer field, so DRF drops it from client payloads. It is only set internally via the completion hook (reset to 0), the "clearing recurring" validation (reset to 0), and the Celery beat task (recomputed).
- **Completion flow:** When a recurring task status is set to `completed`, the serializer first sets `completed_at` (existing logic), then the recurring hook overrides: advances `due_date`, resets status to `pending`, clears `completed_at`, resets `stack_count`. The schedule re-sync then fires because `due_date` and `status` changed. The API response returns the task as `pending` with the next due date.
- **`python-dateutil`:** Used for `relativedelta` (monthly/yearly advancement). Already installed as a transitive dependency — not added to requirements.
- **Existing test fix:** `test_create_all_fields` in `test_tasks.py` updated from `"RRULE:FREQ=DAILY"` to `"daily"` to match the new ChoiceField validation.
- **Tests:** 29 tests in `core/tests/test_recurring.py` covering advancement (8), stack computation (4), completion (5), validation (5), nudge escalation (3), stacking task (4).

---

### Epic 8h: ASGI & WebSocket Infrastructure — COMPLETED

**Objective:** Migrate from WSGI to ASGI and add Django Channels so the backend can push real-time messages to connected browsers via WebSocket.

> **Depends on:** None (infrastructure-only; no feature changes).

#### Backend
- **Dependencies:** Add `channels`, `channels-redis`, and `daphne` to `requirements.txt`.
- **Settings:** Add `daphne` and `channels` to `INSTALLED_APPS`. Set `ASGI_APPLICATION = "config.asgi.application"`. Configure `CHANNEL_LAYERS` with Redis backend (reuse existing `REDIS_URL`).
- **ASGI config:** Create `config/asgi.py` with `ProtocolTypeRouter` routing HTTP to Django's ASGI handler and WebSocket to a placeholder URL router (consumer added in Epic 8j).
- **WebSocket JWT auth:** Create `core/ws/auth.py` — middleware that extracts JWT from WebSocket query string (`?token=<access_token>`), validates via `rest_framework_simplejwt`, and populates `scope["user"]`. Rejects unauthenticated connections.
- **Server swap:** Change `Dockerfile` and `docker-compose.yml` `django_api` command from Gunicorn (`config.wsgi`) to Daphne (`config.asgi`). Celery worker/beat unchanged.
- **Nginx:** Add WebSocket upgrade headers (`Upgrade`, `Connection`, `proxy_read_timeout`) to `/api/` location in both `nginx.conf` and `nginx.dev.conf`. Add `/ws/` location block proxying to Django with WebSocket headers.
- **Tests:** WebSocket connects with valid JWT, rejects invalid/missing JWT, HTTP endpoints still work under Daphne.

#### Frontend
- No frontend changes in this epic.

#### Implementation Notes:
- **Auth rejection close code:** Uses custom WebSocket close code `4003` (in the 4000–4999 app-reserved range) to signal "authentication required". The middleware sends `websocket.close` without first sending `websocket.accept`, so the client sees a rejected upgrade.
- **Valid-JWT test approach:** Because `websocket_urlpatterns` is empty (placeholder for Epic 8j), a valid-token WebSocket connection passes auth but raises `ValueError: No route found` at the router. The valid-JWT test therefore exercises `get_user_from_token()` directly rather than using `WebsocketCommunicator`. This should be extended to a full end-to-end connect test once Epic 8j adds a consumer route.
- **Test base class:** WebSocket tests use `TransactionTestCase` (not `TestCase`) because `channels.testing.WebsocketCommunicator` runs async code that may access the DB from a different thread, which requires committed data visible across threads.
- **CHANNEL_LAYERS test override:** Tests use `channels.layers.InMemoryChannelLayer` (set in the `if "test" in sys.argv` block in `settings.py`) so no running Redis is required for unit tests.
- **Gunicorn retained in requirements:** `gunicorn` was kept in `requirements.txt` even though the server command now uses Daphne. It is harmless and available as a fallback if needed.
- **`daphne` placement:** Must remain first in `INSTALLED_APPS` per Daphne docs (overrides the `runserver` management command).

---

### Epic 8i: Notification Model & REST API — COMPLETED

**Objective:** Store notification title/body when nudges fire and expose a REST API for reading notification history, unread counts, and marking notifications as read.

> **Depends on:** Epic 8e (nudge templates must exist to generate title/body).

#### Backend
- **Model:** Add `title = CharField(max_length=200, blank=True, default="")`, `body = TextField(blank=True, default="")`, and `read_at = DateTimeField(null=True, blank=True)` to `ReminderEvent`. `read_at` is a lightweight "seen" flag, distinct from `acknowledged` which deactivates the schedule.
- **Nudge engine:** In `core/nudge.py`, after `sender.send()` succeeds, store `title` and `body` on the event alongside `notification_sent`.
- **REST API:** New module `core/in_app_notifications/` with four endpoints:
  - `GET /api/notifications/` — list sent events for user, ordered by `-triggered_at`, paginated. Optional `?unread_only=true`.
  - `GET /api/notifications/unread-count/` — returns `{"count": N}`.
  - `POST /api/notifications/{id}/read/` — sets `read_at=now()`. Returns 204.
  - `POST /api/notifications/read-all/` — bulk marks all unread as read. Returns 204.
- **Tests:** All four endpoints, authorization isolation (user A can't see user B's events), pagination, nudge engine stores title/body on event.

#### Frontend
- No frontend changes in this epic (API only).

#### Implementation Notes:
- **User scoping via join:** `ReminderEvent` has no direct `user` FK; all queries filter through `schedule__user=request.user`. This is a join query but fine for MVP scale.
- **`read_at` vs `acknowledged`:** `read_at` marks "seen in notification center" (set by the REST API). `acknowledged` means "user actively dismissed the nudge" (deactivates the schedule). These are independent fields — reading a notification does not acknowledge the underlying schedule.
- **`_parse_pagination` duplication:** The manual limit/offset pagination helper is duplicated across view modules (tasks, lists, in_app_notifications). This is intentional per existing codebase convention — no shared utility yet.
- **Bulk mark-all-read preserves existing `read_at`:** The `read-all` endpoint only updates events where `read_at IS NULL`, so previously-read timestamps are not overwritten.
- **`notification_payload` includes `schedule_id`:** Exposed so the frontend can link a notification back to its originating schedule/task if needed (e.g., for deep-linking to the task).

---

### Epic 8j: WebSocket Notification Delivery — COMPLETED

**Objective:** Push nudge notifications to connected browsers in real time via WebSocket. When the nudge engine fires a notification, it also sends to the user's WebSocket channel.

> **Depends on:** Epic 8h (ASGI + Channels infrastructure), Epic 8i (title/body stored on events).

#### Backend
- **Consumer:** Create `core/ws/consumers.py` — `NotificationConsumer(AsyncJsonWebsocketConsumer)`. On connect: authenticate (via JWT middleware from 8h), join channel group `notifications_{user_id}`. On disconnect: leave group. No client→server messages needed.
- **Routing:** Create `core/ws/routing.py` — `ws/notifications/` → `NotificationConsumer`. Wire into `config/asgi.py` `ProtocolTypeRouter`.
- **Nudge engine integration:** In `core/nudge.py`, after `sender.send()` and event save, send notification payload to channel layer via `async_to_sync(channel_layer.group_send)`.
- **Tests:** Consumer receives notification when channel layer message sent. Integration test: `process_due_reminders` sends to channel layer.

#### Frontend
- **WebSocket hook:** Create `hooks/useNotificationSocket.ts` — connects to `ws://<host>/ws/notifications/?token=<accessToken>` when authenticated. Parses incoming JSON messages. Auto-reconnect with exponential backoff. Disconnects on logout.
- **Types + API service:** Create `types/notification.ts` and `services/notificationApi.ts` (for REST endpoints from 8i — used by the notification panel).

#### Implementation Notes:
- **Routing file:** Used the existing `core/ws/urls.py` (created in Epic 8h as a placeholder) instead of creating a separate `core/ws/routing.py`. The URL patterns were already wired into `config/asgi.py`, so adding the route there avoided an unnecessary file and extra import.
- **Channel layer guard:** `get_channel_layer()` is checked for `None` before sending, so the nudge engine degrades gracefully if the channel layer is unavailable (e.g. Redis down). Push notifications via FCM still fire regardless.
- **Payload reuse:** The WebSocket payload reuses `notification_payload()` from `core/in_app_notifications/views.py` to keep the REST and WS shapes identical.
- **Frontend reconnect guard:** A `closingRef` flag prevents the `onclose` handler from scheduling reconnects after an intentional disconnect (logout or unmount).

---

### Epic 8k: Frontend Notification UI — COMPLETED

**Objective:** Build the user-facing notification experience: toast alerts, notification bell with badge, notification history panel, and Browser Notification API integration.

> **Depends on:** Epic 8j (WebSocket delivers notifications to the frontend).

#### Frontend
- **Toast system:** Create `contexts/ToastContext.tsx` (queue management, auto-dismiss 6s, max 3 visible) and `components/Toast.tsx` + `Toast.css` (fixed bottom-right overlay, slide-in animation, click navigates to task, dismiss X button).
- **Browser notifications:** Create `hooks/useBrowserNotifications.ts` — `requestPermission()`, `showBrowserNotification(title, body)` via `new Notification()`. Skip on native platforms. No service worker needed (foreground only).
- **Notification bell:** Create `components/NotificationBell.tsx` — bell SVG icon in `AppHeader`, red badge with unread count (initial from `GET /api/notifications/unread-count/`, then updated by WebSocket). Click toggles panel.
- **Notification panel:** Create `components/NotificationPanel.tsx` + `.css` — dropdown below bell. Lists notifications from `GET /api/notifications/`. Title, body, relative time. Unread items highlighted. Click item → navigate to task + mark read. "Mark all read" button. Click-outside-to-close.
- **App.tsx integration:** Add `ToastProvider` inside `BrowserRouter`. Add `NotificationSocketBridge` component (thin — runs WebSocket hook, bridges to toast + browser notifications + badge). Add `ToastContainer` after `BottomNav`. Add `NotificationBell` in `AppHeader`.

#### Backend
- No backend changes in this epic.

#### Implementation Notes:
- **NotificationContext added:** The plan called for state to live in the bell/bridge components, but a lightweight `contexts/NotificationContext.tsx` was introduced to share `unreadCount`, `notifications`, `addNotification`, `handleMarkRead`, and `handleMarkAllRead` across the bell, panel, and bridge without prop drilling.
- **Toast separation:** `ToastContext.tsx` owns queue logic only (add, auto-dismiss, max 3). Rendering lives in `components/Toast.tsx` + `Toast.css`, keeping the context layer free of JSX/CSS concerns.
- **Auth guard on bridge:** `NotificationSocketBridge` checks `isAuthenticated` before requesting browser notification permission and renders nothing when unauthenticated, avoiding unnecessary hook execution on public pages (login, register).
- **`handleMarkRead` guard:** The unread count is only decremented when the notification's `read_at` was actually null, preventing double-decrement if called on an already-read notification.
- **Bug fix (Epic 8j):** `useNotificationSocket.ts` imported `useAuth` from `./useAuth` (nonexistent sibling); corrected to `../contexts/useAuth`. This was a pre-existing issue that blocked production builds.
- **Mobile panel:** `NotificationPanel` switches to full-width fixed positioning at ≤768px (below the header) for mobile usability.

---

## Epic 9: Habits & Completions — COMPLETED

**Objective:** Habits with target frequency and reminder times; log completion/skip; streak and history.

### Backend
- Habit model: user_id, name, target_frequency, reminder_times (e.g. JSON array), streak_count, last_completed_at. HabitCompletions: habit_id, completed_at, skipped.
- API: `GET /habits`, `POST /habits`, `PATCH /habits/{id}`, `DELETE /habits/{id}` (cascade delete completions and reminder schedules). `POST /habits/{id}/complete` (body: completed or skipped); update streak and last_completed_at.
- Habit name required, max 200 chars. reminder_times in user timezone (HH:MM).

### Frontend
- Habits screen: list habits (name, streak, e.g. “7 day streak” or “3/7 this week”).
- Add habit: name, target frequency, reminder times.
- “Done” / “+” (and optional “Skip”) to log completion for current period.
- Edit/delete habit with confirmation. Empty and loading states.

### Implementation Notes:
- **Status:** Done. All objectives met.
- **Backend:** `Habit` and `HabitCompletion` models in `core/models.py`. `HabitFrequency` TextChoices enum (daily, weekly, monthly). API at `/api/habits/` with full CRUD + `POST /api/habits/{id}/complete/`. Module at `core/habits/` with `serializers.py`, `views.py`, `urls.py`, `streak.py`. Streak logic in `core/habits/streak.py`: period boundaries (daily/weekly/monthly) computed in user timezone via `zoneinfo.ZoneInfo`; streak increments when target_count met for current period and previous period was also met; resets to 1 when previous period missed. `period_completions` is a computed field returned per habit (count of non-skipped completions in current period). Complete endpoint accepts `{ skipped: bool }` — default `false` means “completed”, `true` means “skip” (does not affect streak or last_completed_at). 31 tests in `core/tests/test_habits.py`.
- **Plan vs implementation:** The plan's single `target_frequency` field was split into two: `frequency` (the period type: daily/weekly/monthly) and `target_count` (how many completions per period, default 1). This provides cleaner semantics — e.g., “3 times per week” is `frequency=weekly, target_count=3`. The complete endpoint body uses `{ skipped: bool }` rather than `{ completed: bool }` — the default (no body or `skipped=false`) means a successful completion.
- **ReminderSchedule FK migration:** Converted `habit_id = IntegerField` placeholder to `habit = ForeignKey(Habit, CASCADE)`. The 3-way XOR constraint updated Q lookups from `habit_id__isnull` to `habit__isnull`. Existing nudge engine tests (45 tests) updated and passing. Migration `0012`.
- **Frontend:** `HabitsScreen` at `/habits` with search filter, add/edit/delete/complete/skip flows. Components: `HabitList`, `HabitListItem` (expand/collapse with streak badge, “+” done button, skip in expanded details), `HabitFormModal` (name, frequency select, target count, dynamic reminder time inputs). Types in `types/habit.ts`, API in `services/habitApi.ts`, hooks in `hooks/useHabits.ts`. BottomNav updated with Habits link (repeat/cycle icon).
- **Caveats:** `period_completions` is computed per-habit in the list view (one count query per habit). For users with many habits this could become an N+1 concern — consider annotating the queryset with a filtered Count in a future optimization pass. `HabitCompletion.completed_at` uses `auto_now_add=True` so it cannot be set manually via `create()`; tests that need backdated completions use `.filter().update()`. Streak updates are not protected against concurrent requests (no `select_for_update` or `F()` expression) — acceptable for single-user MVP but may need hardening if habit completions become high-throughput.

---

## Epic 10: Habit Reminders (Nudge Engine Integration) — COMPLETED

**Objective:** Habits use same ReminderSchedules and nudge engine; list-level semantics for habit reminder times.

### Backend
- When habit is created/updated, create or update ReminderSchedule with habit_id (no task_id). Worker already supports habit_id; apply same retry/escalation logic.
- Recurrence from habit target_frequency and reminder_times (e.g. daily at 09:00).

### Frontend
- Habit form: set reminder times; display next reminder on habit card if API provides it.

### Implementation Notes:
- **One ReminderSchedule per (habit, reminder_time):** A habit with `reminder_times: ["09:00", "18:00"]` creates two separate schedules. The `recurrence_rule` field stores the HH:MM string (not an RRULE) so the worker knows which time slot to advance to tomorrow.
- **Daily cadence regardless of frequency:** Reminders fire every day at each configured time. The `frequency` field (daily/weekly/monthly) only controls streak/target tracking, not reminder cadence.
- **Default priority 2** (`HABIT_DEFAULT_PRIORITY` in `schedules.py`): Habits have no priority field; all use `PRIORITY_NUDGE_CONFIG[2]` (60-min retry, 10 max attempts). If habit priority is needed later, add a model field and reference it in `sync_habit_schedule`.
- **Habit-specific worker advancement:** After a habit reminder fires, the worker advances `next_trigger_at` to tomorrow at the same time and resets `attempt_count=0`, bypassing the normal retry/escalation/deactivation logic. Habits never deactivate from max_attempts — they recur indefinitely.
- **`next_reminder_at` in API:** Computed via `Min('reminder_schedules__next_trigger_at', filter=Q(is_active=True))` annotation on Habit querysets. POST and PATCH re-fetch the habit with the annotation to include it in the response.
- **Habit nudge templates:** `nudge_templates.py` has `HABIT_NUDGE_TEMPLATES` (no streak) and `HABIT_STREAK_TEMPLATES` (streak > 0) with `{habit_name}`, `{streak_count}`, and `{next_streak}` placeholders. Selection function is `select_habit_nudge()`.
- **Caveats:** Habits have no mute mechanism — `_is_muted()` returns False for habit schedules. If habit muting is needed, add a `muted_until` field to Habit and update `_is_muted`. The `compute_next_habit_trigger` helper is public (used by both `schedules.py` and `nudge.py`).

---

## Epic 11: Friends & Invitations

**Objective:** Invite by email or username; accept/decline; list friends; remove friend. Symmetric friendship.

### Backend
- Friendships (user_id, friend_id; unique pair, normalized so user_id < friend_id). FriendInvitations: from_user_id, to_user_id or to_email, status (pending, accepted, declined), responded_at.
- API: `GET /friends`, `POST /friends/invite` (to_email or to_username), `GET /friends/invitations` (sent/received, optional ?status=pending), `PATCH /friends/invitations/{id}` (accept/decline), `DELETE /friends/{user_id}` (remove friendship). On accept: create both (A,B) and (B,A) friendship rows; one pending invite per (from, to) or (from, to_email).
- **Invite-by-email (non-user flow):** When the invited email does not match an existing account, send an email (via the email system interface from Epic 1b) containing a sign-up link. The invitation is stored with `to_email` (no `to_user_id` yet) and status `pending`. When the recipient registers with that email, the system links the pending invitation to their new account (sets `to_user_id`) so it appears in their received invitations for acceptance. The friendship is **not** auto-created — the new user must still explicitly accept.

### Frontend
- Friends screen (from header or Settings): list friends; list sent/received invitations (pending, accepted, declined).
- Invite: enter email or username; send invite. Show status "Awaiting signup" for invitations sent to non-users.
- Accept/decline on received invite. Remove friend with confirmation.

### Implementation Notes: COMPLETED
- **Friendship storage deviation:** The plan says "create both (A,B) and (B,A) friendship rows" but we store a single normalized row where `user_id < friend_id`. This avoids data duplication and is enforced by a unique constraint. `get_friends()` queries both sides via `Q(user=u) | Q(friend=u)`.
- **Backend app:** New `core/friends/` module with `services.py` (business logic), `serializers.py` (payload helpers + DRF serializers), `views.py` (APIView endpoints), `urls.py`. Migration: `0013_friendinvitation_friendship`.
- **Registration hook:** `link_pending_invitations(user)` is called in `RegisterView.post()` after user creation. Only links invitations with `status="pending"`.
- **Invite-by-email:** Uses `get_email_sender()` from `core.email` to send sign-up link. `FRONTEND_ORIGIN` setting provides the base URL.
- **Duplicate invite prevention:** Enforced at both DB level (partial unique constraints on pending status) and service layer (explicit checks before creation).
- **Frontend:** FriendsScreen at `/friends` with tab UI (Friends / Received / Sent). Added to AppHeader nav and BottomNav. Uses TanStack Query hooks following existing patterns.
- **40 backend tests** covering models, service layer, and all API endpoints including edge cases (self-invite, duplicate, wrong user, registration linking).

---

## Epic 12: Friends – Task Linking & Create Task for Friend

**Objective:** Link friends to a task; create a task owned by a friend (created_by_user_id); only friends can be linked or create for you.

### Backend
- task_linked_friends (task_id, user_id); tasks.created_by_user_id. Only allow link/create when inviter and owner are friends; recipient is task owner.
- API: PATCH task with linked_friend_ids; or POST to create task for friend (e.g. `POST /users/{id}/tasks` or `POST /tasks` with owner_id/created_for_user_id).
- **Filter:** `GET /tasks?created_for_me=true` (or equivalent) to let users see tasks created for them by friends. Also support filtering by `created_by_user_id` for attribution views.
- **Notifications (MVP):** When a task with linked friends is completed or becomes overdue, notify linked friends via the nudge engine / push notification system (Epic 13b). This is in-scope for MVP, not deferred.

### Frontend
- Task create/edit: multi-select to link friends to task; optional “Create for friend” (select friend) so task appears in friend’s list. Show “Created by [friend]” / “Suggested by [friend]” and linked friends on task.
- Filter/view for “Created for me” tasks so users can easily find friend-assigned tasks.

### Implementation Notes:
*(To be completed when epic is done.)*

---

## Epic 13a: Push Notification Dependencies — External Setup

**Objective:** Set up all external provider accounts and credentials required for push notifications so Epic 13b is not blocked by external dependencies.

> **Start this epic early (in parallel with Epics 9–12).** These are external dependencies with lead times (Apple Developer review, Firebase project setup, etc.).

### Setup Checklist
- **Firebase:** Create Firebase project; enable Cloud Messaging (FCM v1 API). Generate service account key for backend. Note: FCM is used for both Android and iOS push delivery.
- **Apple Developer:** Ensure Apple Developer Program membership is active. Create APNs key (`.p8`) or certificate; upload to Firebase for FCM-to-APNs relay. Configure App ID with Push Notifications capability.
- **Google Play (optional for MVP):** If distributing Android builds, create Google Play Console app entry. Not strictly required for push — FCM works without Play Store listing during development.
- **Environment:** Add `FIREBASE_SERVICE_ACCOUNT_KEY` (path or JSON) to `.env.example` and backend settings. Document required env vars in `.docs/be_docs.md`.

### Implementation Notes:
*(To be completed when epic is done.)*

---

## Epic 13b: Push Notifications & Device Registration

**Objective:** Register device token with FCM; nudge engine sends push to user devices; token cleanup on invalid/unregistered.

**Depends on:** Epic 13a (credentials), Epic 8 (nudge engine worker).

### Backend
- DeviceTokens: user_id, device_id, platform (ios/android/web), token. `POST /device/register` (auth; body: platform, token, optional device_id). One token per (user_id, device_id); replace on re-register.
- Worker: when sending nudge, resolve user’s device tokens and send via FCM. On FCM invalid/unregistered, remove token.
- **Friend-linked task notifications:** When a task with linked friends is completed or becomes overdue, send a push notification to each linked friend’s devices. Notification type should be distinguishable from standard nudges (e.g. "Your friend completed [task]" or "[task] assigned to [owner] is overdue").
- Rate limiting: per-user caps on nudges per hour/day per §12.

### Frontend
- Request notification permission; obtain FCM token (Capacitor plugin or web FCM SDK). Call `POST /device/register` with platform and token (and device_id if available). Handle foreground/background per platform.

### Implementation Notes:
*(To be completed when epic is done.)*

---

## Epic 14: Theme & UI Shell

**Objective:** Global layout (header, center, footer); bottom nav (Tasks | Lists | Habits); theme system (ROYGBV + Turquoise) per UI/UX §2–§4.

### Backend
- Store theme (and timezone) in user profile if not already; `PATCH /users/me` for theme preference.

### Frontend
- Theme: design tokens (HSL hue-based); theme picker (Red, Orange, Yellow, Green, Blue, Violet, Turquoise). Apply tokens to surface, primary, border, text, success, destructive.
- Layout: header (app name, account/settings entry), scrollable center (main content), footer (sticky bottom nav: Tasks, Lists, Habits). One section visible at a time on mobile; center swaps by nav.
- Typography and spacing per UI/UX §3; touch targets ≥44px; empty/loading/error states pattern.

### Implementation Notes:
*(To be completed when epic is done.)*

---

## Epic 15: Settings & Account

**Objective:** Settings screen: theme, timezone, notification preferences, account (profile, change password, logout).

### Backend
- Profile: timezone (IANA), notification preferences if any. Password change endpoint if not in Epic 2.

### Frontend
- Settings screen (from header): theme picker (link to Epic 14 tokens), timezone selector, notification prefs, account (email display, change password, logout). Consistent with UI/UX §5.5.

### Implementation Notes:
*(To be completed when epic is done.)*

---

## Epic 16: E2E, CI & Release Readiness

**Objective:** Critical-path E2E tests; CI (unit + integration + E2E); staging environment; production deploy and mobile distribution.

### Backend
- Staging env (mirrors production Docker Compose). CI: run unit and integration tests on commit/PR; run E2E against staging. PostgreSQL backups; single Celery Beat; Redis persistence; FCM token cleanup verified.

### Frontend
- E2E (e.g. Playwright or Cypress): sign-up/login, create/edit/complete task, create list and add tasks, create habit and log completion, receive nudge (or simulate). Unique HTML IDs for selectors per .cursor/rules.

### Implementation Notes:
*(To be completed when epic is done.)*

---

## Sprint Order

| Order | Epic | Rationale |
|-------|------|-----------|
| 1 | Project Setup & Infrastructure | Foundation |
| 1b | Email System Interface | Interface + stdout adapter; required before Auth |
| 2 | Authentication (Email/Password) | Required for all user features |
| 3 | Authentication (OAuth) | Optional but part of MVP scope |
| 4 | User Profile & Username | Needed for Friends (username) |
| 4b | Pre-commit Hooks (Lint & Format) | Enforce code quality from this point forward |
| 4c | CI Pipeline (Lint, Format & Tests) — COMPLETED | Catch regressions on every push/PR |
| 14 | Theme & UI Shell | Global layout + design tokens before building screens |
| 5a | Tasks CRUD — Backend | Core domain model and API |
| 5b | Tasks CRUD — Frontend | Tasks screen; first TanStack Query adoption |
| 5c | Task Detail View (Tap-to-Expand) | View task details inline; quick win before lists |
| 6 | Lists CRUD & Task–List Association — COMPLETED | Builds on tasks |
| 7 | Task Mute & Snooze | Quick win on tasks |
| 8a | Nudge Engine — Spike & Design | ⚠ Architectural spike before implementation |
| 8b–n | Nudge Engine — Implementation | Sub-epics defined by spike output |
| 9 | Habits & Completions | Parallel to tasks/lists |
| 10 | Habit Reminders | Depends on habits and Epic 8 |
| 11 | Friends & Invitations | Social foundation |
| 12 | Friends – Task Linking & Create for Friend | Depends on friends and tasks |
| 13a | Push Notification Dependencies | ⏳ Start in parallel with Epics 9–12 |
| 13b | Push Notifications & Device Registration | Depends on nudge engine + 13a credentials |
| 15 | Settings & Account | Ties profile, theme, prefs |
| 16 | E2E & Release Readiness | Final E2E tests, staging, deploy |
