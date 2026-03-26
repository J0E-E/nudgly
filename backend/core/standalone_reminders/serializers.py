"""
Serializers for StandaloneReminder CRUD, snooze, and clear.
"""

from rest_framework import serializers

from core.models import RecurringChoice


def reminder_instance_payload(instance):
    """Convert a ReminderInstance to a response dict."""
    return {
        "id": instance.id,
        "reminder_id": instance.reminder_id,
        "due_at": instance.due_at.isoformat(),
        "cleared_at": instance.cleared_at.isoformat() if instance.cleared_at else None,
        "snoozed_until": (
            instance.snoozed_until.isoformat() if instance.snoozed_until else None
        ),
        "created_at": instance.created_at.isoformat(),
    }


def standalone_reminder_payload(reminder, latest_instance=None):
    """Convert a StandaloneReminder to a response dict."""
    return {
        "id": reminder.id,
        "name": reminder.name,
        "remind_at": reminder.remind_at.isoformat() if reminder.remind_at else None,
        "remind_time": (
            reminder.remind_time.strftime("%H:%M") if reminder.remind_time else None
        ),
        "recurrence": reminder.recurrence,
        "day_of_week": reminder.day_of_week,
        "day_of_month": reminder.day_of_month,
        "month_of_year": reminder.month_of_year,
        "is_active": reminder.is_active,
        "created_at": reminder.created_at.isoformat(),
        "latest_instance": (
            reminder_instance_payload(latest_instance) if latest_instance else None
        ),
        "next_trigger_at": (
            getattr(reminder, "_next_trigger_at", None)
            and reminder._next_trigger_at.isoformat()
        ),
    }


class StandaloneReminderCreateSerializer(serializers.Serializer):
    """Validate and create a StandaloneReminder."""

    name = serializers.CharField(max_length=200)
    recurrence = serializers.ChoiceField(
        choices=RecurringChoice.choices, required=False, allow_null=True, default=None
    )
    remind_at = serializers.DateTimeField(required=False, allow_null=True, default=None)
    remind_time = serializers.TimeField(required=False, allow_null=True, default=None)
    day_of_week = serializers.IntegerField(
        required=False, allow_null=True, default=None, min_value=0, max_value=6
    )
    day_of_month = serializers.IntegerField(
        required=False, allow_null=True, default=None, min_value=1, max_value=31
    )
    month_of_year = serializers.IntegerField(
        required=False, allow_null=True, default=None, min_value=1, max_value=12
    )

    def validate(self, attrs):
        recurrence = attrs.get("recurrence")
        if recurrence is None:
            if not attrs.get("remind_at"):
                raise serializers.ValidationError(
                    {"remind_at": "Required for one-time reminders."}
                )
        else:
            if not attrs.get("remind_time"):
                raise serializers.ValidationError(
                    {"remind_time": "Required for recurring reminders."}
                )
            if recurrence == "weekly" and attrs.get("day_of_week") is None:
                raise serializers.ValidationError(
                    {"day_of_week": "Required for weekly recurrence."}
                )
            if recurrence in ("monthly", "yearly") and attrs.get("day_of_month") is None:
                raise serializers.ValidationError(
                    {"day_of_month": "Required for monthly/yearly recurrence."}
                )
            if recurrence == "yearly" and attrs.get("month_of_year") is None:
                raise serializers.ValidationError(
                    {"month_of_year": "Required for yearly recurrence."}
                )
        return attrs

    def create(self, validated_data):
        from core.models import StandaloneReminder
        from core.schedules import sync_standalone_reminder_schedule

        user = self.context["user"]
        reminder = StandaloneReminder.objects.create(user=user, **validated_data)
        sync_standalone_reminder_schedule(reminder)
        return reminder


class StandaloneReminderPatchSerializer(serializers.Serializer):
    """Validate partial updates to a StandaloneReminder."""

    name = serializers.CharField(required=False, max_length=200)
    recurrence = serializers.ChoiceField(
        choices=RecurringChoice.choices, required=False, allow_null=True
    )
    remind_at = serializers.DateTimeField(required=False, allow_null=True)
    remind_time = serializers.TimeField(required=False, allow_null=True)
    day_of_week = serializers.IntegerField(
        required=False, allow_null=True, min_value=0, max_value=6
    )
    day_of_month = serializers.IntegerField(
        required=False, allow_null=True, min_value=1, max_value=31
    )
    month_of_year = serializers.IntegerField(
        required=False, allow_null=True, min_value=1, max_value=12
    )
    is_active = serializers.BooleanField(required=False)

    def validate(self, attrs):
        reminder = self.context.get("reminder")
        recurrence = attrs.get("recurrence", reminder.recurrence if reminder else None)

        if recurrence is None:
            remind_at = attrs.get("remind_at", reminder.remind_at if reminder else None)
            if not remind_at:
                raise serializers.ValidationError(
                    {"remind_at": "Required for one-time reminders."}
                )
        else:
            remind_time = attrs.get(
                "remind_time", reminder.remind_time if reminder else None
            )
            if not remind_time:
                raise serializers.ValidationError(
                    {"remind_time": "Required for recurring reminders."}
                )
        return attrs

    def update(self, instance, validated_data):
        from core.schedules import sync_standalone_reminder_schedule

        schedule_fields = {
            "recurrence", "remind_at", "remind_time", "day_of_week",
            "day_of_month", "month_of_year", "is_active",
        }
        needs_resync = bool(schedule_fields & set(validated_data.keys()))

        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save(update_fields=list(validated_data.keys()))

        if needs_resync:
            sync_standalone_reminder_schedule(instance)

        return instance


class SnoozeSerializer(serializers.Serializer):
    """Validate snooze request."""

    snooze_minutes = serializers.ChoiceField(
        choices=[5, 15, 30, 60], required=True
    )
