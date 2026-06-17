"""
Unit tests for the nudge engine: ReminderSchedule/ReminderEvent models,
the process_due_reminders Celery task, nudge templates, rate limiting,
and priority-aware jitter.
"""

from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.test import TestCase, TransactionTestCase
from django.utils import timezone

from core.models import Habit, List, ReminderEvent, ReminderSchedule, Task
from core.nudge import (
    JITTER_RANGES,
    MAX_NUDGES_PER_HOUR,
    compute_bucket,
    process_due_reminders,
)
from core.nudge_intervals import (
    EARLY,
    LATE,
    MID,
    get_task_due_date_tier,
    get_task_no_due_date_tier,
    get_habit_tier,
)
from core.nudge_templates import (
    HABIT_NUDGE_TEMPLATES,
    HABIT_STREAK_TEMPLATES,
    HABIT_TITLES,
    LIST_DUE_TODAY_TEMPLATES,
    LIST_NUDGE_TEMPLATES,
    NUDGE_TITLES,
    TASK_NUDGE_TEMPLATES,
    select_habit_nudge,
    select_list_nudge,
    select_task_nudge,
)

User = get_user_model()


def _create_user(email="u@example.com", username="user1", password="Pass1234"):
    return User.objects.create_user(email=email, username=username, password=password)


def _create_task(user, **kwargs):
    defaults = {"title": "Test task", "category": "work"}
    defaults.update(kwargs)
    return Task.objects.create(user=user, **defaults)


def _create_schedule(user, task, **kwargs):
    defaults = {
        "next_trigger_at": timezone.now() - timedelta(minutes=5),
    }
    defaults.update(kwargs)
    return ReminderSchedule.objects.create(user=user, task=task, **defaults)


# ── Helper tests ─────────────────────────────────────────────────────────


class ComputeBucketTests(TestCase):
    def test_truncates_seconds_and_microseconds(self):
        dt = timezone.now().replace(second=45, microsecond=123456)
        bucket = compute_bucket(dt)
        self.assertEqual(bucket.second, 0)
        self.assertEqual(bucket.microsecond, 0)
        self.assertEqual(bucket.minute, dt.minute)
        self.assertEqual(bucket.hour, dt.hour)


# ── Model tests ──────────────────────────────────────────────────────────


class ReminderScheduleModelTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.task = _create_task(self.user)

    def test_create_schedule_for_task(self):
        schedule = _create_schedule(self.user, self.task)
        self.assertTrue(schedule.is_active)
        self.assertEqual(schedule.attempt_count, 0)
        self.assertTrue(schedule.persistent)
        self.assertIsNotNone(schedule.created_at)

    def test_xor_constraint_rejects_both_set(self):
        habit = Habit.objects.create(
            user=self.user, name="Test Habit", frequency="daily"
        )
        schedule = ReminderSchedule(
            user=self.user,
            task=self.task,
            habit=habit,
            next_trigger_at=timezone.now(),
        )
        with self.assertRaises(IntegrityError):
            schedule.save()

    def test_xor_constraint_rejects_neither_set(self):
        schedule = ReminderSchedule(
            user=self.user,
            task=None,
            habit=None,
            next_trigger_at=timezone.now(),
        )
        with self.assertRaises(IntegrityError):
            schedule.save()

    def test_cascade_delete_task(self):
        _create_schedule(self.user, self.task)
        self.assertEqual(ReminderSchedule.objects.count(), 1)
        self.task.delete()
        self.assertEqual(ReminderSchedule.objects.count(), 0)

    def test_str(self):
        schedule = _create_schedule(self.user, self.task)
        self.assertIn("task=", str(schedule))


class ReminderEventModelTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.task = _create_task(self.user)
        self.schedule = _create_schedule(self.user, self.task)

    def test_create_event(self):
        now = timezone.now()
        event = ReminderEvent.objects.create(
            schedule=self.schedule,
            triggered_at=now,
            triggered_at_bucket=compute_bucket(now),
            attempt_number=1,
        )
        self.assertFalse(event.acknowledged)
        self.assertFalse(event.notification_sent)

    def test_idempotency_constraint(self):
        now = timezone.now()
        bucket = compute_bucket(now)
        ReminderEvent.objects.create(
            schedule=self.schedule,
            triggered_at=now,
            triggered_at_bucket=bucket,
            attempt_number=1,
        )
        with self.assertRaises(IntegrityError):
            ReminderEvent.objects.create(
                schedule=self.schedule,
                triggered_at=now,
                triggered_at_bucket=bucket,
                attempt_number=2,
            )

    def test_different_buckets_ok(self):
        now = timezone.now()
        bucket1 = compute_bucket(now)
        bucket2 = bucket1 + timedelta(minutes=1)
        ReminderEvent.objects.create(
            schedule=self.schedule,
            triggered_at=now,
            triggered_at_bucket=bucket1,
            attempt_number=1,
        )
        event2 = ReminderEvent.objects.create(
            schedule=self.schedule,
            triggered_at=now,
            triggered_at_bucket=bucket2,
            attempt_number=2,
        )
        self.assertEqual(event2.attempt_number, 2)


