"""
Unit tests for My Day aggregation endpoint: GET /api/my-day/.
"""

from datetime import date, datetime, timedelta, timezone as dt_tz
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from core.models import (
    Habit,
    HabitCompletion,
    HabitFrequency,
    ReminderSchedule,
    StandaloneReminder,
    Task,
    TaskStatus,
)

User = get_user_model()

URL = "/api/my-day/"


def _create_user(email="u@example.com", username="user1", password="Pass1234", tz="UTC"):
    return User.objects.create_user(
        email=email, username=username, password=password, timezone=tz
    )


def _auth_client(client, email, password):
    resp = client.post(
        "/api/auth/login/",
        {"email": email, "password": password},
        format="json",
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.json()['access']}")
    return client


class MyDayAuthTests(TestCase):
    def test_unauthenticated_401(self):
        resp = APIClient().get(URL)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


class MyDayEmptyTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.client = APIClient()
        _auth_client(self.client, "u@example.com", "Pass1234")

    def test_empty_state(self):
        resp = self.client.get(URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertEqual(data["focus_tasks"], [])
        self.assertEqual(data["habits"], [])
        self.assertEqual(data["upcoming_reminders"], [])
        self.assertEqual(data["metrics"]["focus_total"], 0)
        self.assertEqual(data["metrics"]["focus_completed"], 0)
        self.assertEqual(data["metrics"]["habits_remaining"], 0)
        self.assertEqual(data["metrics"]["upcoming_reminder_count"], 0)
        self.assertEqual(data["tasks_due_today_count"], 0)


class MyDayFocusTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.client = APIClient()
        _auth_client(self.client, "u@example.com", "Pass1234")
        self.today = timezone.now().date()

    def test_focus_tasks_ordered(self):
        Task.objects.create(
            user=self.user, title="C", focus_date=self.today, focus_sort_order=2
        )
        Task.objects.create(
            user=self.user, title="A", focus_date=self.today, focus_sort_order=0
        )
        Task.objects.create(
            user=self.user, title="B", focus_date=self.today, focus_sort_order=1
        )

        resp = self.client.get(URL)
        data = resp.json()
        titles = [t["title"] for t in data["focus_tasks"]]
        self.assertEqual(titles, ["A", "B", "C"])
        self.assertEqual(data["metrics"]["focus_total"], 3)
        self.assertEqual(data["metrics"]["focus_completed"], 0)

    def test_completed_focus_task_included(self):
        Task.objects.create(
            user=self.user,
            title="Done",
            focus_date=self.today,
            status=TaskStatus.COMPLETED,
            completed_at=timezone.now(),
        )
        Task.objects.create(
            user=self.user, title="Pending", focus_date=self.today
        )

        resp = self.client.get(URL)
        data = resp.json()
        self.assertEqual(len(data["focus_tasks"]), 2)
        self.assertEqual(data["metrics"]["focus_total"], 2)
        self.assertEqual(data["metrics"]["focus_completed"], 1)

    def test_yesterday_focus_excluded(self):
        yesterday = self.today - timedelta(days=1)
        Task.objects.create(
            user=self.user, title="Old", focus_date=yesterday
        )
        resp = self.client.get(URL)
        self.assertEqual(resp.json()["focus_tasks"], [])


class MyDayHabitTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.client = APIClient()
        _auth_client(self.client, "u@example.com", "Pass1234")

    def test_habits_incomplete_only(self):
        h1 = Habit.objects.create(
            user=self.user, name="Exercise", frequency=HabitFrequency.DAILY, target_count=1
        )
        h2 = Habit.objects.create(
            user=self.user, name="Read", frequency=HabitFrequency.DAILY, target_count=1
        )
        # Complete h1
        HabitCompletion.objects.create(habit=h1, completed_at=timezone.now())

        resp = self.client.get(URL)
        data = resp.json()
        habit_names = [h["name"] for h in data["habits"]]
        self.assertIn("Read", habit_names)
        self.assertNotIn("Exercise", habit_names)
        self.assertEqual(data["metrics"]["habits_remaining"], 1)

    def test_all_habits_complete_excluded(self):
        h = Habit.objects.create(
            user=self.user, name="Meditate", frequency=HabitFrequency.DAILY, target_count=1
        )
        HabitCompletion.objects.create(habit=h, completed_at=timezone.now())

        resp = self.client.get(URL)
        data = resp.json()
        self.assertEqual(data["habits"], [])
        self.assertEqual(data["metrics"]["habits_remaining"], 0)


class MyDayReminderTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.client = APIClient()
        _auth_client(self.client, "u@example.com", "Pass1234")
        self.now = timezone.now()

    def _create_standalone_schedule(self, name, trigger_at):
        sr = StandaloneReminder.objects.create(
            user=self.user, name=name, remind_at=trigger_at
        )
        return ReminderSchedule.objects.create(
            user=self.user,
            standalone_reminder=sr,
            next_trigger_at=trigger_at,
            retry_interval_minutes=5,
            max_attempts=3,
        )

    def test_upcoming_reminders_window(self):
        self._create_standalone_schedule("Soon", self.now + timedelta(hours=1))
        self._create_standalone_schedule("Far", self.now + timedelta(hours=25))

        resp = self.client.get(URL)
        data = resp.json()
        names = [r["name"] for r in data["upcoming_reminders"]]
        self.assertIn("Soon", names)
        self.assertNotIn("Far", names)

    def test_upcoming_reminders_limit_3(self):
        for i in range(5):
            self._create_standalone_schedule(
                f"R{i}", self.now + timedelta(hours=i + 1)
            )

        resp = self.client.get(URL)
        data = resp.json()
        self.assertEqual(len(data["upcoming_reminders"]), 3)
        self.assertEqual(data["metrics"]["upcoming_reminder_count"], 3)

    def test_reminders_standalone_only(self):
        # Task-linked schedule should NOT appear
        task = Task.objects.create(user=self.user, title="T")
        ReminderSchedule.objects.create(
            user=self.user,
            task=task,
            next_trigger_at=self.now + timedelta(hours=1),
            retry_interval_minutes=5,
            max_attempts=3,
        )

        resp = self.client.get(URL)
        self.assertEqual(resp.json()["upcoming_reminders"], [])


class MyDayTimezoneTests(TestCase):
    def test_timezone_handling(self):
        """UTC has rolled to Mar 31 but US/Eastern is still Mar 30 — verify user's date wins."""
        user = _create_user(tz="US/Eastern")
        client = APIClient()
        _auth_client(client, "u@example.com", "Pass1234")

        # 2026-03-31 03:00 UTC = 2026-03-30 23:00 EDT (UTC-4)
        mock_now = datetime(2026, 3, 31, 3, 0, tzinfo=dt_tz.utc)
        et_today = date(2026, 3, 30)
        utc_today = date(2026, 3, 31)

        Task.objects.create(user=user, title="ET task", focus_date=et_today)
        Task.objects.create(user=user, title="UTC task", focus_date=utc_today)

        with patch("django.utils.timezone.now", return_value=mock_now):
            with patch("core.my_day.views.timezone.now", return_value=mock_now):
                resp = client.get(URL)

        data = resp.json()
        titles = [t["title"] for t in data["focus_tasks"]]
        self.assertIn("ET task", titles)
        self.assertNotIn("UTC task", titles)


class MyDayTasksDueTodayTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.client = APIClient()
        _auth_client(self.client, "u@example.com", "Pass1234")
        self.today = timezone.now().date()

    def test_excludes_focus_tasks(self):
        # Due today AND in focus — should NOT count
        Task.objects.create(
            user=self.user, title="Focused", due_date=self.today, focus_date=self.today
        )
        # Due today, NOT in focus — should count
        Task.objects.create(
            user=self.user, title="Unfocused", due_date=self.today
        )

        resp = self.client.get(URL)
        self.assertEqual(resp.json()["tasks_due_today_count"], 1)

    def test_excludes_completed(self):
        Task.objects.create(
            user=self.user,
            title="Done",
            due_date=self.today,
            status=TaskStatus.COMPLETED,
            completed_at=timezone.now(),
        )

        resp = self.client.get(URL)
        self.assertEqual(resp.json()["tasks_due_today_count"], 0)
