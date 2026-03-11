# Nudgly – Functional & Technical Design Document

**Project:** Nudgly  
**Type:** Cross-platform ADHD reminder / nudge application  
**Date:** 2026-03-08  

*Product and repo name: Nudgly.*

---

# 1. Overview

## Purpose

Nudgly is a task reminder and behavioral nudge application designed for people with ADHD. Unlike traditional reminder apps that trigger once and disappear, Nudgly provides persistent nudges that continue until the user acknowledges or completes a task.

The system helps users overcome:

- Forgetfulness
- Task avoidance
- Notification blindness
- Poor time awareness

---

# 2. Goals

## Primary Goals

- Persistent reminder system
- Escalating notifications
- Cross-platform support
- Simple UX
- Low operational cost
- Single frontend codebase
- **Friends & social (MVP):** Add/invite friends, link friends to tasks, allow friends to create tasks for you

## Secondary Goals

- Lists (grouped tasks)
- Habit tracker and habit reminders
- Analytics on ignored tasks
- Task timer/countdown for focusing work.
- Smart nudging logic
- Offline-first sync

## V2 - Post-MVP Goals

- Calendar integrations
- Team collaboration

---

# 3. Core Concept: Responsibilities, Goals and Persistent Nudging

Traditional reminder apps work like:

Todos that get stale. Lists that go nowhere. 

Reminder systems that are easy to ignore.

Reminder → Notification → Done

Nudgly works like:

All Tasks, Lists, Goals, and Habits MUST have category and priority set. 

Tone of app should be witty, fun, sarcastic. Voice is **encouraging, not shaming**—nudges should feel like a helpful sidekick, not a judge. Example nudge copy: *"This one’s been staring at you for a while—ready to knock it out?"* / *"Your future self will thank you. Or at least stop side-eyeing you."* / *"Still there. Still waiting. No rush (okay, a little rush)."*

**Categories** (what kind of thing this is—used for grouping and tone of nudges):

- **Treat Myself** — Wants, hobbies, nice-to-haves. The fun stuff only you care about.
- **Glow-Up Agenda** — Health, habits, self-improvement. Main character energy.
- **Adulting™** — Bills, admin, life maintenance. Nobody else is gonna do it.
- **I Said I Would** — Commitments to others, promises. Someone’s counting on you.
- **The Inevitable** — Non-negotiable, duty, things that will hunt you down eventually.

**Priorities** (stakes / why it matters—low to high; influences nudge frequency and escalation):

- **No one cares** — Literally only you. Do it or don’t; the world won’t notice.
- **No one is watching** — You could skip and nobody’d know. (Your conscience might, though.)
- **I’ll feel guilty** — Your future self will side-eye you.
- **Others are watching** — Someone might notice if you don’t.
- **Others will be let down** — People are counting on you. Don’t ghost them.
- **I’ll let myself down** — This one hits different. The stakes are personal.   

Nudgly will remind/nudge on all items not just items with due dates. 

Nudgly will nudge as due date is approaching, then escalate after due date. 

Nudgly should employ creative reminder/nudging times/alerts. 

**Nudging** Based on priority, nudging should occur to remind the user that the task exists and provide options to complete, move, or re-prioritize. Push notifications or local system. 

---

# 4. Functional Requirements

## User Accounts

Users must be able to:

- Register (including setting up a username, @userName)
- Log in
- Log out
- Reset password
- Manage profile

Authentication:

- Email/password and OAuth (Gmail / Apple) in scope for MVP
- Username (@userName) is required at signup and is used for identity (e.g. friends, sharing)

---

## Tasks

Users can:

- Create tasks
- Edit tasks
- Delete tasks
- Mark tasks complete (archived to "completed" section)
- Mute/snooze tasks (block nudging until a chosen time: 1h, 1d, 1wk, etc.; store as `muted_until` so nudge engine skips until after that time. User can set this from task settings as "Mute" or from a notification/UI as "Snooze 1h/1d"—same semantics, one field.)
- Move tasks to list (see below)

Fields (all user fields required):

