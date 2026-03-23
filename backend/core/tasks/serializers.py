"""
Serializers for Task CRUD.
"""

from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from core.models import TaskCategory, TaskPriority, TaskStatus

MUTE_PRESET_DURATIONS = {
    "1h": timedelta(hours=1),
    "1d": timedelta(days=1),
    "1wk": timedelta(weeks=1),
}


def task_payload(task):
    """Convert a Task instance to a response dict."""
    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "category": task.category,
        "tag": task.tag,
        "priority": task.priority,
        "recurring": task.recurring,
        "status": task.status,
        "muted_until": task.muted_until.isoformat() if task.muted_until else None,
        "created_at": task.created_at.isoformat(),
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
        "list_id": task.list_id,
    }


class TaskCreateSerializer(serializers.Serializer):
    """Validate and create a Task."""

    title = serializers.CharField(max_length=500)
    description = serializers.CharField(
        required=False, allow_blank=True, max_length=5000, default=""
    )
    due_date = serializers.DateField(required=False, allow_null=True, default=None)
    category = serializers.ChoiceField(choices=TaskCategory.choices)
    tag = serializers.CharField(
        required=False, allow_blank=True, max_length=255, default=""
    )
    priority = serializers.IntegerField(
        required=False, min_value=0, max_value=5, default=TaskPriority.NO_ONE_CARES
    )
    recurring = serializers.CharField(
        required=False, allow_null=True, allow_blank=True, default=None
    )
    status = serializers.ChoiceField(
        choices=TaskStatus.choices, required=False, default=TaskStatus.PENDING
    )
    muted_until = serializers.DateTimeField(
        required=False, allow_null=True, default=None
    )
    list_id = serializers.IntegerField(required=False, allow_null=True, default=None)

    def validate_list_id(self, value):
        if value is not None:
            from core.models import List

            user = self.context["user"]
            if not List.objects.filter(pk=value, user=user).exists():
                raise serializers.ValidationError("List not found.")
        return value

    def create(self, validated_data):
        from core.models import Task

        user = self.context["user"]
        if validated_data.get(
            "status"
        ) == TaskStatus.COMPLETED and not validated_data.get("completed_at"):
            validated_data["completed_at"] = timezone.now()
        task = Task.objects.create(user=user, **validated_data)

        from core.schedules import sync_list_schedule, sync_task_schedule

        sync_task_schedule(task)
        if task.list_id:
            sync_list_schedule(task.list)
        return task


class TaskPatchSerializer(serializers.Serializer):
    """Validate partial updates to a Task."""

    title = serializers.CharField(required=False, max_length=500)
    description = serializers.CharField(
        required=False, allow_blank=True, max_length=5000
    )
    due_date = serializers.DateField(required=False, allow_null=True)
    category = serializers.ChoiceField(choices=TaskCategory.choices, required=False)
    tag = serializers.CharField(required=False, allow_blank=True, max_length=255)
    priority = serializers.IntegerField(required=False, min_value=0, max_value=5)
    recurring = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    status = serializers.ChoiceField(choices=TaskStatus.choices, required=False)
    muted_until = serializers.DateTimeField(required=False, allow_null=True)
    mute_preset = serializers.ChoiceField(
        choices=list(MUTE_PRESET_DURATIONS.keys()), required=False
    )
    list_id = serializers.IntegerField(required=False, allow_null=True)

    def validate_list_id(self, value):
        if value is not None:
            from core.models import List

            user = self.context["user"]
            if not List.objects.filter(pk=value, user=user).exists():
                raise serializers.ValidationError("List not found.")
        return value

    def validate(self, attrs):
        if "mute_preset" in attrs and "muted_until" in attrs:
            raise serializers.ValidationError(
                "Cannot send both mute_preset and muted_until."
            )
        preset = attrs.pop("mute_preset", None)
        if preset:
            attrs["muted_until"] = timezone.now() + MUTE_PRESET_DURATIONS[preset]
        return attrs

    def update(self, instance, validated_data):
        old_list_id = instance.list_id

        update_fields = []
        for field, value in validated_data.items():
            setattr(instance, field, value)
            update_fields.append(field)

        # Auto-manage completed_at based on status changes.
        if "status" in validated_data:
            if (
                validated_data["status"] == TaskStatus.COMPLETED
                and instance.completed_at is None
            ):
                instance.completed_at = timezone.now()
                if "completed_at" not in update_fields:
                    update_fields.append("completed_at")
            elif validated_data["status"] != TaskStatus.COMPLETED:
                instance.completed_at = None
                if "completed_at" not in update_fields:
                    update_fields.append("completed_at")

        instance.save(update_fields=update_fields)

        schedule_fields = {"due_date", "priority", "status"}
        if schedule_fields & set(validated_data.keys()):
            from core.schedules import sync_task_schedule

            sync_task_schedule(instance)

        # Sync list-level schedules when task status or list assignment changes.
        list_schedule_fields = {"status", "list_id"}
        if list_schedule_fields & set(validated_data.keys()):
            from core.schedules import sync_list_schedule

            if instance.list_id:
                sync_list_schedule(instance.list)
            if old_list_id and old_list_id != instance.list_id:
                from core.models import List

                old_list = List.objects.filter(pk=old_list_id).first()
                if old_list:
                    sync_list_schedule(old_list)

        return instance
