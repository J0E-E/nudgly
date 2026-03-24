"""
Celery tasks for the nudge engine.

process_due_reminders runs every 60s (via Beat) and processes all
ReminderSchedules whose next_trigger_at has passed.
"""

import logging
import random
from collections import Counter
from datetime import timedelta

from celery import shared_task
from django.db import IntegrityError, transaction
from django.utils import timezone

from core.models import ReminderEvent, ReminderSchedule
from core.notifications import get_notification_sender
from core.nudge_templates import select_list_nudge, select_task_nudge

logger = logging.getLogger(__name__)

# Priority-to-interval mapping per app-idea §9.1.
PRIORITY_NUDGE_CONFIG = {
    0: {"retry_interval_minutes": 120, "max_attempts": 5},
    1: {"retry_interval_minutes": 90, "max_attempts": 8},
    2: {"retry_interval_minutes": 60, "max_attempts": 10},
    3: {"retry_interval_minutes": 45, "max_attempts": 12},
    4: {"retry_interval_minutes": 30, "max_attempts": 15},
    5: {"retry_interval_minutes": 20, "max_attempts": 20},
}

# Per-user rate limiting: max nudge notifications per hour.
MAX_NUDGES_PER_HOUR = 5

# Priority-aware jitter ranges (minutes).
JITTER_RANGES = {
    0: (-5, 5),
    1: (-5, 5),
    2: (-5, 5),
    3: (-3, 3),
    4: (-2, 2),
    5: (-2, 2),
}


def compute_bucket(dt):
    """Truncate datetime to the minute (zero out seconds and microseconds)."""
    return dt.replace(second=0, microsecond=0)


def _is_muted(schedule, now):
    """Check whether the schedule's target (task or list) is currently muted."""
    task = schedule.task
    if task:
        if task.muted_until and task.muted_until > now:
            return True
        if task.list and task.list.muted_until and task.list.muted_until > now:
            return True
        return False
    lst = schedule.list
    if lst and lst.muted_until and lst.muted_until > now:
        return True
    return False


def _get_priority(schedule):
    """Return the priority for a schedule's target (task or list)."""
    if schedule.task:
        return schedule.task.priority
    if schedule.list:
        return schedule.list.priority
    return 0


def _get_jitter(priority):
    """Return a random jitter value (minutes) based on priority."""
    jitter_min, jitter_max = JITTER_RANGES.get(priority, (-5, 5))
    return random.randint(jitter_min, jitter_max)


def _prefetch_rate_limits(user_ids, now):
    """Return a dict mapping user_id -> sent-notification count in the last hour."""
    one_hour_ago = now - timedelta(hours=1)
    events = (
        ReminderEvent.objects.filter(
            schedule__user_id__in=user_ids,
            notification_sent=True,
            triggered_at__gte=one_hour_ago,
        )
        .values_list("schedule__user_id", flat=True)
    )
    return Counter(events)


def _build_list_nudge_context(lst, user_tz_name):
    """Compute pending_count and due_today_count for a list."""
    from zoneinfo import ZoneInfo

    from core.models import TaskStatus

    pending_count = lst.tasks.filter(status=TaskStatus.PENDING).count()
    user_today = timezone.now().astimezone(ZoneInfo(user_tz_name)).date()
    due_today_count = lst.tasks.filter(
        status=TaskStatus.PENDING, due_date=user_today
    ).count()
    return pending_count, due_today_count


@shared_task(name="core.nudge.process_due_reminders")
def process_due_reminders():
    """
    Worker loop: find all due schedules, create idempotent events,
    send notifications, and advance or deactivate schedules.
    """
    now = timezone.now()
    due_schedules = list(
        ReminderSchedule.objects.filter(
            next_trigger_at__lte=now,
            is_active=True,
        ).select_related("task", "task__list", "user", "list")
    )

    # Pre-fetch rate limit counts for all affected users.
    user_ids = {s.user_id for s in due_schedules}
    rate_counts = _prefetch_rate_limits(user_ids, now)

    sender = get_notification_sender()
    processed = 0
    skipped = 0

    for schedule in due_schedules:
        bucket = compute_bucket(schedule.next_trigger_at)
        attempt = schedule.attempt_count + 1

        # Idempotent insert — duplicate Beat/worker runs silently skip.
        try:
            with transaction.atomic():
                event = ReminderEvent.objects.create(
                    schedule=schedule,
                    triggered_at=now,
                    triggered_at_bucket=bucket,
                    attempt_number=attempt,
                )
        except IntegrityError:
            skipped += 1
            continue

        # Check mute status — still create the event but skip notification.
        muted = _is_muted(schedule, now)

        # Check per-user rate limit.
        rate_limited = rate_counts.get(schedule.user_id, 0) >= MAX_NUDGES_PER_HOUR

        if not muted and not rate_limited:
            if schedule.task:
                title, body = select_task_nudge(
                    priority=schedule.task.priority,
                    attempt=attempt,
                    max_attempts=schedule.max_attempts,
                    task_title=schedule.task.title,
                )
                data = {
                    "schedule_id": str(schedule.id),
                    "task_id": str(schedule.task_id),
                    "attempt": str(attempt),
                }
            elif schedule.list:
                pending_count, due_today_count = _build_list_nudge_context(
                    schedule.list, schedule.user.timezone
                )
                title, body = select_list_nudge(
                    attempt=attempt,
                    max_attempts=schedule.max_attempts,
                    list_name=schedule.list.name,
                    pending_count=pending_count,
                    due_today_count=due_today_count,
                )
                data = {
                    "schedule_id": str(schedule.id),
                    "list_id": str(schedule.list_id),
                    "attempt": str(attempt),
                }
            else:
                title, body = "Nudge!", f"Reminder (attempt {attempt})"
                data = {"schedule_id": str(schedule.id), "attempt": str(attempt)}

            sender.send(
                user_id=schedule.user_id,
                title=title,
                body=body,
                data=data,
            )
            event.notification_sent = True
            event.save(update_fields=["notification_sent"])
            rate_counts[schedule.user_id] = rate_counts.get(schedule.user_id, 0) + 1

        # Advance or deactivate.
        priority = _get_priority(schedule)

        if rate_limited and not muted:
            # Rate-limited: defer without consuming an attempt.
            jitter = _get_jitter(priority)
            schedule.next_trigger_at = now + timedelta(
                minutes=schedule.retry_interval_minutes + jitter
            )
            schedule.save(update_fields=["next_trigger_at"])
        elif schedule.persistent and attempt < schedule.max_attempts:
            jitter = _get_jitter(priority)
            schedule.next_trigger_at = now + timedelta(
                minutes=schedule.retry_interval_minutes + jitter
            )
            schedule.attempt_count = attempt
            schedule.save(update_fields=["next_trigger_at", "attempt_count"])
        else:
            schedule.is_active = False
            schedule.attempt_count = attempt
            schedule.save(update_fields=["is_active", "attempt_count"])

        processed += 1

    logger.info(
        "process_due_reminders: processed=%d skipped=%d", processed, skipped
    )
