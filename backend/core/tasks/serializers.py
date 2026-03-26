"""
Serializers for Task CRUD.
"""

from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from core.models import RecurringChoice, TaskCategory, TaskPriority, TaskStatus

MUTE_PRESET_DURATIONS = {
    "1h": timedelta(hours=1),
    "1d": timedelta(days=1),
    "1wk": timedelta(weeks=1),
}


def _user_summary(user):
    """Return a compact user dict for API responses."""
    if user is None:
        return None
    return {"id": user.id, "username": user.username, "display_name": user.display_name}


def task_payload(task):
    """Convert a Task instance to a response dict."""
    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "due_time": task.due_time.isoformat() if task.due_time else None,
        "category": task.category,
        "tag": task.tag,
        "priority": task.priority,
        "recurring": task.recurring,
        "stack_count": task.stack_count,
        "status": task.status,
        "muted_until": task.muted_until.isoformat() if task.muted_until else None,
        "created_at": task.created_at.isoformat(),
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
        "list_id": task.list_id,
        "created_by": _user_summary(task.created_by),
        "linked_friends": [_user_summary(f) for f in task.linked_friends.all()],
    }


class TaskCreateSerializer(serializers.Serializer):
    """Validate and create a Task."""

    title = serializers.CharField(max_length=500)
    description = serializers.CharField(
        required=False, allow_blank=True, max_length=5000, default=""
    )
    due_date = serializers.DateField(required=False, allow_null=True, default=None)
    due_time = serializers.TimeField(required=False, allow_null=True, default=None)
    category = serializers.ChoiceField(choices=TaskCategory.choices)
    tag = serializers.CharField(
        required=False, allow_blank=True, max_length=255, default=""
    )
    priority = serializers.IntegerField(
        required=False, min_value=0, max_value=3, default=TaskPriority.NONE
    )
    recurring = serializers.ChoiceField(
        choices=RecurringChoice.choices,
        required=False, allow_null=True, allow_blank=True, default=None,
    )
    status = serializers.ChoiceField(
        choices=TaskStatus.choices, required=False, default=TaskStatus.PENDING
    )
    muted_until = serializers.DateTimeField(
        required=False, allow_null=True, default=None
    )
    list_id = serializers.IntegerField(required=False, allow_null=True, default=None)
    created_for_user_id = serializers.IntegerField(
        required=False, allow_null=True, default=None
    )
    linked_friend_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False, default=list,
    )

    def validate(self, attrs):
        if attrs.get("due_time") and not attrs.get("due_date"):
            raise serializers.ValidationError(
                {"due_time": "due_time requires a due_date."}
            )
        if attrs.get("recurring") and not attrs.get("due_date"):
            raise serializers.ValidationError(
                {"recurring": "recurring requires a due_date."}
            )

        from django.contrib.auth import get_user_model

        from core.friends.services import are_friends

        User = get_user_model()
        user = self.context["user"]
        created_for = attrs.get("created_for_user_id")
        if created_for is not None:
            if created_for == user.pk:
                raise serializers.ValidationError(
                    {"created_for_user_id": "Cannot create a task for yourself."}
                )
            try:
                target_user = User.objects.get(pk=created_for)
            except User.DoesNotExist:
                raise serializers.ValidationError(
                    {"created_for_user_id": "User not found."}
                )
            if not are_friends(user, target_user):
                raise serializers.ValidationError(
                    {"created_for_user_id": "You can only create tasks for friends."}
                )
            attrs["_target_user"] = target_user

        # Validate list_id against the task owner (target user if creating for friend).
        task_owner = attrs.get("_target_user", user)
        list_id = attrs.get("list_id")
        if list_id is not None:
            from core.models import List

            if not List.objects.filter(pk=list_id, user=task_owner).exists():
                raise serializers.ValidationError(
                    {"list_id": "List not found."}
                )

        linked_ids = attrs.get("linked_friend_ids", [])
        if linked_ids:
            for friend_id in linked_ids:
                if friend_id == task_owner.pk:
                    raise serializers.ValidationError(
                        {"linked_friend_ids": "Cannot link the task owner as a friend."}
                    )
                try:
                    friend = User.objects.get(pk=friend_id)
                except User.DoesNotExist:
                    raise serializers.ValidationError(
                        {"linked_friend_ids": f"User {friend_id} not found."}
                    )
                if not are_friends(task_owner, friend):
                    raise serializers.ValidationError(
                        {"linked_friend_ids": f"User {friend_id} is not a friend."}
                    )

        return attrs

    def create(self, validated_data):
        from core.models import Task

        user = self.context["user"]
        target_user = validated_data.pop("_target_user", None)
        linked_ids = validated_data.pop("linked_friend_ids", [])
        validated_data.pop("created_for_user_id", None)

        if target_user:
            validated_data["user"] = target_user
            validated_data["created_by"] = user
            task_owner = target_user
        else:
            task_owner = user

        if validated_data.get(
            "status"
        ) == TaskStatus.COMPLETED and not validated_data.get("completed_at"):
            validated_data["completed_at"] = timezone.now()

        if "user" not in validated_data:
            validated_data["user"] = user
        task = Task.objects.create(**validated_data)

        if linked_ids:
            task.linked_friends.set(linked_ids)

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
    due_time = serializers.TimeField(required=False, allow_null=True)
    category = serializers.ChoiceField(choices=TaskCategory.choices, required=False)
    tag = serializers.CharField(required=False, allow_blank=True, max_length=255)
    priority = serializers.IntegerField(required=False, min_value=0, max_value=3)
    recurring = serializers.ChoiceField(
        choices=RecurringChoice.choices,
        required=False, allow_null=True, allow_blank=True,
    )
    status = serializers.ChoiceField(choices=TaskStatus.choices, required=False)
    muted_until = serializers.DateTimeField(required=False, allow_null=True)
    mute_preset = serializers.ChoiceField(
        choices=list(MUTE_PRESET_DURATIONS.keys()), required=False
    )
    list_id = serializers.IntegerField(required=False, allow_null=True)
    linked_friend_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False,
    )

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
        task = self.context.get("task")
        # due_time requires due_date (either in this patch or already on the task).
        if "due_time" in attrs and attrs["due_time"] is not None:
            new_due_date = attrs.get("due_date", task.due_date if task else None)
            if not new_due_date:
                raise serializers.ValidationError(
                    {"due_time": "due_time requires a due_date."}
                )
        # recurring requires due_date.
        if "recurring" in attrs and attrs["recurring"]:
            new_due_date = attrs.get("due_date", task.due_date if task else None)
            if not new_due_date:
                raise serializers.ValidationError(
                    {"recurring": "recurring requires a due_date."}
                )
        # Clearing due_date on a task with recurring/due_time: also clear those.
        if "due_date" in attrs and attrs["due_date"] is None and task:
            if task.recurring or attrs.get("recurring"):
                attrs["recurring"] = None
                attrs["stack_count"] = 0
            if task.due_time or attrs.get("due_time"):
                attrs["due_time"] = None
        # Clearing recurring resets stack_count.
        if "recurring" in attrs and not attrs["recurring"]:
            attrs["stack_count"] = 0

        # Validate linked_friend_ids — all must be friends of the task owner.
        linked_ids = attrs.get("linked_friend_ids")
        if linked_ids is not None:
            user = self.context["user"]
            from core.friends.services import are_friends

            from django.contrib.auth import get_user_model

            User = get_user_model()
            for friend_id in linked_ids:
                if friend_id == user.pk:
                    raise serializers.ValidationError(
                        {"linked_friend_ids": "Cannot link yourself."}
                    )
                try:
                    friend = User.objects.get(pk=friend_id)
                except User.DoesNotExist:
                    raise serializers.ValidationError(
                        {"linked_friend_ids": f"User {friend_id} not found."}
                    )
                if not are_friends(user, friend):
                    raise serializers.ValidationError(
                        {"linked_friend_ids": f"User {friend_id} is not a friend."}
                    )

        return attrs

    def update(self, instance, validated_data):
        old_list_id = instance.list_id
        linked_ids = validated_data.pop("linked_friend_ids", None)

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

        # Recurring task completion: advance due_date, reset to pending.
        is_completion = validated_data.get("status") == TaskStatus.COMPLETED
        if is_completion and instance.recurring:
            from core.recurrence import advance_due_date

            instance.due_date = advance_due_date(
                instance.due_date, instance.recurring, instance.user.timezone
            )
            instance.status = TaskStatus.PENDING
            instance.stack_count = 0
            instance.completed_at = None
            for f in ("due_date", "status", "stack_count", "completed_at"):
                if f not in update_fields:
                    update_fields.append(f)

        instance.save(update_fields=update_fields)

        if linked_ids is not None:
            instance.linked_friends.set(linked_ids)

        schedule_fields = {"due_date", "due_time", "priority", "status"}
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

        # Notify linked friends on task completion.
        if is_completion and instance.linked_friends.exists():
            from core.tasks.notifications import notify_linked_friends

            notify_linked_friends(instance, "completed")

        return instance
