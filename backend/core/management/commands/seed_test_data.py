"""
Management command to seed realistic test data for user @joey.

Usage:  python manage.py seed_test_data
"""

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.db import transaction
from django.utils import timezone
from django.core.management.base import BaseCommand

from core.models import (
    HabitCompletion,
    List,
    Habit,
    ReminderEvent,
    ReminderInstance,
    ReminderSchedule,
    StandaloneReminder,
    Task,
    User,
)
from core.schedules import (
    sync_habit_schedule,
    sync_list_schedule,
    sync_standalone_reminder_schedule,
    sync_task_schedule,
)

USER_TZ = "America/New_York"


class Command(BaseCommand):
    help = "Seed realistic test data for user @joey"

    @transaction.atomic
    def handle(self, *args, **options):
        user = self._get_or_create_user()
        self._clear_data(user)

        self._create_standalone_tasks(user)
        lists = self._create_lists(user)
        self._create_list_tasks(user, lists)
        self._create_habits(user)
        self._create_standalone_reminders(user)

        self.stdout.write(self.style.SUCCESS("Seeded test data for @joey"))

    # ── User ────────────────────────────────────────────────────────────

    def _get_or_create_user(self):
        user, created = User.objects.get_or_create(
            username="joey",
            defaults={
                "email": "joey@example.com",
                "display_name": "Joey",
                "timezone": USER_TZ,
            },
        )
        if created:
            user.set_password("testpass123")
            user.save(update_fields=["password"])
            self.stdout.write(f"  Created user @joey")
        else:
            self.stdout.write(f"  Using existing user @joey (pk={user.pk})")
        return user

    # ── Cleanup ─────────────────────────────────────────────────────────

    def _clear_data(self, user):
        ReminderEvent.objects.filter(schedule__user=user).delete()
        ReminderSchedule.objects.filter(user=user).delete()
        ReminderInstance.objects.filter(reminder__user=user).delete()
        HabitCompletion.objects.filter(habit__user=user).delete()
        StandaloneReminder.objects.filter(user=user).delete()
        Habit.objects.filter(user=user).delete()
        Task.objects.filter(user=user).delete()
        List.objects.filter(user=user).delete()
        self.stdout.write("  Cleared existing data")

    # ── Standalone Tasks ────────────────────────────────────────────────

    def _create_standalone_tasks(self, user):
        today = date.today()
        now = timezone.now()

        tasks_data = [
            # (title, category, priority, due_date, due_time, status, recurring, completed_at)
            ("Book dentist appointment", "life_admin", 2, today + timedelta(days=3), time(10, 0), "pending", None, None),
            ("Renew car registration", "life_admin", 3, today + timedelta(days=14), None, "pending", None, None),
            ("Cancel old gym membership", "life_admin", 1, today + timedelta(days=7), None, "pending", None, None),
            ("Buy new running shoes", "personal", 0, today + timedelta(days=10), None, "pending", None, None),
            ("Call mom", "social", 3, today - timedelta(days=1), time(18, 0), "pending", "weekly", None),
            ("Submit expense report", "work", 3, today + timedelta(days=1), time(17, 0), "pending", None, None),
            ("Return library books", "life_admin", 2, today + timedelta(days=5), None, "pending", None, None),
            ("Try that new ramen place", "social", 0, None, None, "pending", None, None),
            ("Update resume", "work", 2, today + timedelta(days=21), None, "pending", None, None),
            ("Practice guitar for 30 min", "personal", 1, None, None, "pending", "daily", None),
            ("File taxes", "life_admin", 3, today + timedelta(days=30), None, "pending", None, None),
            ("Fix leaky kitchen faucet", "life_admin", 2, today + timedelta(days=7), None, "pending", None, None),
            ("Send thank-you note to Sarah", "social", 3, today + timedelta(days=2), None, "pending", None, None),
            ("Organize closet", "personal", 0, None, None, "completed", None, now - timedelta(days=3)),
            ("Pay credit card bill", "life_admin", 3, today - timedelta(days=2), None, "completed", "monthly", now - timedelta(days=2)),
            ("Sign up for cooking class", "personal", 1, today - timedelta(days=5), None, "completed", None, now - timedelta(days=4)),
            ("Get flu shot", "life_admin", 2, today - timedelta(days=10), None, "cancelled", None, None),
        ]

        count = 0
        for title, cat, pri, due, due_t, status, recur, comp_at in tasks_data:
            task = Task.objects.create(
                user=user,
                title=title,
                category=cat,
                priority=pri,
                due_date=due,
                due_time=due_t,
                status=status,
                recurring=recur or "",
                completed_at=comp_at,
            )
            sync_task_schedule(task)
            count += 1

        self.stdout.write(f"  Created {count} standalone tasks")

    # ── Lists ───────────────────────────────────────────────────────────

    def _create_lists(self, user):
        lists_data = [
            ("Grocery Shopping", "life_admin", 2, 0),
            ("Weekend Trip to the Mountains", "personal", 2, 1),
            ("Home Improvement", "life_admin", 1, 2),
            ("Birthday Party Planning", "social", 3, 3),
            ("Self-Care Routine Reset", "personal", 1, 4),
        ]
        created = {}
        for name, cat, pri, sort in lists_data:
            lst = List.objects.create(
                user=user,
                name=name,
                category=cat,
                priority=pri,
                sort_order=sort,
            )
            created[name] = lst

        self.stdout.write(f"  Created {len(created)} lists")
        return created

    def _create_list_tasks(self, user, lists):
        today = date.today()
        now = timezone.now()

        list_tasks = {
            "Grocery Shopping": [
                ("Eggs and milk", "pending", None),
                ("Chicken breast", "pending", None),
                ("Spinach and kale", "pending", None),
                ("Olive oil", "pending", None),
            ],
            "Weekend Trip to the Mountains": [
                ("Book Airbnb", "completed", now - timedelta(days=2)),
                ("Pack hiking boots", "pending", today + timedelta(days=4)),
                ("Download offline maps", "pending", today + timedelta(days=3)),
                ("Get snacks for the road", "pending", today + timedelta(days=4)),
                ("Confirm dog sitter", "pending", today + timedelta(days=2)),
            ],
            "Home Improvement": [
                ("Patch drywall in hallway", "pending", None),
                ("Paint accent wall in bedroom", "pending", None),
                ("Replace bathroom mirror", "pending", None),
                ("Fix squeaky door hinge", "pending", None),
            ],
            "Birthday Party Planning": [
                ("Send invitations", "completed", now - timedelta(days=5)),
                ("Order cake from bakery", "pending", today + timedelta(days=6)),
                ("Buy decorations", "pending", today + timedelta(days=5)),
                ("Make playlist", "pending", today + timedelta(days=7)),
                ("Confirm venue reservation", "pending", today + timedelta(days=3)),
                ("Get candles and party favors", "pending", today + timedelta(days=5)),
            ],
            "Self-Care Routine Reset": [
                ("Research new skincare routine", "pending", None),
                ("Buy journal for gratitude practice", "pending", None),
                ("Schedule massage appointment", "pending", None),
            ],
        }

        count = 0
        for list_name, tasks in list_tasks.items():
            lst = lists[list_name]
            for title, status, due_or_completed in tasks:
                kwargs = {
                    "user": user,
                    "title": title,
                    "category": lst.category,
                    "priority": lst.priority,
                    "status": status,
                    "list": lst,
                }
                if status == "completed":
                    kwargs["completed_at"] = due_or_completed
                elif due_or_completed is not None:
                    kwargs["due_date"] = due_or_completed

                task = Task.objects.create(**kwargs)
                sync_task_schedule(task)
                count += 1

            sync_list_schedule(lst)

        self.stdout.write(f"  Created {count} list tasks")

    # ── Habits ──────────────────────────────────────────────────────────

    def _create_habits(self, user):
        now = timezone.now()

        habits_data = [
            # (name, frequency, target_count, reminder_times, streak, completions_config)
            # completions_config: list of (days_ago, skipped)
            (
                "Drink 8 glasses of water", "daily", 1, ["08:00", "14:00"], 12,
                [(i, False) for i in range(12)],
            ),
            (
                "Read for 30 minutes", "daily", 1, ["21:00"], 5,
                [(i, False) for i in range(5)] + [(6, True), (8, True)],
            ),
            (
                "Exercise", "daily", 1, ["07:00"], 3,
                [(i, False) for i in range(3)],
            ),
            (
                "Meditate for 10 minutes", "daily", 1, ["06:30"], 0,
                [(3, False), (7, False)],  # scattered, streak broken
            ),
            (
                "Meal prep for the week", "weekly", 1, ["10:00"], 4,
                [(i * 7, False) for i in range(4)],
            ),
            (
                "Clean the apartment", "weekly", 1, ["09:00"], 2,
                [(i * 7, False) for i in range(2)],
            ),
        ]

        count = 0
        for name, freq, target, reminders, streak, completions in habits_data:
            last_completed = now - timedelta(days=completions[0][0]) if completions else None
            habit = Habit.objects.create(
                user=user,
                name=name,
                frequency=freq,
                target_count=target,
                reminder_times=reminders,
                streak_count=streak,
                last_completed_at=last_completed,
            )

            # Create completions with backdated timestamps.
            for days_ago, skipped in completions:
                comp = HabitCompletion.objects.create(habit=habit, skipped=skipped)
                # Override auto_now_add via queryset update.
                HabitCompletion.objects.filter(pk=comp.pk).update(
                    completed_at=now - timedelta(days=days_ago)
                )

            sync_habit_schedule(habit)
            count += 1

        self.stdout.write(f"  Created {count} habits with completions")

    # ── Standalone Reminders ────────────────────────────────────────────

    def _create_standalone_reminders(self, user):
        tz = ZoneInfo(USER_TZ)
        today = date.today()

        reminders_data = [
            # Recurring daily
            {
                "name": "Take daily vitamins",
                "remind_time": time(8, 30),
                "recurrence": "daily",
            },
            {
                "name": "Take medication",
                "remind_time": time(22, 0),
                "recurrence": "daily",
            },
            # Recurring weekly
            {
                "name": "Water the plants",
                "remind_time": time(10, 0),
                "recurrence": "weekly",
                "day_of_week": 5,  # Saturday
            },
            # Recurring monthly
            {
                "name": "Pay rent",
                "remind_time": time(9, 0),
                "recurrence": "monthly",
                "day_of_month": 1,
            },
            # Recurring yearly
            {
                "name": "Mom's birthday",
                "remind_time": time(9, 0),
                "recurrence": "yearly",
                "day_of_month": 15,
                "month_of_year": 7,
            },
            # One-time reminders
            {
                "name": "Dentist appointment",
                "remind_at": datetime.combine(
                    today + timedelta(days=8), time(14, 0), tzinfo=tz
                ),
            },
            {
                "name": "Renew passport",
                "remind_at": datetime.combine(
                    today + timedelta(days=45), time(10, 0), tzinfo=tz
                ),
            },
        ]

        count = 0
        for data in reminders_data:
            reminder = StandaloneReminder.objects.create(user=user, **data)
            sync_standalone_reminder_schedule(reminder)
            count += 1

        self.stdout.write(f"  Created {count} standalone reminders")
