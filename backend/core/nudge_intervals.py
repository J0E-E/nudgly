"""
Dynamic interval computation and escalation-tier determination for the nudge
engine.  All functions are pure (no DB access) so they can be unit-tested in
isolation.
"""

from __future__ import annotations

import calendar
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

# ── Escalation tier labels ──────────────────────────────────────────────────

EARLY = "early"
MID = "mid"
LATE = "late"

# ── Task WITH due date — proximity-based interval ───────────────────────────

PROXIMITY_CONFIG: dict[int, dict] = {
    0: {"base_interval": 480, "ramp_start_hours": 24},
    1: {"base_interval": 360, "ramp_start_hours": 48},
    2: {"base_interval": 240, "ramp_start_hours": 72},
    3: {"base_interval": 180, "ramp_start_hours": 120},
}


def compute_task_due_date_interval(
    priority: int, due_datetime: datetime, now: datetime
) -> int:
    """Return nudge interval in minutes for a task with a due date.

    Interval shrinks linearly as *due_datetime* approaches.  Once overdue the
    interval is the minimum (60 min).
    """
    hours_remaining = max((due_datetime - now).total_seconds() / 3600, 0)
    cfg = PROXIMITY_CONFIG[priority]

    if hours_remaining <= 0:
        return 60
    if hours_remaining >= cfg["ramp_start_hours"]:
        return cfg["base_interval"]

    ratio = hours_remaining / cfg["ramp_start_hours"]
    return max(60, int(60 + (cfg["base_interval"] - 60) * ratio))


# ── Task WITHOUT due date — age-based interval ─────────────────────────────

AGE_CONFIG: dict[int, dict] = {
    0: {"grace_hours": 168, "base_interval": 480, "ramp_hours": 720},
    1: {"grace_hours": 72, "base_interval": 360, "ramp_hours": 336},
    2: {"grace_hours": 24, "base_interval": 240, "ramp_hours": 168},
    3: {"grace_hours": 4, "base_interval": 120, "ramp_hours": 72},
}


def compute_task_no_due_date_interval(
    priority: int, created_at: datetime, now: datetime
) -> int:
    """Return nudge interval in minutes for a task without a due date.

    Returns ``0`` during the grace period (caller should schedule
    ``next_trigger_at`` to the grace-period end instead).
    """
    age_hours = (now - created_at).total_seconds() / 3600
    cfg = AGE_CONFIG[priority]

    if age_hours < cfg["grace_hours"]:
        return 0  # still in grace period

    age_past_grace = age_hours - cfg["grace_hours"]
    if age_past_grace >= cfg["ramp_hours"]:
        return 60

    ratio = age_past_grace / cfg["ramp_hours"]
    return max(60, int(cfg["base_interval"] - (cfg["base_interval"] - 60) * ratio))


# ── List interval ───────────────────────────────────────────────────────────

LIST_CONFIG: dict[int, dict] = {
    0: {"base_interval": 480, "ramp_hours": 336},
    1: {"base_interval": 360, "ramp_hours": 168},
    2: {"base_interval": 240, "ramp_hours": 72},
    3: {"base_interval": 120, "ramp_hours": 48},
}


def compute_list_interval(
    priority: int, schedule_created_at: datetime, now: datetime
) -> int:
    """Return nudge interval in minutes for a list schedule."""
    age_hours = (now - schedule_created_at).total_seconds() / 3600
    cfg = LIST_CONFIG[priority]

    if age_hours >= cfg["ramp_hours"]:
        return 60

    ratio = age_hours / cfg["ramp_hours"]
    return max(60, int(cfg["base_interval"] - (cfg["base_interval"] - 60) * ratio))


# ── Escalation tiers ────────────────────────────────────────────────────────

TIER_THRESHOLDS: dict[int, dict] = {
    0: {"early_hours": 48, "mid_hours": 12},
    1: {"early_hours": 72, "mid_hours": 24},
    2: {"early_hours": 96, "mid_hours": 36},
    3: {"early_hours": 168, "mid_hours": 48},
}


