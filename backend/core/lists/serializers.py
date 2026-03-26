"""
Serializers for List CRUD.
"""

from rest_framework import serializers

from core.models import TaskCategory, TaskPriority


def list_payload(lst):
    """Convert a List instance to a response dict."""
    return {
        "id": lst.id,
        "name": lst.name,
        "category": lst.category,
        "tag": lst.tag,
        "priority": lst.priority,
        "sort_order": lst.sort_order,
        "muted_until": lst.muted_until.isoformat() if lst.muted_until else None,
        "archived_at": lst.archived_at.isoformat() if lst.archived_at else None,
        "created_at": lst.created_at.isoformat(),
        "task_count": lst.task_count
        if hasattr(lst, "task_count")
        else lst.tasks.count(),
    }


class ListCreateSerializer(serializers.Serializer):
    """Validate and create a List."""

    name = serializers.CharField(max_length=200)
    category = serializers.ChoiceField(
        choices=TaskCategory.choices, required=False, allow_blank=True, default=""
    )
    tag = serializers.CharField(
        required=False, allow_blank=True, max_length=255, default=""
    )
    priority = serializers.IntegerField(
        required=False, min_value=0, max_value=3, default=TaskPriority.NONE
    )
    sort_order = serializers.IntegerField(required=False, default=0)
    muted_until = serializers.DateTimeField(
        required=False, allow_null=True, default=None
    )

    def create(self, validated_data):
        from core.models import List

        user = self.context["user"]
        return List.objects.create(user=user, **validated_data)


class ListPatchSerializer(serializers.Serializer):
    """Validate partial updates to a List."""

    name = serializers.CharField(required=False, max_length=200)
    category = serializers.ChoiceField(
        choices=TaskCategory.choices, required=False, allow_blank=True
    )
    tag = serializers.CharField(required=False, allow_blank=True, max_length=255)
    priority = serializers.IntegerField(required=False, min_value=0, max_value=3)
    sort_order = serializers.IntegerField(required=False)
    muted_until = serializers.DateTimeField(required=False, allow_null=True)
    archived_at = serializers.DateTimeField(required=False, allow_null=True)

    def update(self, instance, validated_data):
        update_fields = []
        for field, value in validated_data.items():
            setattr(instance, field, value)
            update_fields.append(field)

        instance.save(update_fields=update_fields)

        schedule_fields = {"priority", "archived_at"}
        if schedule_fields & set(validated_data.keys()):
            from core.schedules import sync_list_schedule

            sync_list_schedule(instance)

        return instance
