"""
Celery tasks for the nudge engine.

process_due_reminders runs every 60s (via Beat) and processes all
ReminderSchedules whose next_trigger_at has passed.
"""

import logging
import random
from datetime import timedelta

from celery import shared_task
from django.db import IntegrityError, transaction
from django.utils import timezone

from core.models import ReminderEvent, ReminderSchedule
from core.notifications import get_notification_sender

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


def _build_list_nudge_body(lst, user_tz_name, attempt):
    """Build an aggregate nudge message for a list."""
    from zoneinfo import ZoneInfo

    from core.models import TaskStatus

    pending_count = lst.tasks.filter(status=TaskStatus.PENDING).count()
    user_today = timezone.now().astimezone(ZoneInfo(user_tz_name)).date()
    due_today_count = lst.tasks.filter(
        status=TaskStatus.PENDING, due_date=user_today
    ).count()

    if due_today_count > 0:
        s = "s" if due_today_count != 1 else ""
        return f"{due_today_count} task{s} due today in {lst.name} (attempt {attempt})"
    s = "s" if pending_count != 1 else ""
    return f"{lst.name} has {pending_count} item{s} left (attempt {attempt})"


@shared_task(name="core.nudge.process_due_reminders")
def process_due_reminders():
    """
    Worker loop: find all due schedules, create idempotent events,
    send notifications, and advance or deactivate schedules.
    """
    now = timezone.now()
    due_schedules = ReminderSchedule.objects.filter(
        next_trigger_at__lte=now,
        is_active=True,
    ).select_related("task", "task__list", "user", "list")

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
        if not muted:
            if schedule.task:
                body = f"Time to: {schedule.task.title} (attempt {attempt})"
                data = {
                    "schedule_id": str(schedule.id),
                    "task_id": str(schedule.task_id),
                    "attempt": str(attempt),
                }
            elif schedule.list:
                body = _build_list_nudge_body(schedule.list, schedule.user.timezone, attempt)
                data = {
                    "schedule_id": str(schedule.id),
                    "list_id": str(schedule.list_id),
                    "attempt": str(attempt),
                }
            else:
                body = f"Reminder (attempt {attempt})"
                data = {"schedule_id": str(schedule.id), "attempt": str(attempt)}

            sender.send(
                user_id=schedule.user_id,
                title="Nudge!",
                body=body,
                data=data,
            )
            event.notification_sent = True
            event.save(update_fields=["notification_sent"])

        # Advance or deactivate.
        if schedule.persistent and attempt < schedule.max_attempts:
            jitter = random.randint(-5, 5)
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