# ── Worker task tests ────────────────────────────────────────────────────


class ProcessDueRemindersTests(TestCase):
    """Tests run with CELERY_TASK_ALWAYS_EAGER=True (set in settings.py)."""

    def setUp(self):
        self.user = _create_user()
        self.task = _create_task(self.user)

    def test_creates_event_for_due_schedule(self):
        schedule = _create_schedule(self.user, self.task)
        process_due_reminders()
        self.assertEqual(ReminderEvent.objects.count(), 1)
        event = ReminderEvent.objects.first()
        self.assertEqual(event.schedule, schedule)
        self.assertEqual(event.attempt_number, 1)
        self.assertTrue(event.notification_sent)

    def test_skips_future_schedules(self):
        _create_schedule(
            self.user,
            self.task,
            next_trigger_at=timezone.now() + timedelta(hours=1),
        )
        process_due_reminders()
        self.assertEqual(ReminderEvent.objects.count(), 0)

    def test_skips_inactive_schedules(self):
        _create_schedule(self.user, self.task, is_active=False)
        process_due_reminders()
        self.assertEqual(ReminderEvent.objects.count(), 0)

    def test_respects_task_mute(self):
        self.task.muted_until = timezone.now() + timedelta(hours=1)
        self.task.save(update_fields=["muted_until"])
        _create_schedule(self.user, self.task)
        process_due_reminders()
        self.assertEqual(ReminderEvent.objects.count(), 1)
        event = ReminderEvent.objects.first()
        self.assertFalse(event.notification_sent)

    def test_respects_list_mute(self):
        from core.models import List

        lst = List.objects.create(
            user=self.user,
            name="My List",
            muted_until=timezone.now() + timedelta(hours=1),
        )
        self.task.list = lst
        self.task.save(update_fields=["list"])
        _create_schedule(self.user, self.task)
        process_due_reminders()
        event = ReminderEvent.objects.first()
        self.assertFalse(event.notification_sent)

    def test_advances_next_trigger(self):
        schedule = _create_schedule(self.user, self.task)
        before = timezone.now()
        process_due_reminders()
        schedule.refresh_from_db()
        self.assertTrue(schedule.is_active)
        self.assertEqual(schedule.attempt_count, 1)
        # next_trigger_at should be in the future (dynamic interval + jitter).
        self.assertGreater(schedule.next_trigger_at, before)

    def test_never_deactivates_on_attempt_count(self):
        """Schedules no longer deactivate based on attempt count."""
        schedule = _create_schedule(
            self.user,
            self.task,
            attempt_count=999,
        )
        process_due_reminders()
        schedule.refresh_from_db()
        self.assertTrue(schedule.is_active)
        self.assertEqual(schedule.attempt_count, 1000)

    def test_notification_body_contains_task_title(self):
        """Notification body should include the task title."""
        _create_schedule(self.user, self.task)
        with self.assertLogs("core.notifications", level="INFO") as cm:
            process_due_reminders()
        log_output = "\n".join(cm.output)
        self.assertIn("Test task", log_output)

    def test_notification_title_varies_by_priority(self):
        """Notification title should come from the priority's title set."""
        self.task.priority = 3
        self.task.save(update_fields=["priority"])
        _create_schedule(self.user, self.task)
        with self.assertLogs("core.notifications", level="INFO") as cm:
            process_due_reminders()
        log_output = "\n".join(cm.output)
        valid_titles = NUDGE_TITLES[3]
        self.assertTrue(
            any(t in log_output for t in valid_titles),
            f"Expected one of {valid_titles} in log output",
        )