- title
- description/notes
- due date
- category
- tag (user defined for sorting/filtering)
- priority
- recurring
- status: `pending`, `completed`, `cancelled`
- muted_until (nullable; UTC; nudge engine skips this task until after this time; set via "Mute" in settings or "Snooze" from notification/UI)
- list_id (optional; null = Tasks)
- created_by_user_id (nullable; set when a friend creates this task for you; see Friends & Social)
- linked_friend_ids (via task_linked_friends; friends associated with this task for accountability/context)
- created_at
- completed_at

**Task ordering (MVP):** Default order is by `due_date` (nulls last), then `created_at` ascending. Manual reorder (e.g. drag-and-drop and `sort_order`) is out of scope for MVP; add in a later iteration if needed.

**Recurring tasks (MVP):** Use full **RRULE** (iCalendar recurrence) for recurrence. When a recurring task is not completed by its due time, the next instance is not created as a separate row; instead, the same task is shown with a stacked indicator (x2, x3, x4…) and nudge intensity increases (e.g. shorter retry_interval or higher max_attempts). When the user completes the task, the stack resets and the next instance is scheduled per the recurrence rule.

---

## Todo Lists

Users can: 

- Create Lists
- Edit Lists
- Delete Lists
- Mark tasks on list complete.
- **Mark list complete:** Batch operation that marks all incomplete tasks in the list as complete. Does not delete or archive the list.
- Mute list.
- **Archive list:** Set `archived_at` so the list is hidden from the active list view; tasks remain and can be seen via “archived lists” or by moving them back to Tasks. 

Things of note: 

- Lists are grouped tasks with a list-level category, tag, and priority. 
- Category/tag/priority are set at the list level. 
- Nudging happens at the list level: one nudge per list (e.g. "List X has 3 items left"); user opens list to act on tasks. Optionally support per-task nudges for list items in a later iteration—MVP: list-level only.
- Task items in lists still have task-level description/notes, category, tag, priority.
- Tasks item settings are not shown when list items are added, but are available through an edit button for each item. 
- Lists are like a shopping list, items are added and expected to be checked off. 
- Tasks belong to a list (or to the default "Tasks" when no list is set). Tasks is a virtual list: no row in `lists`; tasks with `list_id` null are shown in Tasks.
- List fields: name, category, tag, priority, sort_order, muted_until (nullable; same semantics as task mute), archived_at (optional)
- Tasks reference list_id (nullable = Tasks)
- Tasks list does not need category, tag, priority, etc. 
- API supports: list CRUD, tasks filtered by list, move task between lists.
- **List deletion:** When a list is deleted, set `tasks.list_id = null` for all tasks in that list (they move to the default Tasks view). Do not cascade-delete tasks.

---

## Habit Tracker & Reminders

Habits are recurring behaviors with reminders and optional streak tracking (e.g. medication, hydration, stretching).

Users can:

- Create habits (name, target frequency, reminder times)
- Edit or delete habits
- Log completion (done / skipped)
- View streak and completion history

Habit reminders use the same nudge engine; schedules are recurring by default with persistent nudging until acknowledged.

- Habit fields: name, user_id, target_frequency (e.g. daily, weekly), reminder_times (e.g. 09:00), streak_count, last_completed_at, created_at. MVP: use user timezone only (no per-habit timezone); add timezone on habits only if needed later.
- HabitCompletions (or equivalent) for history: habit_id, completed_at, skipped (boolean)
- Same notification stack (FCM) and retry logic as task reminders.
- **Habit ordering (MVP):** Default order by `created_at` or name; manual reorder out of scope for MVP.
- **Habit deletion:** Cascade delete related `habit_completions` and any `reminder_schedules` for that habit. No soft-delete for MVP.

---

## Friends & Social

Friends & Social is **in scope for MVP**. Users can connect with others, associate friends with tasks, and let friends create tasks on their behalf.

### Adding / inviting friends

Users can:

- Send a friend invitation by email (if that user has an account) or by in-app username/identifier.
- View sent and received invitations (pending, accepted, declined).
- Accept or decline incoming invitations.
- Remove an existing friend (removes both sides of the friendship).

