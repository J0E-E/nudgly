"""
Schedule lifecycle management for tasks and lists.

sync_task_schedule() auto-creates, updates, or deactivates a
ReminderSchedule whenever a task's due_date, priority, or status changes.

sync_list_schedule() auto-creates, updates, or deactivates a
ReminderSchedule for a list based on its pending-task count and archive state.
"""

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.utils import timezone

from core.models import ReminderSchedule, TaskStatus
from core.nudge import PRIORITY_NUDGE_CONFIG


def _compute_next_trigger(due_date, user_tz_name, due_time=None):
    """Return a UTC-aware datetime for due_time (or 9 AM) on due_date in the user's timezone.

    If the result is in the past, return now instead (trigger immediately).
    """
    tz = ZoneInfo(user_tz_name)
    trigger_time = due_time if due_time else time(9, 0)
    local_dt = datetime.combine(due_date, trigger_time, tzinfo=tz)
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
    next_trigger = _compute_next_trigger(task.due_date, task.user.timezone, task.due_time)

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


def _compute_next_trigger_no_due_date(user_tz_name):
    """Return a UTC-aware datetime for the next 9 AM in the user's timezone.

    If it is currently before 9 AM local, return today at 9 AM.
    Otherwise, return tomorrow at 9 AM.
    """
    tz = ZoneInfo(user_tz_name)
    now_local = timezone.now().astimezone(tz)
    nine_am_today = now_local.replace(hour=9, minute=0, second=0, microsecond=0)
    if now_local < nine_am_today:
        target = nine_am_today
    else:
        target = nine_am_today + timedelta(days=1)
    return target.astimezone(ZoneInfo("UTC"))


def sync_list_schedule(lst):
    """Create, update, or deactivate the ReminderSchedule for *lst*."""
    schedule = ReminderSchedule.objects.filter(list=lst).first()

    pending_count = lst.tasks.filter(status=TaskStatus.PENDING).count()

    # Deactivate when list is archived or has no pending tasks.
    if lst.archived_at is not None or pending_count == 0:
        if schedule and schedule.is_active:
            schedule.is_active = False
            schedule.save(update_fields=["is_active"])
        return

    # Active list with pending tasks — create or update schedule.
    cfg = PRIORITY_NUDGE_CONFIG[lst.priority]
    next_trigger = _compute_next_trigger_no_due_date(lst.user.timezone)

    if schedule is None:
        ReminderSchedule.objects.create(
            user=lst.user,
            list=lst,
            next_trigger_at=next_trigger,
            retry_interval_minutes=cfg["retry_interval_minutes"],
            max_attempts=cfg["max_attempts"],
        )
    elif not schedule.is_active:
        # Reactivation: reset trigger, config, and attempt counter.
        schedule.is_active = True
        schedule.attempt_count = 0
        schedule.next_trigger_at = next_trigger
        schedule.retry_interval_minutes = cfg["retry_interval_minutes"]
        schedule.max_attempts = cfg["max_attempts"]
        schedule.save(
            update_fields=[
                "is_active",
                "attempt_count",
                "next_trigger_at",
                "retry_interval_minutes",
                "max_attempts",
            ]
        )
    elif (
        schedule.retry_interval_minutes != cfg["retry_interval_minutes"]
        or schedule.max_attempts != cfg["max_attempts"]
    ):
        # Priority changed — update config but don't reset the in-flight trigger.
        schedule.retry_interval_minutes = cfg["retry_interval_minutes"]
        schedule.max_attempts = cfg["max_attempts"]
        schedule.save(update_fields=["retry_interval_minutes", "max_attempts"])