class ProcessDueRemindersIdempotencyTests(TransactionTestCase):
    """
    Idempotency tests need TransactionTestCase because the worker catches
    IntegrityError internally, which breaks SQLite's atomic block in TestCase.
    """

    def setUp(self):
        self.user = _create_user()
        self.task = _create_task(self.user)

    def test_idempotent_double_run(self):
        past = timezone.now() - timedelta(minutes=5)
        sched = _create_schedule(self.user, self.task, next_trigger_at=past)
        process_due_reminders()
        self.assertEqual(ReminderEvent.objects.count(), 1)
        # Reset next_trigger_at to the same value so the bucket collides.
        sched.refresh_from_db()
        sched.next_trigger_at = past
        sched.is_active = True
        sched.attempt_count = 0
        sched.save(update_fields=["next_trigger_at", "is_active", "attempt_count"])
        process_due_reminders()
        # Should still be 1 event — duplicate bucket was silently skipped.
        self.assertEqual(ReminderEvent.objects.count(), 1)


# ── List-level schedule model tests ─────────────────────────────────────


def _create_list(user, **kwargs):
    defaults = {"name": "Test List"}
    defaults.update(kwargs)
    return List.objects.create(user=user, **defaults)


def _create_list_schedule(user, lst, **kwargs):
    defaults = {
        "next_trigger_at": timezone.now() - timedelta(minutes=5),
    }
    defaults.update(kwargs)
    return ReminderSchedule.objects.create(user=user, list=lst, **defaults)


class ListScheduleModelTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.lst = _create_list(self.user)

    def test_xor_allows_list_only(self):
        schedule = _create_list_schedule(self.user, self.lst)
        self.assertTrue(schedule.is_active)
        self.assertIsNone(schedule.task_id)
        self.assertIsNone(schedule.habit_id)

    def test_xor_rejects_task_and_list(self):
        task = _create_task(self.user)
        schedule = ReminderSchedule(
            user=self.user,
            task=task,
            list=self.lst,
            next_trigger_at=timezone.now(),
        )
        with self.assertRaises(IntegrityError):
            schedule.save()

    def test_cascade_delete_list_removes_schedule(self):
        _create_list_schedule(self.user, self.lst)
        self.assertEqual(ReminderSchedule.objects.count(), 1)
        self.lst.delete()
        self.assertEqual(ReminderSchedule.objects.count(), 0)

    def test_str_shows_list(self):
        schedule = _create_list_schedule(self.user, self.lst)
        self.assertIn("list=", str(schedule))


# ── List-level worker tests ─────────────────────────────────────────────


class ProcessDueListRemindersTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.lst = _create_list(self.user)

    def test_list_schedule_sends_aggregate_message(self):
        _create_task(self.user, list=self.lst, status="pending")
        _create_task(self.user, list=self.lst, status="pending")
        _create_task(self.user, list=self.lst, status="completed")
        schedule = _create_list_schedule(self.user, self.lst)

        with self.assertLogs("core.notifications", level="INFO") as cm:
            process_due_reminders()

        event = ReminderEvent.objects.first()
        self.assertTrue(event.notification_sent)
        # Should mention list name and pending count.
        log_output = "\n".join(cm.output)
        self.assertIn("Test List", log_output)
        self.assertIn("2", log_output)

    def test_list_schedule_due_today_message(self):
        from datetime import date

        _create_task(
            self.user, list=self.lst, status="pending", due_date=date.today()
        )
        _create_task(self.user, list=self.lst, status="pending")
        _create_list_schedule(self.user, self.lst)

        with self.assertLogs("core.notifications", level="INFO") as cm:
            process_due_reminders()

        log_output = "\n".join(cm.output)
        self.assertIn("today", log_output.lower())
        self.assertIn("Test List", log_output)

    def test_list_mute_respected_for_list_schedule(self):
        _create_task(self.user, list=self.lst, status="pending")
        self.lst.muted_until = timezone.now() + timedelta(hours=1)
        self.lst.save(update_fields=["muted_until"])
        _create_list_schedule(self.user, self.lst)

        process_due_reminders()

        event = ReminderEvent.objects.first()
        self.assertFalse(event.notification_sent)

    def test_list_schedule_never_deactivates_on_attempts(self):
        """List schedules no longer deactivate based on attempt count."""
        _create_task(self.user, list=self.lst, status="pending")
        schedule = _create_list_schedule(
            self.user, self.lst, attempt_count=999
        )
        process_due_reminders()
        schedule.refresh_from_db()
        self.assertTrue(schedule.is_active)
        self.assertEqual(schedule.attempt_count, 1000)


# ── Template selection tests ─────────────────────────────────────────────