Invitation flow:

- Sender enters email or username; backend looks up the recipient. If found, create a pending invitation; optionally notify recipient (in-app or push).
- Recipient sees invitation in a Friends/Invites area and can Accept or Decline.
- On accept: create a symmetric friendship (both users are each other’s friends). Invitation is marked accepted and no longer shown as pending.

Only one pending invitation may exist between the same two users (sender → recipient). Re-inviting after decline is allowed after a cooldown or immediately (product choice).

### Linking friends to tasks

Users can:

- Attach one or more friends to a task (e.g. “involved” or “accountability”).
- See which friends are linked when viewing/editing a task.
- Remove a friend from a task.

Semantics:

- Linked friends are for context and accountability (e.g. “Joe is in on this”). Optionally, a future iteration could notify linked friends when the task is completed or overdue.
- The task remains owned by the user who created it; linking does not transfer ownership or create a shared task.

Only users who are friends with the task owner can be linked to that task.

### Friends creating tasks for you

Users can:

- Create a task that is owned by a friend (the task appears in the friend’s task list).
- See tasks that were created for them by friends (e.g. “Suggested by [friend]” or “Created for you by [friend]”).

Rules:

- Only a connected friend can create a task for another user.
- The task is owned by the recipient (recipient’s `user_id`); the creator is stored as `created_by_user_id` (or equivalent) for attribution and filtering.
- Recipient can edit, complete, mute, or delete the task like any other task.
- Nudges and reminders apply to the task owner (recipient), not the creating friend.

Use cases: accountability partner adds “Call mom” for you; roommate adds “Buy milk” to your list.

---

## Notification System

Notifications must support:

- iOS push notifications (FCM over APNs)
- Android push notifications (FCM)
- Web push notifications (FCM; best support in Chrome/Edge/Firefox). **Known limitation (MVP):** Safari and iOS Safari have limited or no web push support; document as best-effort and test manually.

---

# 5. System Architecture

React + Capacitor App  
        │  
        ▼  
      Nginx  
        │  
        ▼  
     Django API  
        │  
 ┌───────────────┐  
 ▼               ▼  
PostgreSQL     Redis  
 │               │  
 ▼               ▼  
Data Store    Celery Queue  
                  │  
                  ▼  
             Celery Worker  
                  │  
                  ▼  
       Push Notification Service

---

# 6. Technology Stack

## Frontend

- React
- Capacitor

Advantages:

- Single codebase
- Mobile + web support
- Native notification access

---

## Backend

Framework:

- Django
- Django REST Framework

Reasons:

- Mature ecosystem
- Built-in auth
- Strong ORM
- Large community

---

## Database

Primary database:

PostgreSQL

Reasons:

- Reliable relational model
- Excellent indexing
- Ideal for scheduling queries

---

## Queue System

Broker:

Redis (enable AOF or RDB persistence so Celery queue and in-flight work survive restarts).

Worker system:

Celery

Responsibilities:

- scheduling reminders
- sending notifications
- retry logic

---

## Push Notifications

Service:

Firebase Cloud Messaging (FCM)

Benefits:

- Free
- Cross-platform (Android via FCM; iOS via FCM using APNs under the hood; web via FCM where supported)
- Reliable push delivery

---

# 7. Backend Services

## Django API

Handles:

- authentication
- list CRUD and task-by-list
- task CRUD
- habit CRUD and completion logging
- reminder schedule management (tasks and habits)
- device token registration
- friends and invitations (invite, accept/decline, list friends, remove friend)
- task–friend linking and creating tasks for friends

Example endpoints:

POST /auth/login  
POST /auth/register  

GET /lists  
POST /lists  
PATCH /lists/{id}  
DELETE /lists/{id}  

GET /tasks  
POST /tasks (body may include linked_friend_ids; or use POST /users/{id}/tasks to create a task for friend id)  
PATCH /tasks/{id} (including linking/unlinking friends)  
GET /tasks?list_id={id}

GET /friends  
POST /friends/invite (body: to_email or to_user_id)  
GET /friends/invitations (sent and received; optional ?status=pending)  
PATCH /friends/invitations/{id} (accept or decline)  
DELETE /friends/{user_id} (remove friendship)

