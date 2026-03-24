"""
Period boundary calculations and streak update logic for habits.
"""

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.utils import timezone

from core.models import HabitFrequency


def get_period_bounds(frequency, user_timezone, reference_dt=None):
    """Return (start, end) datetimes for the current period in the user's timezone."""
    tz = ZoneInfo(user_timezone)
    if reference_dt is None:
        reference_dt = timezone.now()
    local_dt = reference_dt.astimezone(tz)

    if frequency == HabitFrequency.DAILY:
        start_local = datetime.combine(local_dt.date(), time.min, tzinfo=tz)
        end_local = datetime.combine(
            local_dt.date(), time(23, 59, 59, 999999), tzinfo=tz
        )
    elif frequency == HabitFrequency.WEEKLY:
        monday = local_dt.date() - timedelta(days=local_dt.weekday())
        sunday = monday + timedelta(days=6)
        start_local = datetime.combine(monday, time.min, tzinfo=tz)
        end_local = datetime.combine(sunday, time(23, 59, 59, 999999), tzinfo=tz)
    elif frequency == HabitFrequency.MONTHLY:
        first = local_dt.date().replace(day=1)
        if local_dt.month == 12:
            last = first.replace(year=first.year + 1, month=1) - timedelta(days=1)
        else:
            last = first.replace(month=first.month + 1) - timedelta(days=1)
        start_local = datetime.combine(first, time.min, tzinfo=tz)
        end_local = datetime.combine(last, time(23, 59, 59, 999999), tzinfo=tz)
    else:
        raise ValueError(f"Unknown frequency: {frequency}")

    return start_local, end_local


def get_previous_period_bounds(frequency, user_timezone, reference_dt=None):
    """Return (start, end) datetimes for the previous period in the user's timezone."""
    tz = ZoneInfo(user_timezone)
    if reference_dt is None:
        reference_dt = timezone.now()
    local_dt = reference_dt.astimezone(tz)

    if frequency == HabitFrequency.DAILY:
        prev_day = local_dt.date() - timedelta(days=1)
        ref = datetime.combine(prev_day, time(12, 0), tzinfo=tz)
    elif frequency == HabitFrequency.WEEKLY:
        prev_week = local_dt - timedelta(weeks=1)
        ref = prev_week
    elif frequency == HabitFrequency.MONTHLY:
        first = local_dt.date().replace(day=1)
        prev_month_last = first - timedelta(days=1)
        ref = datetime.combine(prev_month_last, time(12, 0), tzinfo=tz)
    else:
        raise ValueError(f"Unknown frequency: {frequency}")

    return get_period_bounds(frequency, user_timezone, ref)


def count_completions_in_period(habit, start, end):
    """Count non-skipped completions for a habit within a time range."""
    return habit.completions.filter(
        completed_at__gte=start,
        completed_at__lte=end,
        skipped=False,
    ).count()


def update_streak(habit, user_timezone):
    """Update streak_count on a habit after a non-skip completion."""
    current_start, current_end = get_period_bounds(
        habit.frequency, user_timezone
    )
    current_count = count_completions_in_period(habit, current_start, current_end)

    if current_count < habit.target_count:
        return

    if current_count == habit.target_count:
        prev_start, prev_end = get_previous_period_bounds(
            habit.frequency, user_timezone
        )
        prev_count = count_completions_in_period(habit, prev_start, prev_end)

        if prev_count >= habit.target_count:
            habit.streak_count += 1
        else:
            habit.streak_count = 1
        habit.save(update_fields=["streak_count"])
