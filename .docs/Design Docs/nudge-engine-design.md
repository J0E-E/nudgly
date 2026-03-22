# Nudge Engine -- Technical Design Document

**Epic:** 8a (Spike & Design)
**Status:** Complete
**Date:** 2026-03-22

---

## 1. Overview

The nudge engine is the core scheduling system that sends persistent reminders ("nudges") to users about their tasks and habits. It uses Celery Beat to tick every 60 seconds, a Celery worker to process due schedules, and PostgreSQL for state management with idempotency guarantees.

---

## 2. Model Schemas

### 2.1 ReminderSchedule

Defined in `backend/core/models.py`.

| Field | Type | Notes |
|-------|------|-------|
| id | AutoField (PK) | |
| user | FK(User, CASCADE) | Denormalized for indexed queries |
| task | FK(Task, CASCADE, nullable) | XOR with habit_id |
| habit_id | IntegerField(nullable) | Plain int until Habit model exists (Epic 9) |
| recurrence_rule | TextField(blank) | RRULE string for recurring schedules |
| next_trigger_at | DateTimeField | Core scheduling column |
| retry_interval_minutes | PositiveIntegerField | From priority mapping (SS2.5) |
| persistent | BooleanField(default=True) | Keep nudging until acknowledged |
| max_attempts | PositiveIntegerField | From priority mapping |
| attempt_count | PositiveIntegerField(default=0) | Current cycle attempts |
| is_active | BooleanField(default=True) | False when exhausted or stopped |
| created_at | DateTimeField(auto_now_add) | |

**Indexes:**
- `(next_trigger_at, is_active)` -- main worker query
- `(user,)` -- per-user lookups

**Constraints:**
- `CheckConstraint`: exactly one of `task` or `habit_id` must be non-null

### 2.2 ReminderEvent

| Field | Type | Notes |
|-------|------|-------|
| id | AutoField (PK) | |
| schedule | FK(ReminderSchedule, CASCADE) | |
| triggered_at | DateTimeField | Actual trigger time |
| triggered_at_bucket | DateTimeField | Truncated to minute; idempotency key |
| attempt_number | PositiveIntegerField | |
| acknowledged | BooleanField(default=False) | |
| notification_sent | BooleanField(default=False) | False if muted/skipped |
| created_at | DateTimeField(auto_now_add) | |

**Constraints:**
- `UniqueConstraint(schedule, triggered_at_bucket)` -- idempotency guard

---

## 3. Idempotency Strategy

The `triggered_at_bucket` is derived from `schedule.next_trigger_at` truncated to the minute:

```python
def compute_bucket(dt):
    return dt.replace(second=0, microsecond=0)
```

**How it works:**
1. Worker reads `schedule.next_trigger_at`
2. Computes `bucket = compute_bucket(schedule.next_trigger_at)`
3. Attempts `ReminderEvent.objects.create(schedule=schedule, triggered_at_bucket=bucket, ...)`
4. If `IntegrityError` is raised (unique constraint violation), the event was already processed -- skip silently

**Why minute granularity?** Beat ticks every 60s. Minimum retry interval is 20 minutes. Minute-level buckets are sufficient to prevent double-sends without blocking legitimate retries.

---

## 4. Celery Configuration

### 4.1 Infrastructure

- **Broker:** Redis (same instance used by health check; already in Docker Compose)
- **Result backend:** None (fire-and-forget; results are ReminderEvent rows)
- **App:** `backend/config/celery.py` -- autodiscovers tasks from installed apps
- **Init:** `backend/config/__init__.py` loads celery app on Django startup

### 4.2 Beat Schedule

```python
CELERY_BEAT_SCHEDULE = {
    "process-due-reminders": {
        "task": "core.nudge.process_due_reminders",
        "schedule": 60.0,  # every 60 seconds
    },
}
```

### 4.3 Docker Compose Services

```yaml
celery_worker:
  command: celery -A config worker --loglevel=info --concurrency=1
  depends_on: [postgres (healthy), redis (healthy), django_api (healthy)]

celery_beat:
  command: celery -A config beat --loglevel=info
  depends_on: [postgres (healthy), redis (healthy), django_api (healthy)]
```

Both depend on `django_api` (healthy) to ensure migrations have run.

### 4.4 Test Mode

```python
if "test" in sys.argv:
    CELERY_TASK_ALWAYS_EAGER = True
    CELERY_TASK_EAGER_PROPAGATES = True
```

Tasks run synchronously in-process; no Redis/worker needed.

---

## 5. Worker Flow

Implemented in `backend/core/nudge.py` as `process_due_reminders` shared_task.