GET /habits  
POST /habits  
PATCH /habits/{id}  
POST /habits/{id}/complete  

POST /device/register  
(Request: authenticated; body: platform, token; optional device_id to replace existing token for same device.)

### API contract (idiomatic REST)

- **Pagination:** List endpoints (e.g. `GET /tasks`, `GET /lists`, `GET /habits`) use `limit` and `offset` query params. Default `limit=50`, max `limit=100`. Response includes total count where practical (e.g. `X-Total-Count` header or `meta.total` in body).
- **Errors:** JSON body with `{"detail": "Human-readable message"}` for 4xx/5xx. Use HTTP status codes consistently (401 unauthorized, 403 forbidden, 404 not found, 400 validation error). Validation errors return 400 with `{"detail": "...", "errors": [{"field": "title", "message": "..."}]}` or equivalent.
- **Example — create task:** `POST /tasks` body: `{"title": "Call mom", "description": "...", "due_date": "2026-03-15", "category": "I Said I Would", "priority": 4, "list_id": null}`. Success: `201 Created` with full task object in body; Location header optional.

### Validation & limits

Enforce at API layer; return 400 with clear message when violated.

| Field / rule | Limit / rule |
|--------------|--------------|
| Task title | Required; max 500 characters |
| List name | Required; max 200 characters |
| Habit name | Required; max 200 characters |
| Category, priority | Must be one of the defined enums (see §3 and schema) |
| List names | Duplicate names per user allowed (no uniqueness constraint) |
| reminder_times | In user’s timezone; format e.g. `HH:MM` or ISO time |

**API surface for epic planning:** The full set of MVP endpoints and request/response shapes is defined by the contract above and the schema in §8; derive the endpoint list from §7 example endpoints and §8 entities.

---

## Celery Worker

Responsible for:

- checking scheduled reminders (tasks and habits)
- creating reminder events
- sending push notifications
- scheduling retries
- updating habit next_trigger from recurrence (e.g. daily reset)

---

## Celery Beat

Runs periodic tasks.

Example:

check_reminders_task every minute

---

# 8. Database Schema

## Users

users  
id  
email  
password_hash  
timezone (e.g. IANA; used for all reminder times in MVP)  
created_at

---

## Lists (Todo Lists)

lists  
id  
user_id  
name  
category  
tag  
priority (integer or enum)  
sort_order  
muted_until (nullable; UTC; nudge engine skips list until after this time)  
archived_at (nullable)  
created_at

---

## Tasks

tasks  
id  
user_id (owner; receives nudges and owns the task)  
list_id (nullable; FK to lists; null = Tasks)  
created_by_user_id (nullable; FK users; friend who created this task for the owner)  
title  
description  
due_date (nullable)  
category  
tag  
priority (integer or enum: e.g. 0=low, 1=medium, 2=high)  
recurring (e.g. rule or frequency; nullable)  
status (enum: pending, completed, cancelled)  
muted_until (nullable; UTC; nudge engine skips until after this time; set via Mute or Snooze)  
created_at  
completed_at

---

## Habits

habits  
id  
user_id  
name  
target_frequency (e.g. daily, weekly)  
reminder_times (e.g. JSON or separate table for multiple times)  
streak_count  
last_completed_at  
created_at

---

## HabitCompletions

habit_completions  
id  
habit_id  
completed_at  
skipped (boolean)

Habits use the same ReminderSchedules (or a habit_schedule variant) and ReminderEvents for nudge logic; link schedule to habit_id instead of task_id where applicable.

---

## ReminderSchedules

reminder_schedules  
id  
user_id (denormalized; for indexing and "due soon" queries without heavy joins)  
task_id (nullable; for task reminders)  
habit_id (nullable; for habit reminders)  
recurrence_rule  
next_trigger_at  
retry_interval_minutes  
persistent  
max_attempts  

(Exactly one of task_id or habit_id should be set. Enforce in app layer.)

---

## ReminderEvents

