"""
Tests for Epic 8g: Recurring tasks — advancement, stacking, completion,
validation, and nudge escalation.
"""

from datetime import date, time, timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from core.models import ReminderSchedule, Task
from core.nudge_templates import LATE, MID, select_task_nudge
from core.recurrence import advance_due_date, compute_stack_count
from core.stacking import update_stack_counts

User = get_user_model()


def _create_user(email="u@example.com", username="user1", password="Pass1234", **kw):
    return User.objects.create_user(
        email=email, username=username, password=password, **kw
    )


def _create_task(user, **kwargs):
    defaults = {"title": "Test task", "category": "adulting"}
    defaults.update(kwargs)
    return Task.objects.create(user=user, **defaults)


def _auth_client(client, email, password):
    resp = client.post(
        "/api/auth/login/",
        {"email": email, "password": password},
        format="json",
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.json()['access']}")
    return client


# ── advance_due_date tests ───────────────────────────────────────────────


class AdvanceDueDateTests(TestCase):
    def test_advance_daily(self):
        result = advance_due_date(date(2026, 4, 15), "daily")
        self.assertEqual(result, date(2026, 4, 16))

    def test_advance_weekly(self):
        result = advance_due_date(date(2026, 4, 15), "weekly")
        self.assertEqual(result, date(2026, 4, 22))

    def test_advance_monthly(self):
        result = advance_due_date(date(2026, 4, 15), "monthly")
        self.assertEqual(result, date(2026, 5, 15))

    def test_advance_monthly_end_of_month(self):
        # Jan 31 + 1 month = Feb 28 (use future year to avoid skip-to-future)
        result = advance_due_date(date(2027, 1, 31), "monthly")
        self.assertEqual(result, date(2027, 2, 28))

    def test_advance_yearly(self):
        result = advance_due_date(date(2026, 4, 15), "yearly")
        self.assertEqual(result, date(2027, 4, 15))

    def test_advance_yearly_leap_day(self):
        # Feb 29 2028 (leap) + 1 year = Feb 28 2029
        result = advance_due_date(date(2028, 2, 29), "yearly")
        self.assertEqual(result, date(2029, 2, 28))

    def test_advance_past_due_skips_to_future(self):
        far_past = date.today() - timedelta(days=10)
        result = advance_due_date(far_past, "daily")
        self.assertGreater(result, date.today())

    def test_advance_unknown_recurring_returns_same(self):
        d = date(2026, 4, 15)
        self.assertEqual(advance_due_date(d, "biweekly"), d)


# ── compute_stack_count tests ────────────────────────────────────────────


class ComputeStackCountTests(TestCase):
    def test_not_yet_due_returns_zero(self):
        future = date.today() + timedelta(days=5)
        self.assertEqual(compute_stack_count(future, None, "daily", "UTC"), 0)

    def test_daily_3_days_past(self):
        past = date.today() - timedelta(days=3)
        # With 9 AM default, if it's after 9 AM we get 3, if before we get 2.
        result = compute_stack_count(past, time(0, 0), "daily", "UTC")
        self.assertEqual(result, 3)

    def test_weekly_2_weeks_past(self):
        past = date.today() - timedelta(days=14)
        result = compute_stack_count(past, time(0, 0), "weekly", "UTC")
        self.assertEqual(result, 2)

    def test_with_due_time(self):
        today = date.today()
        # Far future time today — not yet due.
        result = compute_stack_count(today, time(23, 59), "daily", "UTC")
        self.assertEqual(result, 0)


# ── Completion behavior tests ────────────────────────────────────────────


class RecurringCompletionTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.client = _auth_client(APIClient(), "u@example.com", "Pass1234")

    def test_complete_recurring_task_advances_date(self):
        resp = self.client.post(
            "/api/tasks/",
            {
                "title": "Daily task",
                "category": "adulting",
                "due_date": "2026-04-15",
                "recurring": "daily",
            },
            format="json",
        )
        task_id = resp.json()["id"]
        resp = self.client.patch(
            f"/api/tasks/{task_id}/",
            {"status": "completed"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertEqual(data["status"], "pending")
        self.assertEqual(data["due_date"], "2026-04-16")
        self.assertIsNone(data["completed_at"])

    def test_complete_recurring_resets_stack_count(self):
        task = _create_task(
            self.user,
            due_date=date.today() - timedelta(days=3),
            recurring="daily",
            stack_count=3,
        )
        resp = self.client.patch(
            f"/api/tasks/{task.id}/",
            {"status": "completed"},
            format="json",
        )
        self.assertEqual(resp.json()["stack_count"], 0)

    def test_complete_recurring_preserves_due_time(self):
        resp = self.client.post(
            "/api/tasks/",
            {
                "title": "Timed recurring",
                "category": "adulting",
                "due_date": "2026-04-15",
                "due_time": "14:30:00",
                "recurring": "daily",
            },
            format="json",
        )
        task_id = resp.json()["id"]
        resp = self.client.patch(
            f"/api/tasks/{task_id}/",
            {"status": "completed"},
            format="json",
        )
        self.assertEqual(resp.json()["due_time"], "14:30:00")

    def test_complete_recurring_resyncs_schedule(self):
        resp = self.client.post(
            "/api/tasks/",
            {
                "title": "Scheduled recurring",
                "category": "adulting",
                "due_date": "2026-04-15",
                "recurring": "weekly",
            },
            format="json",
        )
        task_id = resp.json()["id"]
        schedule = ReminderSchedule.objects.get(task_id=task_id)
        original_trigger = schedule.next_trigger_at

        self.client.patch(
            f"/api/tasks/{task_id}/",
            {"status": "completed"},
            format="json",
        )
        schedule.refresh_from_db()
        self.assertNotEqual(schedule.next_trigger_at, original_trigger)
        self.assertTrue(schedule.is_active)

    def test_complete_nonrecurring_stays_completed(self):
        resp = self.client.post(
            "/api/tasks/",
            {
                "title": "One-off",
                "category": "adulting",
                "due_date": "2026-04-15",
            },
            format="json",
        )
        task_id = resp.json()["id"]
        resp = self.client.patch(
            f"/api/tasks/{task_id}/",
            {"status": "completed"},
            format="json",
        )
        self.assertEqual(resp.json()["status"], "completed")
        self.assertIsNotNone(resp.json()["completed_at"])


# ── Serializer validation tests ──────────────────────────────────────────


class RecurringValidationTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.client = _auth_client(APIClient(), "u@example.com", "Pass1234")

    def test_recurring_requires_due_date(self):
        resp = self.client.post(
            "/api/tasks/",
            {"title": "Bad", "category": "adulting", "recurring": "daily"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_recurring_invalid_value_rejected(self):
        resp = self.client.post(
            "/api/tasks/",
            {
                "title": "Bad",
                "category": "adulting",
                "due_date": "2026-04-15",
                "recurring": "biweekly",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_recurring_null_clears_recurrence(self):
        resp = self.client.post(
            "/api/tasks/",
            {
                "title": "Clear me",
                "category": "adulting",
                "due_date": "2026-04-15",
                "recurring": "daily",
            },
            format="json",
        )
        task_id = resp.json()["id"]
        # Set a stack_count first.
        Task.objects.filter(pk=task_id).update(stack_count=3)

        resp = self.client.patch(
            f"/api/tasks/{task_id}/",
            {"recurring": None},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIsNone(resp.json()["recurring"])
        self.assertEqual(resp.json()["stack_count"], 0)

    def test_payload_includes_stack_count(self):
        resp = self.client.post(
            "/api/tasks/",
            {"title": "Has stack", "category": "adulting"},
            format="json",
        )
        self.assertEqual(resp.json()["stack_count"], 0)

    def test_clear_due_date_clears_recurring_and_stack(self):
        resp = self.client.post(
            "/api/tasks/",
            {
                "title": "Will lose date",
                "category": "adulting",
                "due_date": "2026-04-15",
                "due_time": "10:00:00",
                "recurring": "daily",
            },
            format="json",
        )
        task_id = resp.json()["id"]
        Task.objects.filter(pk=task_id).update(stack_count=3)

        resp = self.client.patch(
            f"/api/tasks/{task_id}/",
            {"due_date": None},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertIsNone(data["due_date"])
        self.assertIsNone(data["due_time"])
        self.assertIsNone(data["recurring"])
        self.assertEqual(data["stack_count"], 0)


# ── Nudge escalation tests ──────────────────────────────────────────────


class StackedNudgeEscalationTests(TestCase):
    def test_stacked_task_forces_late_tier(self):
        _, body = select_task_nudge(
            priority=0, attempt=1, max_attempts=10,
            task_title="Stacked task", stack_count=2,
        )
        self.assertIn("(x3)", body)

    def test_stack_1_forces_mid_tier(self):
        # Attempt 1/10 would normally be early, but stack_count=1 pushes to mid.
        _, body = select_task_nudge(
            priority=0, attempt=1, max_attempts=10,
            task_title="Once stacked", stack_count=1,
        )
        self.assertIn("(x2)", body)

    def test_no_stack_no_indicator(self):
        _, body = select_task_nudge(
            priority=0, attempt=1, max_attempts=10,
            task_title="Normal task", stack_count=0,
        )
        self.assertNotIn("(x", body)


# ── Stacking Celery task tests ───────────────────────────────────────────


class UpdateStackCountsTests(TestCase):
    def setUp(self):
        self.user = _create_user()

    def test_updates_stack_count(self):
        task = _create_task(
            self.user,
            due_date=date.today() - timedelta(days=3),
            due_time=time(0, 0),
            recurring="daily",
            stack_count=0,
        )
        update_stack_counts()
        task.refresh_from_db()
        self.assertEqual(task.stack_count, 3)

    def test_idempotent(self):
        task = _create_task(
            self.user,
            due_date=date.today() - timedelta(days=3),
            due_time=time(0, 0),
            recurring="daily",
            stack_count=0,
        )
        update_stack_counts()
        update_stack_counts()
        task.refresh_from_db()
        self.assertEqual(task.stack_count, 3)

    def test_skips_non_recurring(self):
        task = _create_task(
            self.user,
            due_date=date.today() - timedelta(days=3),
            stack_count=0,
        )
        update_stack_counts()
        task.refresh_from_db()
        self.assertEqual(task.stack_count, 0)

    def test_skips_completed(self):
        task = _create_task(
            self.user,
            due_date=date.today() - timedelta(days=3),
            recurring="daily",
            status="completed",
            stack_count=0,
        )
        update_stack_counts()
        task.refresh_from_db()
        self.assertEqual(task.stack_count, 0)
