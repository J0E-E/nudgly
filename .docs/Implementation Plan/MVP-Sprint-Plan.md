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

## Epic 4b: Pre-commit Hooks (Lint & Format Auto-fix)

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
*(To be completed when epic is done.)*

---

## Epic 4c: CI Pipeline (Lint, Format & Tests)

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
*(To be completed when epic is done.)*

---

## Epic 5a: Tasks CRUD — Backend

**Objective:** Task model and full REST API: create, list, edit, delete, mark complete; categories and priorities per app-idea §3–§4.

### Backend
- Task model per schema §8: title, description, due_date, category, tag, priority, recurring (nullable), status, list_id (nullable), created_at, completed_at, muted_until (nullable). Omit friend-related fields until Epic 12.
- Categories and priorities: use defined enums/choices from app-idea §3.
- API: `GET /tasks` (pagination: limit/offset; filter by status, list_id later), `POST /tasks`, `GET /tasks/{id}`, `PATCH /tasks/{id}`, `DELETE /tasks/{id}`.
- Ordering: due_date (nulls last), then created_at ascending.
- Validation: title required, max 500 chars; category/priority from enum.

### Frontend
- No frontend work in this epic.

### Implementation Notes:
*(To be completed when epic is done.)*

---

## Epic 5b: Tasks CRUD — Frontend

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
*(To be completed when epic is done.)*

---

## Epic 6: Lists CRUD & Task–List Association

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
*(To be completed when epic is done.)*

---

## Epic 7: Task Mute & Snooze

**Objective:** Users can mute a task (or snooze from UI) so the nudge engine skips it until `muted_until`.

### Backend
- `muted_until` already on task model; expose in PATCH (e.g. `muted_until` ISO datetime or preset: 1h, 1d, 1wk from now).
- Validation: optional preset or explicit datetime in UTC.

### Frontend
- Task detail or row action: “Mute” / “Snooze” with options (e.g. 1h, 1d, 1wk). Set `muted_until` via API.
- Visual indicator on task when muted (e.g. icon or label until time).

### Implementation Notes:
*(To be completed when epic is done.)*

---

## Epic 8: Reminder Schedules & Nudge Engine

> **⚠ HIGH RISK — Spike required before implementation.**
> This is the most architecturally complex epic in the MVP. It introduces Celery (Beat + worker), idempotent event processing, retry/escalation logic, and cross-model scheduling. A dedicated spike (Epic 8a) must be completed first to produce a detailed design and validate assumptions before any code is written.

### Epic 8a: Nudge Engine — Spike & Design

**Objective:** Produce a detailed technical design document for the nudge engine. Validate architectural decisions with a proof-of-concept.

#### Deliverables
- Design doc covering: ReminderSchedule and ReminderEvent models (schema, constraints, indexes); idempotency strategy (unique constraint on schedule_id + triggered_at bucket — validate with edge cases); Celery Beat configuration and periodic task design; worker flow (query → filter muted → create event → send notification → update next_trigger_at); retry/escalation logic and priority-to-interval mapping per §9.1; failure modes (worker crash mid-batch, Redis down, duplicate delivery).
- Proof-of-concept: Celery Beat + worker running in Docker Compose, processing a dummy schedule and writing events. Validates that the infrastructure works before building real logic.
- Output: Sub-epic breakdown (8b, 8c, 8d, …) with scope and ordering for implementation.

#### Implementation Notes:
*(To be completed when epic is done.)*

### Epic 8b–8n: Nudge Engine — Implementation (sub-epics TBD by spike)

**Objective:** Implement the nudge engine per the design produced in Epic 8a.

The spike (8a) will produce the specific sub-epic breakdown. Expected areas include:
- **Infrastructure:** Celery Beat + worker containers in Docker Compose; Redis as broker.
- **Models:** ReminderSchedule, ReminderEvent with idempotency constraints.
- **Scheduling logic:** Create/update schedules on task create/update; link to due dates and RRULE recurrence.
- **Worker logic:** Process due schedules, respect mute/snooze, create events, send notifications (stub), update next_trigger_at with retry + jitter.
- **Escalation:** Priority → retry_interval and max_attempts mapping per §9.1; persistent nudging.

### Frontend
- Optional: show “Next nudge” or “Last nudge” on task/habit card if API exposes it (read-only). Enables validation that schedules exist and worker runs.

### Implementation Notes:
*(To be completed when epic is done.)*

---

## Epic 9: Habits & Completions

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
*(To be completed when epic is done.)*

---

## Epic 10: Habit Reminders (Nudge Engine Integration)

**Objective:** Habits use same ReminderSchedules and nudge engine; list-level semantics for habit reminder times.

### Backend
- When habit is created/updated, create or update ReminderSchedule with habit_id (no task_id). Worker already supports habit_id; apply same retry/escalation logic.
- Recurrence from habit target_frequency and reminder_times (e.g. daily at 09:00).

### Frontend
- Habit form: set reminder times; display next reminder on habit card if API provides it.

### Implementation Notes:
*(To be completed when epic is done.)*

---

## Epic 11: Friends & Invitations

**Objective:** Invite by email or username; accept/decline; list friends; remove friend. Symmetric friendship.

### Backend
- Friendships (user_id, friend_id; unique pair, normalized so user_id < friend_id). FriendInvitations: from_user_id, to_user_id or to_email, status (pending, accepted, declined), responded_at.
- API: `GET /friends`, `POST /friends/invite` (to_email or to_username), `GET /friends/invitations` (sent/received, optional ?status=pending), `PATCH /friends/invitations/{id}` (accept/decline), `DELETE /friends/{user_id}` (remove friendship). On accept: create both (A,B) and (B,A) friendship rows; one pending invite per (from, to) or (from, to_email).

### Frontend
- Friends screen (from header or Settings): list friends; list sent/received invitations (pending, accepted, declined).
- Invite: enter email or username; send invite.
- Accept/decline on received invite. Remove friend with confirmation.

### Implementation Notes:
*(To be completed when epic is done.)*

---

## Epic 12: Friends – Task Linking & Create Task for Friend

**Objective:** Link friends to a task; create a task owned by a friend (created_by_user_id); only friends can be linked or create for you.

### Backend
- task_linked_friends (task_id, user_id); tasks.created_by_user_id. Only allow link/create when inviter and owner are friends; recipient is task owner.
- API: PATCH task with linked_friend_ids; or POST to create task for friend (e.g. `POST /users/{id}/tasks` or `POST /tasks` with owner_id/created_for_user_id). Notify linked friends when task completed/overdue (can be stub or real in Epic 13).

### Frontend
- Task create/edit: multi-select to link friends to task; optional “Create for friend” (select friend) so task appears in friend’s list. Show “Created by [friend]” / “Suggested by [friend]” and linked friends on task.

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
| 4c | CI Pipeline (Lint, Format & Tests) | Catch regressions on every push/PR |
| 14 | Theme & UI Shell | Global layout + design tokens before building screens |
| 5a | Tasks CRUD — Backend | Core domain model and API |
| 5b | Tasks CRUD — Frontend | Tasks screen; first TanStack Query adoption |
| 6 | Lists CRUD & Task–List Association | Builds on tasks |
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