reminder_events  
id  
schedule_id  
triggered_at  
attempt_number  
acknowledged  

(Use unique constraint on (schedule_id, triggered_at truncated to minute) so duplicate Beat runs cannot insert a second event and double-send.)

---

## Friendships

friendships  
id  
user_id (FK users)  
friend_id (FK users)  
created_at  

Unique on (user_id, friend_id) with user_id < friend_id to avoid duplicate rows for the same pair. Application layer enforces bidirectional visibility: if (A, B) exists, both A and B are friends.

---

## FriendInvitations

friend_invitations  
id  
from_user_id (FK users)  
to_user_id (FK users; nullable until accepted if invite is by email and user not yet resolved)  
to_email (nullable; for invites sent by email before recipient has an account)  
status (enum: pending, accepted, declined)  
created_at  
responded_at (nullable)  

Only one pending invitation per (from_user_id, to_user_id) or (from_user_id, to_email). When accepted, to_user_id must be set and a friendships row is created for both directions.

---

## TaskLinkedFriends (link friends to tasks)

task_linked_friends  
id  
task_id (FK tasks)  
user_id (FK users; must be friend of task owner)  
created_at  

Unique on (task_id, user_id). Ensures only friends of the task owner can be linked.

---

## DeviceTokens

device_tokens  
id  
user_id  
device_id (nullable; client-provided stable id for “same device”)  
platform  
token  
created_at

**Model:** One token per device per user. When the client sends `device_id` on `POST /device/register`, replace any existing token for that `(user_id, device_id)` so each device has at most one active token. Multiple devices per user yield multiple rows. Stale tokens (FCM returns invalid/unregistered) must be removed so the nudge engine does not send to dead tokens.

Platforms:

- ios
- android
- web

---

# 9. Nudge Engine Algorithm

## 9.1 Nudge escalation rules

Priority drives how often and how long we nudge. Use a simple mapping so higher priority implies shorter retry interval and more attempts (idiomatic: priority 0 = lowest, 5 = highest).

| Priority (0–5) | retry_interval_minutes (example) | max_attempts (example) |
|----------------|-----------------------------------|------------------------|
| 0 (No one cares) | 120 | 5 |
| 1 | 90 | 8 |
| 2 | 60 | 10 |
| 3 | 45 | 12 |
| 4 | 30 | 15 |
| 5 (I’ll let myself down) | 20 | 20 |

Exact values are product-tunable; the relationship (higher priority → more frequent, more attempts) is fixed. For list-level nudges, use the list’s priority. For stacked recurring tasks (x2, x3…), increase intensity by shortening retry_interval or raising max_attempts for that schedule.

## 9.2 Creative timing

To avoid thundering herd and make reminders feel less robotic, apply a **small random offset** to `next_trigger_at` when scheduling the next nudge (e.g. ±2–5 minutes). Store the chosen time so idempotency is unchanged. Do not randomize the first trigger for a due date; only the retry timing.

## 9.3 Worker loop

1. Query reminders due (index `next_trigger_at`, `user_id` for scale).
2. For each, ensure idempotency: **insert a ReminderEvent row first** (e.g. with a unique constraint on `(schedule_id, triggered_at_bucket)` where bucket is time truncated to minute), then process; duplicate Beat/worker runs will fail the insert and skip—avoids double-send.
3. Create reminder event (increment attempt_number).
4. Send push notification. Skip if task/list/habit is muted (task.`muted_until` or list.`muted_until` > now).
5. If persistent and attempt < max_attempts: set next_trigger_at = now + retry_interval; else stop scheduling (disable or leave schedule inactive). When max_attempts is reached, no further nudges are sent; task remains in list for user to complete or dismiss.

Pseudo-code:

reminders = ReminderSchedule.objects.filter(next_trigger_at <= now())

for reminder in reminders:

    if not acquire_lock_or_ensure_idempotent(reminder): continue

    create_reminder_event(attempt_number=...)

    send_push_notification()

    if reminder.persistent and attempt_number < reminder.max_attempts:
        reminder.next_trigger_at = now() + retry_interval
    else:
        disable_reminder()

    reminder.save()

