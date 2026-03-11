# Nudgly – MVP Sprint Plan

**Purpose:** Break the MVP into small epics with explicit FE and BE components. At the end of each epic, the delivered slice can be built, tested, and validated before proceeding.

**Scope:** Per [app-idea §16 MVP Definition](../Design%20Docs/app-idea.md). Excludes calendar, team collaboration, smart nudging; includes Friends & Social.

**Standards:** Unit tests with every change; modular frontend with dependency injection; unique descriptive HTML IDs; Definition of Done per app-idea §16.

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

## Epic 2: Authentication (Email / Password)

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
*(To be completed when epic is done.)*

---

## Epic 3: Authentication (OAuth – Gmail & Apple)

**Objective:** Sign-in with Google and Apple in addition to email/password.

### Backend
- OAuth integration (e.g. django-allauth or custom): Gmail (Google), Apple.
- Link OAuth identity to User; create user on first sign-in if needed.
- Return same JWT contract as email login so FE is unchanged.

### Frontend
- “Sign in with Google” and “Sign in with Apple” buttons on Login/Register.
- OAuth callback handling (redirect or deep link); exchange code for tokens and update auth state.

### Implementation Notes:
*(To be completed when epic is done.)*

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
*(To be completed when epic is done.)*

---

## Epic 5: Tasks CRUD

**Objective:** Full task lifecycle: create, list, edit, delete, mark complete; categories and priorities per app-idea §3–§4.

### Backend
- Task model per schema §8: title, description, due_date, category, tag, priority, recurring (nullable), status, list_id (nullable), created_at, completed_at, muted_until (nullable). Omit friend-related fields until Epic 12.
- Categories and priorities: use defined enums/choices from app-idea §3.
- API: `GET /tasks` (pagination: limit/offset; filter by status, list_id later), `POST /tasks`, `GET /tasks/{id}`, `PATCH /tasks/{id}`, `DELETE /tasks/{id}`.
- Ordering: due_date (nulls last), then created_at ascending.
- Validation: title required, max 500 chars; category/priority from enum.

### Frontend
- Tasks screen: list tasks (checkbox to complete, title, due date, category/priority indicators).
- Add task: form (title, description, due date, category, priority, tag optional).
- Edit task: same fields; open from list row or detail.
- Delete: with confirmation (per UI/UX §7).
- Search/filter bar (by title/notes; category, priority) per UI/UX §5.1.
- Empty state and loading state.

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

## Epic 8: Reminder Schedules & Nudge Engine (Backend)

**Objective:** ReminderSchedule and ReminderEvent models; Celery Beat + worker; idempotency; mute/snooze respected; escalation and retry per app-idea §9.

### Backend
- ReminderSchedule model: user_id, task_id or habit_id (exactly one), recurrence_rule, next_trigger_at, retry_interval_minutes, persistent, max_attempts. ReminderEvent: schedule_id, triggered_at, attempt_number, acknowledged (idempotency key: schedule_id + triggered_at bucket).
- Create/update schedules when tasks (and later habits) are created/updated; link to task due dates and recurrence (RRULE per app-idea).
- Celery Beat: periodic task (e.g. every minute) to enqueue “process due reminders.”
- Celery worker: query schedules with next_trigger_at <= now; skip if task/list/habit muted; insert ReminderEvent (unique constraint to avoid double-send); send notification (stub or FCM later); update next_trigger_at with retry + small random offset; respect max_attempts and persistent.
- Priority → retry_interval and max_attempts mapping per §9.1.

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

## Epic 13: Push Notifications & Device Registration

**Objective:** Register device token with FCM; nudge engine sends push to user devices; token cleanup on invalid/unregistered.

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

## Suggested Sprint Order

| Order | Epic | Rationale |
|-------|------|-----------|
| 1 | Project Setup & Infrastructure | Foundation |
| 2 | Authentication (Email/Password) | Required for all user features |
| 3 | Authentication (OAuth) | Optional but part of MVP scope |
| 4 | User Profile & Username | Needed for Friends (username) |
| 5 | Tasks CRUD | Core domain |
| 6 | Lists CRUD & Task–List Association | Builds on tasks |
| 7 | Task Mute & Snooze | Quick win on tasks |
| 8 | Reminder Schedules & Nudge Engine | Depends on tasks (and lists for list-level nudge) |
| 9 | Habits & Completions | Parallel to tasks/lists |
| 10 | Habit Reminders | Depends on habits and Epic 8 |
| 11 | Friends & Invitations | Social foundation |
| 12 | Friends – Task Linking & Create for Friend | Depends on friends and tasks |
| 13 | Push Notifications & Device Registration | Depends on nudge engine |
| 14 | Theme & UI Shell | Can be done earlier (e.g. after Auth) if desired |
| 15 | Settings & Account | Ties profile, theme, prefs |
| 16 | E2E, CI & Release Readiness | Final validation and deploy |

*Theme & UI Shell (14) can be moved earlier—e.g. after Auth—so all subsequent epics use the same layout and theme from the start.*
