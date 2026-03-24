"""
Recurrence logic for recurring tasks.

Provides date advancement and stack count computation.
"""

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from dateutil.relativedelta import relativedelta
from django.utils import timezone


def advance_due_date(current_due_date: date, recurring: str, user_tz: str = "UTC") -> date:
    """Advance due_date to the next occurrence based on recurring value.

    If the advanced date is still in the past (in the user's timezone),
    keep advancing until future.
    """
    tz = ZoneInfo(user_tz)
    today = timezone.now().astimezone(tz).date()
    next_date = current_due_date

    if recurring == "daily":
        delta = timedelta(days=1)
    elif recurring == "weekly":
        delta = timedelta(days=7)
    elif recurring == "monthly":
        delta = relativedelta(months=1)
    elif recurring == "yearly":
        delta = relativedelta(years=1)
    else:
        return current_due_date

    next_date = next_date + delta
    # Skip to future if still in the past.
    while next_date <= today:
        next_date = next_date + delta
    return next_date


def compute_stack_count(
    due_date: date,
    due_time: time | None,
    recurring: str,
    user_tz: str,
) -> int:
    """Compute how many recurrence intervals have elapsed past the due datetime."""
    tz = ZoneInfo(user_tz)
    trigger_time = due_time if due_time else time(9, 0)
    due_dt = datetime.combine(due_date, trigger_time, tzinfo=tz)
    now = timezone.now().astimezone(tz)

    if now <= due_dt:
        return 0

    elapsed = now - due_dt

    if recurring == "daily":
        return elapsed.days
    elif recurring == "weekly":
        return elapsed.days // 7
    elif recurring == "monthly":
        months = (now.year - due_dt.year) * 12 + (now.month - due_dt.month)
        # Adjust if we haven't reached the day-of-month yet.
        if now.day < due_dt.day:
            months -= 1
        return max(months, 0)
    elif recurring == "yearly":
        years = now.year - due_dt.year
        if (now.month, now.day) < (due_dt.month, due_dt.day):
            years -= 1
        return max(years, 0)
    return 0