---

# 10. Docker Deployment

MVP runs using Docker Compose.

Containers:

- frontend
- django_api
- postgres
- redis
- celery_worker
- celery_beat
- nginx

---

# 11. Infrastructure

Hosting:

DigitalOcean

Initial deployment:

Single droplet running Docker Compose

Recommended size:

4GB RAM / 2 vCPU

Estimated cost:

~$24 per month

**Backups:** Define automated PostgreSQL backups (e.g. daily) and verify restore before launch.

---

# 12. Security

Security features:

- HTTPS
- JWT authentication (e.g. djangorestframework-simplejwt for access + refresh tokens)
- password hashing (bcrypt)
- rate limiting: at API layer (e.g. per-IP and per-user); and in Celery/before sending: per-user caps (e.g. max reminders or nudges per user per hour/day) to prevent abuse and misconfiguration

Sensitive data:

- user credentials
- push tokens (do not log; store securely; consider hashing or encryption if policy requires)

---

# 13. Observability

Logging:

- Django logs
- Docker logs

Future monitoring:

- Prometheus
- Grafana
- Sentry

**Testing (MVP):** Unit tests for nudge engine and reminder scheduling; integration tests for API and Celery tasks; manual QA for push on real devices. See §16 MVP Definition for completion criteria.

**Testing & release (for epic planning):**

- **E2E:** Cover critical paths only for MVP: sign-up/login, create/edit/complete task, create list and add tasks, create habit and log completion, receive nudge (or simulate). Use one E2E framework (e.g. Playwright or Cypress) and run in CI on a test environment.
- **Environments:** At least `development` and one shared `staging` (or `test`) environment; staging mirrors production stack (Docker Compose) for integration and manual push testing.
- **CI:** Run unit and integration tests on every commit/PR; run E2E on PR or main. No API versioning for MVP; introduce when breaking changes are required.
- **Release:** Mobile: distribute via TestFlight (iOS) and Play Console internal/beta (Android) for QA. Web: deploy to a single production URL. Feature flags are optional for MVP.

---

# 14. Risks

Notification reliability due to mobile OS background restrictions.

Mitigation:

- retry scheduling
- persistent reminders

---

# 15. Infrastructure & Architecture Considerations

Issues and mitigations to keep in mind as you build:

- **Single droplet:** MVP runs on one 4GB droplet. No redundancy; a single failure affects all services. Acceptable for MVP; plan for a second node or managed DB/Redis when scaling.
- **Celery Beat duplication:** Run only one Beat instance in production (e.g. one replica in Docker/Kubernetes). Multiple Beat instances will enqueue duplicate periodic tasks.
- **Redis persistence:** If Redis is only in-memory, a restart loses the Celery queue and in-flight work. Enable Redis AOF or RDB persistence so reminder jobs are not lost on restart.
- **Database backups:** No backup strategy is specified. Define automated PostgreSQL backups (e.g. daily) and test restore before launch.
- **Stale device tokens:** Push tokens expire or become invalid. Implement cleanup (e.g. remove tokens that fail with "invalid" or "unregistered" from FCM) and optional re-registration flows.
- **Reminder scale:** One worker polling "reminders due" can become a bottleneck with many users. Plan for: indexing `next_trigger_at` (and user_id), and scaling to multiple Celery workers; ensure task locking or idempotency so the same reminder is not processed twice.
- **Lists and habits in schema:** Tasks get `list_id`; reminders are shared between tasks and habits via `task_id`/`habit_id` on `reminder_schedules`. Enforce at the app layer that exactly one of `task_id` or `habit_id` is set to avoid invalid states.
- **Offline-first (secondary goal):** Not reflected in the current architecture. Adding offline-first later will require sync, conflict resolution, and possibly a local DB (e.g. SQLite) in the client; worth a separate design pass when you prioritize it.
- **Deletion semantics:** List delete → set `tasks.list_id = null` for all tasks in that list (tasks move to default Tasks). Habit delete → cascade delete `habit_completions` and related `reminder_schedules` for that habit. User delete (if supported) must clear or reassign owned data per policy.

