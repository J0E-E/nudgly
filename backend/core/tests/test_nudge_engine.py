"""
Unit tests for the nudge engine: ReminderSchedule/ReminderEvent models
and the process_due_reminders Celery task.
"""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.test import TestCase, TransactionTestCase
from django.utils import timezone

from core.models import ReminderEvent, ReminderSchedule, Task
from core.nudge import compute_bucket, process_due_reminders

User = get_user_model()


def _create_user(email="u@example.com", username="user1", password="Pass1234"):
    return User.objects.create_user(email=email, username=username, password=password)


def _create_task(user, **kwargs):
    defaults = {"title": "Test task", "category": "adulting"}
    defaults.update(kwargs)
    return Task.objects.create(user=user, **defaults)


def _create_schedule(user, task, **kwargs):
    defaults = {
        "next_trigger_at": timezone.now() - timedelta(minutes=5),
        "retry_interval_minutes": 60,
        "max_attempts": 10,
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
        schedule = ReminderSchedule(
            user=self.user,
            task=self.task,
            habit_id=99,
            next_trigger_at=timezone.now(),
            retry_interval_minutes=60,
            max_attempts=5,
        )
        with self.assertRaises(IntegrityError):
            schedule.save()

    def test_xor_constraint_rejects_neither_set(self):
        schedule = ReminderSchedule(
            user=self.user,
            task=None,
            habit_id=None,
            next_trigger_at=timezone.now(),
            retry_interval_minutes=60,
            max_attempts=5,
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
        schedule = _create_schedule(
            self.user,
            self.task,
            retry_interval_minutes=60,
            max_attempts=10,
        )
        process_due_reminders()
        schedule.refresh_from_db()
        self.assertTrue(schedule.is_active)
        self.assertEqual(schedule.attempt_count, 1)
        # next_trigger_at should be ~60 min from now (+-5 min jitter).
        expected_min = timezone.now() + timedelta(minutes=55)
        expected_max = timezone.now() + timedelta(minutes=65)
        self.assertGreaterEqual(schedule.next_trigger_at, expected_min)
        self.assertLessEqual(schedule.next_trigger_at, expected_max)

    def test_deactivates_at_max_attempts(self):
        schedule = _create_schedule(
            self.user,
            self.task,
            max_attempts=3,
            attempt_count=2,
        )
        process_due_reminders()
        schedule.refresh_from_db()
        self.assertFalse(schedule.is_active)
        self.assertEqual(schedule.attempt_count, 3)


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