```
every 60s (Beat):
    now = timezone.now()
    due = ReminderSchedule.filter(next_trigger_at <= now, is_active=True)
                          .select_related('task', 'task__list', 'user')

    for schedule in due:
        bucket = compute_bucket(schedule.next_trigger_at)
        attempt = schedule.attempt_count + 1

        # 1. Idempotent insert
        try: create ReminderEvent(schedule, bucket, attempt)
        except IntegrityError: continue  # already processed

        # 2. Check mute
        muted = task.muted_until > now OR task.list.muted_until > now

        # 3. Send notification (stub -- logs until Epic 8c)
        if not muted: send_push(user, task)

        # 4. Advance or deactivate
        if persistent AND attempt < max_attempts:
            schedule.next_trigger_at = now + retry_interval + jitter(+-5 min)
        else:
            schedule.is_active = False
```

### 5.1 Priority-to-Interval Mapping (per app-idea SS9.1)

| Priority | retry_interval_minutes | max_attempts |
|----------|----------------------|--------------|
| 0 (No one cares) | 120 | 5 |
| 1 (No one is watching) | 90 | 8 |
| 2 (I'll feel guilty) | 60 | 10 |
| 3 (Others are watching) | 45 | 12 |
| 4 (Others will be let down) | 30 | 15 |
| 5 (I'll let myself down) | 20 | 20 |

Stored as `PRIORITY_NUDGE_CONFIG` dict in `core/nudge.py`. Used when creating schedules (Epic 8b).

### 5.2 Jitter

Random offset of +-5 minutes applied to retry timing only (not first trigger). Prevents thundering herd when many schedules come due simultaneously.

---

## 6. Failure Modes

| Failure | Mitigation |
|---------|-----------|
| Duplicate Beat fires | Idempotent insert via unique constraint; duplicate silently skipped |
| Worker crash mid-loop | Each schedule processed independently; next tick picks up unprocessed; idempotency prevents re-sends |
| Redis restart | AOF/RDB persistence configured; worker re-queries DB each tick |
| Database unavailable | Celery task raises exception; retried on next Beat tick |
| Push notification failure | Logged; event.notification_sent=False; schedule retries if under max_attempts |
| Multiple Beat instances | Exactly one Beat container enforced by Docker Compose |
| Orphan schedules | Task deletion cascades to schedules; habit schedules cleaned up in Epic 9 |

---

## 7. Friend-Created Tasks

Nudges always target the task **owner** (`schedule.user`), never the creator (`task.created_by`). The worker resolves the owner's devices/preferences. This is enforced by the schedule's `user` FK pointing to the task owner.

---

## 8. Sub-Epic Breakdown

| Sub-epic | Scope | Depends on |
|----------|-------|------------|
| **8b: Schedule API & Auto-creation** | Auto-create/update ReminderSchedule on task create/update/delete (due_date triggers). Acknowledge endpoint `POST /api/reminders/{id}/acknowledge/`. Priority mapping applied. | 8a |
| **8c: Push Notification Infra** | DeviceToken model, device registration endpoint, FCM adapter (interface/adapter pattern like EmailSender), replace stub with real push sends. | 8a, Epic 13a |
| **8d: List-Level Nudges** | Schedule creation at list level using list priority. Aggregate nudge message ("List X has N items left"). | 8b |
| **8e: Nudge Copy & Tuning** | Witty/sarcastic message templates per app spec. Per-user rate limiting. Jitter refinement. | 8c |

**Ordering:** 8b -> 8c -> 8d -> 8e (8c and 8d can be parallelized)

Epic 9 (Habits) will convert `habit_id` IntegerField to FK and add habit-based schedule creation.

---

## 9. Test Coverage

17 tests in `backend/core/tests/test_nudge_engine.py`:

- **Helper:** compute_bucket truncation
- **ReminderSchedule model:** creation, XOR constraint (both/neither), cascade delete, str
- **ReminderEvent model:** creation, idempotency constraint, different buckets OK
- **Worker task:** creates event, skips future, skips inactive, respects task mute, respects list mute, advances next_trigger, deactivates at max_attempts
- **Idempotency integration:** double-run creates only one event (TransactionTestCase)

---

## 10. Files Modified/Created

| File | Change |
|------|--------|
| `backend/requirements.txt` | Added `celery[redis]>=5.4,<6` |
| `backend/config/celery.py` | **New** -- Celery app config |
| `backend/config/__init__.py` | Import celery app on startup |
| `backend/config/settings.py` | Added CELERY_* settings and Beat schedule |
| `backend/core/models.py` | Added ReminderSchedule, ReminderEvent models |
| `backend/core/migrations/0005_*` | Migration for new models |
| `backend/core/nudge.py` | **New** -- process_due_reminders task |
| `docker-compose.yml` | Added celery_worker, celery_beat services |
| `backend/core/tests/test_nudge_engine.py` | **New** -- 17 tests |
| `.docs/Design Docs/nudge-engine-design.md` | **This document** |