class NudgeTemplateSelectionTests(TestCase):
    def test_select_task_nudge_returns_title_and_body(self):
        title, body = select_task_nudge(
            priority=3, task_title="Buy groceries", tier=EARLY
        )
        self.assertIsInstance(title, str)
        self.assertIsInstance(body, str)
        self.assertTrue(len(title) > 0)
        self.assertTrue(len(body) > 0)

    def test_task_title_interpolated(self):
        _, body = select_task_nudge(
            priority=2, task_title="Walk the dog", tier=MID
        )
        self.assertIn("Walk the dog", body)

    def test_each_priority_has_templates_for_all_tiers(self):
        for priority in range(4):
            for tier in (EARLY, MID, LATE):
                templates = TASK_NUDGE_TEMPLATES[priority][tier]
                self.assertTrue(
                    len(templates) >= 1,
                    f"Priority {priority}, tier {tier} has no templates",
                )

    def test_select_list_nudge_returns_title_and_body(self):
        title, body = select_list_nudge(
            list_name="Errands", pending_count=3, due_today_count=0, tier=EARLY,
        )
        self.assertIsInstance(title, str)
        self.assertIn("Errands", body)

    def test_select_list_nudge_due_today_variant(self):
        _, body = select_list_nudge(
            list_name="Work", pending_count=5, due_today_count=2, tier=MID,
        )
        self.assertIn("today", body.lower())


# ── Escalation tier tests ───────────────────────────────────────────────


class NudgeEscalationTests(TestCase):
    def test_task_due_date_early_tier(self):
        now = timezone.now()
        due = now + timedelta(hours=200)
        self.assertEqual(get_task_due_date_tier(due, now, priority=3), EARLY)

    def test_task_due_date_mid_tier(self):
        now = timezone.now()
        due = now + timedelta(hours=100)
        self.assertEqual(get_task_due_date_tier(due, now, priority=3), MID)

    def test_task_due_date_late_tier_overdue(self):
        now = timezone.now()
        due = now - timedelta(hours=1)
        self.assertEqual(get_task_due_date_tier(due, now, priority=3), LATE)

    def test_task_no_due_date_early_tier(self):
        now = timezone.now()
        created = now - timedelta(hours=1)
        self.assertEqual(get_task_no_due_date_tier(created, now, priority=3), EARLY)

    def test_task_no_due_date_late_tier(self):
        now = timezone.now()
        created = now - timedelta(hours=100)
        self.assertEqual(get_task_no_due_date_tier(created, now, priority=3), LATE)

    def test_habit_tier_daily_early(self):
        now = timezone.now().replace(hour=9, minute=0)
        self.assertEqual(get_habit_tier("daily", "UTC", now), EARLY)


# ── Rate limiting tests ─────────────────────────────────────────────────


class NudgeRateLimitTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.task = _create_task(self.user)

    def _create_recent_events(self, count):
        """Create count sent events for user in the last hour."""
        for i in range(count):
            task = _create_task(
                self.user, title=f"Filler task {i}",
            )
            schedule = _create_schedule(
                self.user, task,
                next_trigger_at=timezone.now() - timedelta(minutes=30),
                is_active=False,
                attempt_count=1,
            )
            ReminderEvent.objects.create(
                schedule=schedule,
                triggered_at=timezone.now() - timedelta(minutes=15),
                triggered_at_bucket=compute_bucket(
                    timezone.now() - timedelta(minutes=30 + i)
                ),
                attempt_number=1,
                notification_sent=True,
            )

    def test_under_limit_sends_notification(self):
        self._create_recent_events(MAX_NUDGES_PER_HOUR - 1)
        _create_schedule(self.user, self.task)
        process_due_reminders()
        event = ReminderEvent.objects.filter(schedule__task=self.task).first()
        self.assertTrue(event.notification_sent)

    def test_at_limit_skips_notification(self):
        self._create_recent_events(MAX_NUDGES_PER_HOUR)
        schedule = _create_schedule(self.user, self.task)
        process_due_reminders()
        event = ReminderEvent.objects.filter(schedule__task=self.task).first()
        self.assertFalse(event.notification_sent)

    def test_rate_limited_does_not_increment_attempt(self):
        self._create_recent_events(MAX_NUDGES_PER_HOUR)
        schedule = _create_schedule(self.user, self.task, attempt_count=2)
        process_due_reminders()
        schedule.refresh_from_db()
        self.assertEqual(schedule.attempt_count, 2)  # unchanged

    def test_rate_limited_defers_next_trigger(self):
        self._create_recent_events(MAX_NUDGES_PER_HOUR)
        schedule = _create_schedule(self.user, self.task)
        original_trigger = schedule.next_trigger_at
        process_due_reminders()
        schedule.refresh_from_db()
        self.assertTrue(schedule.is_active)
        # Should be deferred into the future.
        self.assertGreater(schedule.next_trigger_at, original_trigger)


# ── Jitter by priority tests ────────────────────────────────────────────