def get_task_due_date_tier(
    due_datetime: datetime, now: datetime, priority: int
) -> str:
    """Escalation tier based on hours remaining until *due_datetime*."""
    hours_remaining = (due_datetime - now).total_seconds() / 3600
    thresholds = TIER_THRESHOLDS[priority]

    if hours_remaining > thresholds["early_hours"]:
        return EARLY
    if hours_remaining > thresholds["mid_hours"]:
        return MID
    return LATE


AGE_TIER_THRESHOLDS: dict[int, dict] = {
    0: {"early_hours": 336, "mid_hours": 672},
    1: {"early_hours": 168, "mid_hours": 336},
    2: {"early_hours": 72, "mid_hours": 168},
    3: {"early_hours": 24, "mid_hours": 72},
}


def get_task_no_due_date_tier(
    created_at: datetime, now: datetime, priority: int
) -> str:
    """Escalation tier based on task age."""
    age_hours = (now - created_at).total_seconds() / 3600
    thresholds = AGE_TIER_THRESHOLDS[priority]

    if age_hours < thresholds["early_hours"]:
        return EARLY
    if age_hours < thresholds["mid_hours"]:
        return MID
    return LATE


def get_habit_tier(frequency: str, user_tz_name: str, now: datetime) -> str:
    """Escalation tier based on how much of the current period remains."""
    tz = ZoneInfo(user_tz_name)
    now_local = now.astimezone(tz)

    if frequency == "daily":
        hours_left = max(0, 22 - now_local.hour)
        if hours_left > 9:
            return EARLY
        if hours_left > 4:
            return MID
        return LATE
    elif frequency == "weekly":
        day = now_local.weekday()
        if day <= 2:
            return EARLY
        if day <= 4:
            return MID
        return LATE
    elif frequency == "monthly":
        day = now_local.day
        max_day = calendar.monthrange(now_local.year, now_local.month)[1]
        ratio = day / max_day
        if ratio <= 0.33:
            return EARLY
        if ratio <= 0.66:
            return MID
        return LATE

    return EARLY


def get_list_tier(
    schedule_created_at: datetime, now: datetime, priority: int
) -> str:
    """Escalation tier for list nudges, based on schedule age."""
    age_hours = (now - schedule_created_at).total_seconds() / 3600
    cfg = LIST_CONFIG[priority]

    third = cfg["ramp_hours"] / 3
    if age_hours < third:
        return EARLY
    if age_hours < 2 * third:
        return MID
    return LATE


# ── Habit auto-schedule generation ──────────────────────────────────────────

WAKING_START_HOUR = 8
WAKING_END_HOUR = 22
WAKING_WINDOW_MINUTES = (WAKING_END_HOUR - WAKING_START_HOUR) * 60  # 840


def compute_auto_habit_times(frequency: str, target_count: int) -> list[str]:
    """Generate HH:MM strings for habits without explicit reminder_times.

    Nudges are spread evenly across waking hours (08:00–22:00) with a
    minimum spacing of 60 minutes.
    """
    if frequency == "daily":
        count = min(target_count, 14)
    elif frequency == "weekly":
        count = min(target_count, 3)
    elif frequency == "monthly":
        count = min(target_count, 2)
    else:
        count = 1

    count = max(count, 1)

    interval = WAKING_WINDOW_MINUTES // (count + 1)
    interval = max(interval, 60)

    times: list[str] = []
    for i in range(1, count + 1):
        minutes_offset = interval * i
        hour = WAKING_START_HOUR + minutes_offset // 60
        minute = minutes_offset % 60
        if hour >= WAKING_END_HOUR:
            break
        times.append(f"{hour:02d}:{minute:02d}")

    return times if times else ["09:00"]


# ── Helper: task due datetime ───────────────────────────────────────────────


def task_due_datetime(due_date, due_time, user_tz_name: str) -> datetime:
    """Combine a task's *due_date* and optional *due_time* into a UTC datetime."""
    tz = ZoneInfo(user_tz_name)
    t = due_time or time(23, 59)
    return datetime.combine(due_date, t, tzinfo=tz).astimezone(ZoneInfo("UTC"))
