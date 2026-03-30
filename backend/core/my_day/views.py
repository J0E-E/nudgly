"""
My Day aggregation endpoint: single-request dashboard data.
"""

from datetime import timedelta
from zoneinfo import ZoneInfo

from django.db.models import Min, Q
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.habits.serializers import habit_payload
from core.habits.streak import count_completions_in_period, get_period_bounds
from core.models import Habit, ReminderSchedule, Task, TaskStatus
from core.tasks.serializers import task_payload


def _upcoming_reminder_payload(schedule):
    """Serialize a ReminderSchedule for upcoming-reminders in My Day."""
    sr = schedule.standalone_reminder
    return {
        "id": sr.id,
        "name": sr.name,
        "next_trigger_at": schedule.next_trigger_at.isoformat(),
        "recurrence": sr.recurrence,
    }


class MyDayView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        user_tz_str = user.timezone or "UTC"
        user_tz = ZoneInfo(user_tz_str)
        now = timezone.now()
        today_local = now.astimezone(user_tz).date()

        # ── Focus tasks ─────────────────────────────────────────────
        focus_qs = (
            Task.objects.filter(user=user, focus_date=today_local)
            .select_related("created_by")
            .prefetch_related("linked_friends")
            .order_by("focus_sort_order")
        )
        focus_tasks = [task_payload(t) for t in focus_qs]

        # ── Habits (incomplete for current period) ──────────────────
        habits_qs = (
            Habit.objects.filter(user=user)
            .annotate(
                _next_reminder_at=Min(
                    "reminder_schedules__next_trigger_at",
                    filter=Q(reminder_schedules__is_active=True),
                )
            )
            .order_by("created_at")
        )
        habits_remaining = []
        for habit in habits_qs:
            start, end = get_period_bounds(habit.frequency, user_tz_str)
            count = count_completions_in_period(habit, start, end)
            if count < habit.target_count:
                next_reminder = getattr(habit, "_next_reminder_at", None)
                habits_remaining.append(
                    habit_payload(
                        habit,
                        period_completions=count,
                        next_reminder_at=next_reminder,
                    )
                )

        # ── Upcoming reminders (standalone, within 24h, max 3) ─────
        window_end = now + timedelta(hours=24)
        reminder_qs = (
            ReminderSchedule.objects.filter(
                user=user,
                is_active=True,
                standalone_reminder__isnull=False,
                next_trigger_at__gte=now,
                next_trigger_at__lte=window_end,
            )
            .select_related("standalone_reminder")
            .order_by("next_trigger_at")[:3]
        )
        upcoming_reminders = [_upcoming_reminder_payload(s) for s in reminder_qs]

        # ── Metrics ─────────────────────────────────────────────────
        focus_total = len(focus_tasks)
        focus_completed = sum(
            1 for t in focus_tasks if t["status"] == TaskStatus.COMPLETED
        )

        tasks_due_today_count = (
            Task.objects.filter(
                user=user,
                due_date=today_local,
                status=TaskStatus.PENDING,
            )
            .exclude(focus_date=today_local)
            .count()
        )

        return Response(
            {
                "focus_tasks": focus_tasks,
                "habits": habits_remaining,
                "upcoming_reminders": upcoming_reminders,
                "metrics": {
                    "focus_total": focus_total,
                    "focus_completed": focus_completed,
                    "habits_remaining": len(habits_remaining),
                    "upcoming_reminder_count": len(upcoming_reminders),
                },
                "tasks_due_today_count": tasks_due_today_count,
            }
        )
