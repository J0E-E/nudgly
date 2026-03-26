"""
Schedule lifecycle management for tasks, lists, habits, and standalone reminders.

sync_task_schedule() auto-creates, updates, or deactivates a
ReminderSchedule whenever a task's due_date, priority, or status changes.

sync_list_schedule() auto-creates, updates, or deactivates a
ReminderSchedule for a list based on its pending-task count and archive state.

sync_standalone_reminder_schedule() auto-creates, updates, or deactivates a
ReminderSchedule for a standalone reminder based on its recurrence and active state.
"""

import calendar
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.utils import timezone

from core.models import ReminderSchedule, TaskStatus
from core.nudge import PRIORITY_NUDGE_CONFIG

# Default priority for habit reminders (no priority field on Habit model).
HABIT_DEFAULT_PRIORITY = 2


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


def compute_next_habit_trigger(time_str, user_tz_name):
    """Return a UTC-aware datetime for the next occurrence of HH:MM in the user's timezone.

    If the time is still in the future today, return today at that time.
    Otherwise, return tomorrow at that time.
    """
    tz = ZoneInfo(user_tz_name)
    hour, minute = int(time_str[:2]), int(time_str[3:5])
    now_local = timezone.now().astimezone(tz)
    target_today = now_local.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if target_today > now_local:
        target = target_today
    else:
        target = target_today + timedelta(days=1)
    return target.astimezone(ZoneInfo("UTC"))


def sync_habit_schedule(habit):
    """Create, update, or deactivate ReminderSchedules for *habit*.

    One schedule per reminder_time. Each fires daily at that time.
    The recurrence_rule field stores the HH:MM string for worker advancement.
    """
    existing = {
        s.recurrence_rule: s
        for s in ReminderSchedule.objects.filter(habit=habit)
    }
    reminder_times = habit.reminder_times or []
    user_tz = habit.user.timezone or "UTC"
    cfg = PRIORITY_NUDGE_CONFIG[HABIT_DEFAULT_PRIORITY]

    # Deactivate all if no reminder times.
    if not reminder_times:
        ReminderSchedule.objects.filter(habit=habit, is_active=True).update(
            is_active=False
        )
        return

    seen_times = set()
    for t in reminder_times:
        seen_times.add(t)
        next_trigger = compute_next_habit_trigger(t, user_tz)
        schedule = existing.get(t)

        if schedule is None:
            ReminderSchedule.objects.create(
                user=habit.user,
                habit=habit,
                recurrence_rule=t,
                next_trigger_at=next_trigger,
                retry_interval_minutes=cfg["retry_interval_minutes"],
                max_attempts=cfg["max_attempts"],
                persistent=True,
            )
        else:
            update_fields = []
            if not schedule.is_active:
                schedule.is_active = True
                schedule.attempt_count = 0
                schedule.next_trigger_at = next_trigger
                update_fields += ["is_active", "attempt_count", "next_trigger_at"]
            if schedule.retry_interval_minutes != cfg["retry_interval_minutes"]:
                schedule.retry_interval_minutes = cfg["retry_interval_minutes"]
                update_fields.append("retry_interval_minutes")
            if schedule.max_attempts != cfg["max_attempts"]:
                schedule.max_attempts = cfg["max_attempts"]
                update_fields.append("max_attempts")
            if update_fields:
                schedule.save(update_fields=update_fields)

    # Remove orphan schedules (times no longer in reminder_times).
    orphan_rules = set(existing.keys()) - seen_times
    if orphan_rules:
        ReminderSchedule.objects.filter(
            habit=habit, recurrence_rule__in=orphan_rules
        ).delete()


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


# ── Standalone reminder scheduling ─────────────────────────────────────

# Standalone reminders use priority 0 config (gentle, single attempt).
STANDALONE_REMINDER_PRIORITY = 0


def compute_next_standalone_trigger(
    recurrence, remind_time, day_of_week, day_of_month, month_of_year, user_tz_name
):
    """Return next UTC datetime for a recurring standalone reminder."""
    tz = ZoneInfo(user_tz_name)
    now_local = timezone.now().astimezone(tz)
    hour, minute = remind_time.hour, remind_time.minute

    if recurrence == "daily":
        target = now_local.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if target <= now_local:
            target += timedelta(days=1)

    elif recurrence == "weekly":
        dow = day_of_week if day_of_week is not None else 0  # 0=Monday
        target = now_local.replace(hour=hour, minute=minute, second=0, microsecond=0)
        days_ahead = (dow - target.weekday()) % 7
        target += timedelta(days=days_ahead)
        if target <= now_local:
            target += timedelta(days=7)

    elif recurrence == "monthly":
        dom = day_of_month if day_of_month is not None else 1
        year, month = now_local.year, now_local.month
        # Clamp day to max days in the month.
        max_day = calendar.monthrange(year, month)[1]
        clamped = min(dom, max_day)
        target = now_local.replace(
            day=clamped, hour=hour, minute=minute, second=0, microsecond=0
        )
        if target <= now_local:
            # Advance to next month.
            if month == 12:
                year, month = year + 1, 1
            else:
                month += 1
            max_day = calendar.monthrange(year, month)[1]
            clamped = min(dom, max_day)
            target = target.replace(year=year, month=month, day=clamped)

    elif recurrence == "yearly":
        dom = day_of_month if day_of_month is not None else 1
        moy = month_of_year if month_of_year is not None else 1
        year = now_local.year
        max_day = calendar.monthrange(year, moy)[1]
        clamped = min(dom, max_day)
        target = now_local.replace(
            month=moy, day=clamped, hour=hour, minute=minute, second=0, microsecond=0
        )
        if target <= now_local:
            year += 1
            max_day = calendar.monthrange(year, moy)[1]
            clamped = min(dom, max_day)
            target = target.replace(year=year, day=clamped)

    else:
        # Fallback: treat as daily.
        target = now_local.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if target <= now_local:
            target += timedelta(days=1)

    return target.astimezone(ZoneInfo("UTC"))


def sync_standalone_reminder_schedule(reminder):
    """Create, update, or deactivate the ReminderSchedule for *reminder*."""
    schedule = ReminderSchedule.objects.filter(standalone_reminder=reminder).first()

    if not reminder.is_active:
        if schedule and schedule.is_active:
            schedule.is_active = False
            schedule.save(update_fields=["is_active"])
        return

    user_tz = reminder.user.timezone or "UTC"

    if reminder.recurrence:
        next_trigger = compute_next_standalone_trigger(
            reminder.recurrence,
            reminder.remind_time,
            reminder.day_of_week,
            reminder.day_of_month,
            reminder.month_of_year,
            user_tz,
        )
    else:
        # One-time: trigger at remind_at (or now if in the past).
        next_trigger = reminder.remind_at
        if next_trigger < timezone.now():
            next_trigger = timezone.now()

    if schedule is None:
        ReminderSchedule.objects.create(
            user=reminder.user,
            standalone_reminder=reminder,
            next_trigger_at=next_trigger,
            retry_interval_minutes=0,
            max_attempts=1,
            persistent=False,
        )
    else:
        schedule.next_trigger_at = next_trigger
        schedule.retry_interval_minutes = 0
        schedule.max_attempts = 1
        schedule.persistent = False
        update_fields = [
            "next_trigger_at", "retry_interval_minutes", "max_attempts", "persistent",
        ]
        if not schedule.is_active:
            schedule.is_active = True
            schedule.attempt_count = 0
            update_fields += ["is_active", "attempt_count"]
        schedule.save(update_fields=update_fields)
