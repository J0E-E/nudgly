"""
Schedule lifecycle management for tasks.

sync_task_schedule() auto-creates, updates, or deactivates a
ReminderSchedule whenever a task's due_date, priority, or status changes.
"""

from datetime import datetime, time
from zoneinfo import ZoneInfo

from django.utils import timezone

from core.models import ReminderSchedule, TaskStatus
from core.nudge import PRIORITY_NUDGE_CONFIG


def _compute_next_trigger(due_date, user_tz_name):
    """Return a UTC-aware datetime for 9 AM on due_date in the user's timezone.

    If the result is in the past, return now instead (trigger immediately).
    """
    tz = ZoneInfo(user_tz_name)
    local_dt = datetime.combine(due_date, time(9, 0), tzinfo=tz)
    utc_dt = local_dt.astimezone(ZoneInfo("UTC"))
    now = timezone.now()
    return utc_dt if utc_dt > now else now


def sync_task_schedule(task):
    """Create, update, or deactivate the ReminderSchedule for *task*."""
    schedule = ReminderSchedule.objects.filter(task=task).first()

    # Deactivate when task is done or has no due_date.
    if task.status in (TaskStatus.COMPLETED, TaskStatus.CANCELLED) or task.due_date is None:
        if schedule and schedule.is_active:
            schedule.is_active = False
            schedule.save(update_fields=["is_active"])
        return

    # Active task with a due_date — create or update schedule.
    cfg = PRIORITY_NUDGE_CONFIG[task.priority]
    next_trigger = _compute_next_trigger(task.due_date, task.user.timezone)

    if schedule is None:
        ReminderSchedule.objects.create(
            user=task.user,
            task=task,
            next_trigger_at=next_trigger,
            retry_interval_minutes=cfg["retry_interval_minutes"],
            max_attempts=cfg["max_attempts"],
        )
    else:
        schedule.next_trigger_at = next_trigger
        schedule.retry_interval_minutes = cfg["retry_interval_minutes"]
        schedule.max_attempts = cfg["max_attempts"]
        update_fields = ["next_trigger_at", "retry_interval_minutes", "max_attempts"]
        # Reactivation: reset attempt counter.
        if not schedule.is_active:
            schedule.is_active = True
            schedule.attempt_count = 0
            update_fields += ["is_active", "attempt_count"]
        schedule.save(update_fields=update_fields)
