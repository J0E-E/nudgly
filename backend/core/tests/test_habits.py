"""
Unit tests for Habit CRUD, completion, and streak logic.
"""

from datetime import datetime, time, timedelta
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from core.models import Habit, HabitCompletion, ReminderSchedule

User = get_user_model()

VALID_HABIT = {"name": "Drink water", "frequency": "daily"}


def _create_user(email="u@example.com", username="user1", password="Pass1234"):
    return User.objects.create_user(
        email=email, username=username, password=password, timezone="America/New_York"
    )


def _auth_client(client, email, password):
    resp = client.post(
        "/api/auth/login/",
        {"email": email, "password": password},
        format="json",
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.json()['access']}")
    return client


# ── Model tests ──────────────────────────────────────────────────────────


class HabitModelTests(TestCase):
    def setUp(self):
        self.user = _create_user()

    def test_create_habit_with_defaults(self):
        habit = Habit.objects.create(
            user=self.user, name="Exercise", frequency="daily"
        )
        self.assertEqual(habit.streak_count, 0)
        self.assertIsNone(habit.last_completed_at)
        self.assertEqual(habit.reminder_times, [])
        self.assertEqual(habit.target_count, 1)
        self.assertIsNotNone(habit.created_at)

    def test_str_truncates(self):
        habit = Habit.objects.create(
            user=self.user, name="A" * 100, frequency="daily"
        )
        self.assertEqual(str(habit), "A" * 50)

    def test_cascade_delete_user(self):
        Habit.objects.create(user=self.user, name="H", frequency="daily")
        self.user.delete()
        self.assertEqual(Habit.objects.count(), 0)

    def test_cascade_delete_habit(self):
        habit = Habit.objects.create(
            user=self.user, name="H", frequency="daily"
        )
        HabitCompletion.objects.create(habit=habit)
        self.assertEqual(HabitCompletion.objects.count(), 1)
        habit.delete()
        self.assertEqual(HabitCompletion.objects.count(), 0)


# ── POST /api/habits/ ───────────────────────────────────────────────────


class HabitCreateViewTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.client = APIClient()
        _auth_client(self.client, "u@example.com", "Pass1234")

    def test_create_minimal(self):
        resp = self.client.post("/api/habits/", VALID_HABIT, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        data = resp.json()
        self.assertEqual(data["name"], "Drink water")
        self.assertEqual(data["frequency"], "daily")
        self.assertEqual(data["target_count"], 1)
        self.assertEqual(data["streak_count"], 0)
        self.assertEqual(data["period_completions"], 0)
        self.assertIsNotNone(data["id"])

    def test_create_with_all_fields(self):
        resp = self.client.post(
            "/api/habits/",
            {
                "name": "Read",
                "frequency": "weekly",
                "target_count": 3,
                "reminder_times": ["08:00", "20:00"],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        data = resp.json()
        self.assertEqual(data["target_count"], 3)
        self.assertEqual(data["reminder_times"], ["08:00", "20:00"])

    def test_create_name_required(self):
        resp = self.client.post(
            "/api/habits/", {"frequency": "daily"}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_name_max_length(self):
        resp = self.client.post(
            "/api/habits/",
            {"name": "A" * 201, "frequency": "daily"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_invalid_frequency(self):
        resp = self.client.post(
            "/api/habits/",
            {"name": "Test", "frequency": "hourly"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_invalid_reminder_time(self):
        resp = self.client.post(
            "/api/habits/",
            {"name": "Test", "frequency": "daily", "reminder_times": ["25:00"]},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_target_count_exceeds_max(self):
        resp = self.client.post(
            "/api/habits/",
            {"name": "Test", "frequency": "weekly", "target_count": 8},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_unauthenticated(self):
        client = APIClient()
        resp = client.post("/api/habits/", VALID_HABIT, format="json")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


# ── GET /api/habits/ ─────────────────────────────────────────────────────


class HabitListViewTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.client = APIClient()
        _auth_client(self.client, "u@example.com", "Pass1234")

    def test_list_empty(self):
        resp = self.client.get("/api/habits/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertEqual(data["count"], 0)
        self.assertEqual(data["results"], [])

    def test_list_own_habits(self):
        Habit.objects.create(user=self.user, name="H1", frequency="daily")
        other = _create_user(email="o@example.com", username="other")
        Habit.objects.create(user=other, name="H2", frequency="daily")

        resp = self.client.get("/api/habits/")
        data = resp.json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["results"][0]["name"], "H1")

    def test_list_includes_period_completions(self):
        habit = Habit.objects.create(
            user=self.user, name="H", frequency="daily"
        )
        HabitCompletion.objects.create(habit=habit, skipped=False)
        HabitCompletion.objects.create(habit=habit, skipped=True)

        resp = self.client.get("/api/habits/")
        data = resp.json()
        self.assertEqual(data["results"][0]["period_completions"], 1)

    def test_pagination(self):
        for i in range(5):
            Habit.objects.create(
                user=self.user, name=f"H{i}", frequency="daily"
            )
        resp = self.client.get("/api/habits/?limit=2&offset=0")
        data = resp.json()
        self.assertEqual(data["count"], 5)
        self.assertEqual(len(data["results"]), 2)


# ── GET/PATCH/DELETE /api/habits/{id}/ ───────────────────────────────────


class HabitDetailViewTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.client = APIClient()
        _auth_client(self.client, "u@example.com", "Pass1234")
        self.habit = Habit.objects.create(
            user=self.user, name="Exercise", frequency="daily"
        )

    def test_get_detail(self):
        resp = self.client.get(f"/api/habits/{self.habit.id}/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.json()["name"], "Exercise")

    def test_get_not_found(self):
        other = _create_user(email="o@example.com", username="other")
        h = Habit.objects.create(user=other, name="H", frequency="daily")
        resp = self.client.get(f"/api/habits/{h.id}/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_update_name(self):
        resp = self.client.patch(
            f"/api/habits/{self.habit.id}/",
            {"name": "Yoga"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.json()["name"], "Yoga")

    def test_update_invalid_fields(self):
        resp = self.client.patch(
            f"/api/habits/{self.habit.id}/",
            {"reminder_times": ["bad"]},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_delete_success(self):
        habit_id = self.habit.id
        HabitCompletion.objects.create(habit=self.habit)
        resp = self.client.delete(f"/api/habits/{habit_id}/")
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Habit.objects.filter(pk=habit_id).exists())
        self.assertEqual(HabitCompletion.objects.count(), 0)

    def test_delete_not_found(self):
        resp = self.client.delete("/api/habits/9999/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


# ── POST /api/habits/{id}/complete/ ──────────────────────────────────────


class HabitCompleteViewTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.client = APIClient()
        _auth_client(self.client, "u@example.com", "Pass1234")
        self.habit = Habit.objects.create(
            user=self.user, name="Read", frequency="daily"
        )

    def test_complete_success(self):
        resp = self.client.post(
            f"/api/habits/{self.habit.id}/complete/", {}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        data = resp.json()
        self.assertFalse(data["skipped"])
        self.habit.refresh_from_db()
        self.assertIsNotNone(self.habit.last_completed_at)

    def test_complete_skip(self):
        resp = self.client.post(
            f"/api/habits/{self.habit.id}/complete/",
            {"skipped": True},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(resp.json()["skipped"])
        self.habit.refresh_from_db()
        self.assertIsNone(self.habit.last_completed_at)

    def test_streak_daily_increment(self):
        # Complete today → streak = 1
        self.client.post(
            f"/api/habits/{self.habit.id}/complete/", {}, format="json"
        )
        self.habit.refresh_from_db()
        self.assertEqual(self.habit.streak_count, 1)

    def test_streak_daily_continues(self):
        tz = ZoneInfo("America/New_York")
        yesterday = timezone.now().astimezone(tz) - timedelta(days=1)

        # Create a completion yesterday (manually)
        completion = HabitCompletion.objects.create(
            habit=self.habit, skipped=False
        )
        HabitCompletion.objects.filter(pk=completion.pk).update(
            completed_at=yesterday
        )
        self.habit.streak_count = 1
        self.habit.save(update_fields=["streak_count"])

        # Complete today
        self.client.post(
            f"/api/habits/{self.habit.id}/complete/", {}, format="json"
        )
        self.habit.refresh_from_db()
        self.assertEqual(self.habit.streak_count, 2)

    def test_streak_resets_on_missed_period(self):
        tz = ZoneInfo("America/New_York")
        two_days_ago = timezone.now().astimezone(tz) - timedelta(days=2)

        # Create a completion 2 days ago (yesterday has no completion)
        completion = HabitCompletion.objects.create(
            habit=self.habit, skipped=False
        )
        HabitCompletion.objects.filter(pk=completion.pk).update(
            completed_at=two_days_ago
        )
        self.habit.streak_count = 5
        self.habit.save(update_fields=["streak_count"])

        # Complete today
        self.client.post(
            f"/api/habits/{self.habit.id}/complete/", {}, format="json"
        )
        self.habit.refresh_from_db()
        self.assertEqual(self.habit.streak_count, 1)

    def test_weekly_target_met(self):
        habit = Habit.objects.create(
            user=self.user, name="Run", frequency="weekly", target_count=3
        )
        # Complete twice (target not yet met)
        self.client.post(
            f"/api/habits/{habit.id}/complete/", {}, format="json"
        )
        self.client.post(
            f"/api/habits/{habit.id}/complete/", {}, format="json"
        )
        habit.refresh_from_db()
        self.assertEqual(habit.streak_count, 0)

        # Third completion meets target
        self.client.post(
            f"/api/habits/{habit.id}/complete/", {}, format="json"
        )
        habit.refresh_from_db()
        self.assertEqual(habit.streak_count, 1)

    def test_complete_not_found(self):
        resp = self.client.post(
            "/api/habits/9999/complete/", {}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


# ── ReminderSchedule FK tests ────────────────────────────────────────────


class HabitReminderScheduleTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.habit = Habit.objects.create(
            user=self.user, name="Meditate", frequency="daily"
        )

    def test_reminder_schedule_with_habit_fk(self):
        schedule = ReminderSchedule.objects.create(
            user=self.user,
            habit=self.habit,
            next_trigger_at=timezone.now(),
        )
        self.assertEqual(schedule.habit_id, self.habit.id)
        self.assertIsNone(schedule.task_id)

    def test_cascade_delete_habit_removes_schedules(self):
        ReminderSchedule.objects.create(
            user=self.user,
            habit=self.habit,
            next_trigger_at=timezone.now(),
        )
        self.habit.delete()
        self.assertEqual(ReminderSchedule.objects.count(), 0)
