"""
Celery tasks for the nudge engine.

process_due_reminders runs every 60s (via Beat) and processes all
ReminderSchedules whose next_trigger_at has passed.

Intervals are computed dynamically at trigger time based on context
(due-date proximity, task age, list age).  There is no max_attempts —
schedules stay active until the item is completed, cancelled, or muted.
"""

import logging
import random
from collections import Counter
from datetime import timedelta

from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer
from django.db import IntegrityError, transaction
from django.utils import timezone

from core.in_app_notifications.views import notification_payload
from core.models import ReminderEvent, ReminderSchedule
from core.notifications import get_notification_sender
from core.nudge_intervals import (
    compute_list_interval,
    compute_task_due_date_interval,
    compute_task_no_due_date_interval,
    get_habit_tier,
    get_list_tier,
    get_task_due_date_tier,
    get_task_no_due_date_tier,
    task_due_datetime,
)
from core.nudge_templates import (
    select_habit_nudge,
    select_list_nudge,
    select_standalone_reminder_nudge,
    select_task_nudge,
)

logger = logging.getLogger(__name__)

# Per-user rate limiting: max nudge notifications per hour.
MAX_NUDGES_PER_HOUR = 5

# Priority-aware jitter ranges (minutes).
JITTER_RANGES = {
    0: (-5, 5),
    1: (-5, 5),
    2: (-3, 3),
    3: (-2, 2),
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


def _compute_dynamic_interval(schedule, now):
    """Compute the next nudge interval (minutes) for a task or list schedule."""
    if schedule.task:
        task = schedule.task
        user_tz = schedule.user.timezone or "UTC"
        if task.due_date:
            due_dt = task_due_datetime(task.due_date, task.due_time, user_tz)
            return compute_task_due_date_interval(task.priority, due_dt, now)
        else:
            return compute_task_no_due_date_interval(task.priority, task.created_at, now)
    elif schedule.list:
        return compute_list_interval(
            schedule.list.priority, schedule.created_at, now
        )
    # Fallback
    return 60


@shared_task(name="core.nudge.process_due_reminders")
def process_due_reminders():
    """
    Worker loop: find all due schedules, create idempotent events,
    send notifications, and advance schedules.
    """
    now = timezone.now()
    due_schedules = list(
        ReminderSchedule.objects.filter(
            next_trigger_at__lte=now,
            is_active=True,
        ).select_related("task", "task__list", "user", "list", "habit", "standalone_reminder")
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
                task = schedule.task
                user_tz = schedule.user.timezone or "UTC"
                if task.due_date:
                    due_dt = task_due_datetime(task.due_date, task.due_time, user_tz)
                    tier = get_task_due_date_tier(due_dt, now, task.priority)
                else:
                    tier = get_task_no_due_date_tier(task.created_at, now, task.priority)
                title, body = select_task_nudge(
                    priority=task.priority,
                    task_title=task.title,
                    tier=tier,
                    stack_count=task.stack_count,
                )
                data = {
                    "schedule_id": str(schedule.id),
                    "task_id": str(schedule.task_id),
                    "attempt": str(attempt),
                }
            elif schedule.habit:
                user_tz = schedule.user.timezone or "UTC"
                tier = get_habit_tier(schedule.habit.frequency, user_tz, now)
                title, body = select_habit_nudge(
                    habit_name=schedule.habit.name,
                    tier=tier,
                    streak_count=schedule.habit.streak_count,
                )
                data = {
                    "schedule_id": str(schedule.id),
                    "habit_id": str(schedule.habit_id),
                    "attempt": str(attempt),
                }
            elif schedule.list:
                pending_count, due_today_count = _build_list_nudge_context(
                    schedule.list, schedule.user.timezone
                )
                tier = get_list_tier(schedule.created_at, now, schedule.list.priority)
                title, body = select_list_nudge(
                    list_name=schedule.list.name,
                    pending_count=pending_count,
                    due_today_count=due_today_count,
                    tier=tier,
                )
                data = {
                    "schedule_id": str(schedule.id),
                    "list_id": str(schedule.list_id),
                    "attempt": str(attempt),
                }
            elif schedule.standalone_reminder:
                title, body = select_standalone_reminder_nudge(
                    reminder_name=schedule.standalone_reminder.name,
                )
                data = {
                    "schedule_id": str(schedule.id),
                    "standalone_reminder_id": str(schedule.standalone_reminder_id),
                    "attempt": str(attempt),
                }
                # Create a ReminderInstance for this firing.
                from core.models import ReminderInstance

                ReminderInstance.objects.create(
                    reminder=schedule.standalone_reminder,
                    due_at=schedule.next_trigger_at,
                )
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
            event.title = title
            event.body = body
            event.save(update_fields=["notification_sent", "title", "body"])

            # Push to WebSocket channel layer for real-time delivery.
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    f"notifications_{schedule.user_id}",
                    {"type": "notify", "data": notification_payload(event)},
                )

            rate_counts[schedule.user_id] = rate_counts.get(schedule.user_id, 0) + 1

            # Notify linked friends when a task nudge fires (overdue).
            if schedule.task and schedule.task.linked_friends.exists():
                from core.tasks.notifications import notify_linked_friends

                notify_linked_friends(schedule.task, "overdue")

        # ── Advance or deactivate ───────────────────────────────────────
        if schedule.habit and schedule.recurrence_rule:
            # Habit schedules: advance to tomorrow at the same time, reset attempts.
            from core.schedules import compute_next_habit_trigger

            schedule.next_trigger_at = compute_next_habit_trigger(
                schedule.recurrence_rule, schedule.user.timezone or "UTC"
            )
            schedule.attempt_count = 0
            schedule.save(update_fields=["next_trigger_at", "attempt_count"])
        elif schedule.standalone_reminder:
            sr = schedule.standalone_reminder
            if sr.recurrence:
                from core.schedules import compute_next_standalone_trigger

                schedule.next_trigger_at = compute_next_standalone_trigger(
                    sr.recurrence,
                    sr.remind_time,
                    sr.day_of_week,
                    sr.day_of_month,
                    sr.month_of_year,
                    schedule.user.timezone or "UTC",
                )
                schedule.attempt_count = 0
                schedule.save(update_fields=["next_trigger_at", "attempt_count"])
            else:
                # One-time: deactivate.
                schedule.is_active = False
                schedule.attempt_count = attempt
                schedule.save(update_fields=["is_active", "attempt_count"])
        else:
            # Tasks and lists: compute interval dynamically.
            priority = _get_priority(schedule)
            interval = _compute_dynamic_interval(schedule, now)

            if rate_limited and not muted:
                # Rate-limited: defer without consuming an attempt.
                jitter = _get_jitter(priority)
                schedule.next_trigger_at = now + timedelta(
                    minutes=interval + jitter
                )
                schedule.save(update_fields=["next_trigger_at"])
            else:
                # Always advance — never deactivate based on attempt count.
                jitter = _get_jitter(priority)
                schedule.next_trigger_at = now + timedelta(
                    minutes=interval + jitter
                )
                schedule.attempt_count = attempt
                schedule.save(update_fields=["next_trigger_at", "attempt_count"])

        processed += 1

    logger.info(
        "process_due_reminders: processed=%d skipped=%d", processed, skipped
    )
