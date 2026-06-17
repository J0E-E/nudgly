"""
Serializers for Habit CRUD and completion.
"""

import re

from rest_framework import serializers

from core.models import HabitFrequency


def habit_payload(habit, period_completions=None, next_reminder_at=None):
    """Convert a Habit instance to a response dict."""
    return {
        "id": habit.id,
        "name": habit.name,
        "frequency": habit.frequency,
        "target_count": habit.target_count,
        "reminder_times": habit.reminder_times,
        "streak_count": habit.streak_count,
        "last_completed_at": (
            habit.last_completed_at.isoformat() if habit.last_completed_at else None
        ),
        "created_at": habit.created_at.isoformat(),
        "period_completions": period_completions,
        "next_reminder_at": (
            next_reminder_at.isoformat() if next_reminder_at else None
        ),
    }


def completion_payload(completion):
    """Convert a HabitCompletion instance to a response dict."""
    return {
        "id": completion.id,
        "habit_id": completion.habit_id,
        "completed_at": completion.completed_at.isoformat(),
        "skipped": completion.skipped,
    }


_TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")

FREQUENCY_MAX_TARGET = {
    HabitFrequency.DAILY: 24,
    HabitFrequency.WEEKLY: 7,
    HabitFrequency.MONTHLY: 31,
}


class HabitCreateSerializer(serializers.Serializer):
    """Validate and create a Habit."""

    name = serializers.CharField(max_length=200)
    frequency = serializers.ChoiceField(choices=HabitFrequency.choices)
    target_count = serializers.IntegerField(required=False, min_value=1, default=1)
    reminder_times = serializers.ListField(
        child=serializers.CharField(max_length=5),
        required=False,
        default=list,
    )

    def validate_reminder_times(self, value):
        for t in value:
            if not _TIME_RE.match(t):
                raise serializers.ValidationError(
                    f"Invalid time format: {t}. Expected HH:MM (24-hour)."
                )
        return value

    def validate(self, attrs):
        freq = attrs.get("frequency")
        target = attrs.get("target_count", 1)
        max_target = FREQUENCY_MAX_TARGET.get(freq, 31)
        if target > max_target:
            raise serializers.ValidationError(
                {
                    "target_count": (
                        f"Target count cannot exceed {max_target} for {freq} frequency."
                    )
                }
            )
        return attrs

    def create(self, validated_data):
        from core.models import Habit

        user = self.context["user"]
        habit = Habit.objects.create(user=user, **validated_data)

        from core.schedules import sync_habit_schedule

        sync_habit_schedule(habit)
        return habit


class HabitPatchSerializer(serializers.Serializer):
    """Validate partial updates to a Habit."""

    name = serializers.CharField(required=False, max_length=200)
    frequency = serializers.ChoiceField(
        choices=HabitFrequency.choices, required=False
    )
    target_count = serializers.IntegerField(required=False, min_value=1)
    reminder_times = serializers.ListField(
        child=serializers.CharField(max_length=5),
        required=False,
    )

    def validate_reminder_times(self, value):
        for t in value:
            if not _TIME_RE.match(t):
                raise serializers.ValidationError(
                    f"Invalid time format: {t}. Expected HH:MM (24-hour)."
                )
        return value

    def validate(self, attrs):
        habit = self.context.get("habit")
        freq = attrs.get("frequency") or (habit and habit.frequency)
        target = attrs.get("target_count") or (habit and habit.target_count)
        if freq and target:
            max_target = FREQUENCY_MAX_TARGET.get(freq, 31)
            if target > max_target:
                raise serializers.ValidationError(
                    {
                        "target_count": (
                            f"Target count cannot exceed {max_target} for {freq} frequency."
                        )
                    }
                )
        return attrs

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save(update_fields=list(validated_data.keys()))

        schedule_fields = {"reminder_times", "frequency", "target_count"}
        if schedule_fields & set(validated_data.keys()):
            from core.schedules import sync_habit_schedule

            sync_habit_schedule(instance)

        return instance


class HabitCompleteSerializer(serializers.Serializer):
    """Validate habit completion request."""

    skipped = serializers.BooleanField(required=False, default=False)