**Pre-launch checklist:**

- Only one Celery Beat instance in production
- Redis AOF or RDB persistence enabled
- PostgreSQL automated backups configured and restore tested
- Stale FCM token cleanup implemented (remove tokens that fail invalid/unregistered)
- Rate limits enforced at API and before sending nudges

---

# 16. MVP Definition

**Out of scope for MVP:** Calendar integration, team collaboration, smart nudging, per-schedule timezone override, additional notification channels (e.g. email/SMS).

**Known limitation (MVP):** Web push is supported in Chrome/Edge/Firefox; Safari and iOS Safari are best-effort and may not support full web push—document and QA accordingly.

The MVP is complete when users can:

- create accounts
- create tasks (optionally under lists)
- create and manage lists
- create habits and receive habit reminders with streak tracking
- invite friends, accept/decline invitations, and remove friends
- link friends to tasks and create tasks for friends (friends create tasks for you)
- schedule reminders (tasks and habits)
- receive persistent nudges
- snooze, mute, or complete tasks
- use the app on web and mobile

**MVP quality bar:** Unit tests for nudge engine and reminder scheduling; integration tests for API and Celery tasks; manual QA for push on real devices (see §13 Observability).

**Handoff checklist for epic planning:**

- [ ] **MVP scope** — Implement everything in this §16; Friends & Social is in scope. Exclusions (calendar, team collaboration, etc.) are post-MVP.
- [ ] **Architecture** — React + Capacitor, Django, PostgreSQL, Redis, Celery, FCM per §5–§7; Docker Compose per §10.
- [ ] **Data model** — Schema per §8; enforce exactly one of `task_id` or `habit_id` on reminder_schedules; list delete → tasks move to default list; habit delete → cascade as in §15.
- [ ] **Nudge engine** — Idempotency, mute/snooze, retry, max_attempts per §9; escalation and creative timing per §9.1–9.2.
- [ ] **UI/UX** — Layout, screens, and interactions per the UI/UX design doc; theme system and tokens as specified there.
- [ ] **Standards** — Unit tests with every change; frontend modular/functional with dependency injection; unique descriptive HTML IDs (see `.cursor/rules`).
- [ ] **Security & ops** — JWT, rate limiting, backups, single Celery Beat, Redis persistence, FCM token cleanup per §12 and §15.

**Definition of Done (per story/PR):** PR merged; tests green; no new critical linter issues; behavior matches this document and the UI/UX design doc.

---

# 17. Suggested Epic Areas and Build Order

Epic planning can use the following areas and suggested sequence. Dependencies are implied: e.g. Auth before tasks; device registration before push.

**Suggested epic areas:**

- **Auth & accounts** — Register, login, logout, password reset, profile, OAuth (Gmail/Apple).
- **Tasks CRUD** — Create, edit, delete, complete, mute, snooze, move to list; task fields and ordering.
- **Lists CRUD** — Create, edit, delete, archive lists; list-level category/tag/priority; move tasks between lists; mark list complete.
- **Habits & completions** — Create, edit, delete habits; log completion/skip; streak and history.
- **Reminder schedules & nudge engine** — Schedule creation, Celery Beat, worker loop, idempotency, mute/snooze respect, escalation, creative timing.
- **Friends & Social** — Invite by email/username, accept/decline, list friends, remove friend; link friends to tasks; create task for a friend.
- **Push & device registration** — FCM, device token registration, push delivery, token cleanup.
- **Settings & profile** — Theme picker, timezone, notification preferences, account management.
- **Theme & UI shell** — Layout (header, center, footer), bottom nav, theme tokens, responsive behavior.
- **E2E & release** — E2E critical paths, CI, staging, TestFlight/Play Console, production deploy.

**Suggested build order:** (1) Project setup + Auth & accounts. (2) Tasks CRUD + Lists CRUD. (3) Reminder schedules & nudge engine. (4) Habits & completions. (5) Friends & Social. (6) Push & device registration. (7) Settings & profile + Theme & UI shell. (8) E2E & release. Adjust based on team capacity and dependencies.