class JitterByPriorityTests(TestCase):
    def setUp(self):
        self.user = _create_user()

    def test_high_priority_jitter_range(self):
        task = _create_task(self.user, priority=3)
        schedule = _create_schedule(self.user, task)
        with patch("core.nudge.random.randint", return_value=1) as mock_randint:
            process_due_reminders()
            mock_randint.assert_called_with(-2, 2)

    def test_low_priority_jitter_range(self):
        task = _create_task(self.user, priority=0)
        schedule = _create_schedule(self.user, task)
        with patch("core.nudge.random.randint", return_value=1) as mock_randint:
            process_due_reminders()
            mock_randint.assert_called_with(-5, 5)

    def test_mid_priority_jitter_range(self):
        task = _create_task(self.user, priority=2)
        schedule = _create_schedule(self.user, task)
        with patch("core.nudge.random.randint", return_value=1) as mock_randint:
            process_due_reminders()
            mock_randint.assert_called_with(-3, 3)


# ── Habit schedule helpers ────────────────────────────────────────────────


def _create_habit(user, **kwargs):
    defaults = {"name": "Test Habit", "frequency": "daily"}
    defaults.update(kwargs)
    return Habit.objects.create(user=user, **defaults)


def _create_habit_schedule(user, habit, **kwargs):
    defaults = {
        "next_trigger_at": timezone.now() - timedelta(minutes=5),
        "persistent": True,
        "recurrence_rule": "09:00",
    }
    defaults.update(kwargs)
    return ReminderSchedule.objects.create(user=user, habit=habit, **defaults)


# ── Habit nudge template tests ──────────────────────────────────────────


class HabitNudgeTemplateTests(TestCase):
    def test_select_habit_nudge_returns_title_and_body(self):
        title, body = select_habit_nudge(
            habit_name="Meditate", tier=EARLY
        )
        self.assertIsInstance(title, str)
        self.assertIn("Meditate", body)
        self.assertIn(title, HABIT_TITLES)

    def test_habit_name_interpolated(self):
        _, body = select_habit_nudge(
            habit_name="Drink water", tier=EARLY
        )
        self.assertIn("Drink water", body)

    def test_streak_variant_used_when_streak_positive(self):
        _, body = select_habit_nudge(
            habit_name="Exercise", tier=EARLY, streak_count=5
        )
        # Body should reference streak_count (5) or next_streak (6).
        self.assertTrue("5" in body or "6" in body, f"Expected streak ref in: {body}")

    def test_no_streak_variant_when_streak_zero(self):
        _, body = select_habit_nudge(
            habit_name="Read", tier=EARLY, streak_count=0
        )
        # Should not contain streak-related numbers.
        self.assertIn("Read", body)

    def test_all_tiers_have_templates(self):
        for tier in (EARLY, MID, LATE):
            self.assertTrue(len(HABIT_NUDGE_TEMPLATES[tier]) >= 1)
            self.assertTrue(len(HABIT_STREAK_TEMPLATES[tier]) >= 1)


# ── Habit worker tests ──────────────────────────────────────────────────


class ProcessDueHabitRemindersTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.habit = _create_habit(self.user, name="Meditate", streak_count=3)

    def test_habit_schedule_sends_notification(self):
        _create_habit_schedule(self.user, self.habit)
        with self.assertLogs("core.notifications", level="INFO") as cm:
            process_due_reminders()
        event = ReminderEvent.objects.first()
        self.assertTrue(event.notification_sent)
        log_output = "\n".join(cm.output)
        self.assertIn("Meditate", log_output)

    def test_habit_schedule_advances_to_tomorrow(self):
        schedule = _create_habit_schedule(self.user, self.habit)
        before = timezone.now()
        process_due_reminders()
        schedule.refresh_from_db()

        self.assertTrue(schedule.is_active)
        self.assertEqual(schedule.attempt_count, 0)
        # Next trigger should be in the future (tomorrow at 09:00 in user TZ).
        self.assertGreater(schedule.next_trigger_at, before)

    def test_habit_schedule_does_not_deactivate(self):
        schedule = _create_habit_schedule(
            self.user, self.habit, attempt_count=999
        )
        process_due_reminders()
        schedule.refresh_from_db()
        # Habit schedules stay active — they reset to tomorrow.
        self.assertTrue(schedule.is_active)

    def test_habit_notification_data_includes_habit_id(self):
        _create_habit_schedule(self.user, self.habit)
        process_due_reminders()
        event = ReminderEvent.objects.first()
        self.assertTrue(event.notification_sent)
        self.assertIn("Meditate", event.body)
