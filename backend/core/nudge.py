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
    """Check whether the schedule's target task or its list is currently muted."""
    task = schedule.task
    if not task:
        return False
    if task.muted_until and task.muted_until > now:
        return True
    if task.list and task.list.muted_until and task.list.muted_until > now:
        return True
    return False


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
    ).select_related("task", "task__list", "user")

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
            task_title = schedule.task.title if schedule.task else "Reminder"
            sender.send(
                user_id=schedule.user_id,
                title="Nudge!",
                body=f"Time to: {task_title} (attempt {attempt})",
                data={
                    "schedule_id": str(schedule.id),
                    "task_id": str(schedule.task_id) if schedule.task_id else "",
                    "attempt": str(attempt),
                },
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
