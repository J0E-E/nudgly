"""
StandaloneReminder CRUD, snooze, and clear views.
"""

from datetime import timedelta

from django.db.models import Max, Min, Q, Subquery
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import ReminderInstance, ReminderSchedule, StandaloneReminder
from core.standalone_reminders.serializers import (
    SnoozeSerializer,
    StandaloneReminderCreateSerializer,
    StandaloneReminderPatchSerializer,
    reminder_instance_payload,
    standalone_reminder_payload,
)


def _parse_pagination(request):
    """Parse limit/offset from query params with bounds."""
    try:
        limit = min(int(request.query_params.get("limit", 50)), 100)
        limit = max(limit, 1)
    except (ValueError, TypeError):
        limit = 50
    try:
        offset = max(int(request.query_params.get("offset", 0)), 0)
    except (ValueError, TypeError):
        offset = 0
    return limit, offset


def _annotate_reminders(qs):
    """Annotate reminders with next_trigger_at from active schedules."""
    return qs.annotate(
        _next_trigger_at=Min(
            "reminder_schedules__next_trigger_at",
            filter=Q(reminder_schedules__is_active=True),
        )
    )


def _get_latest_uncleared_instance(reminder):
    """Return the latest uncleared instance for a reminder, or None."""
    return (
        ReminderInstance.objects.filter(reminder=reminder, cleared_at__isnull=True)
        .order_by("-due_at")
        .first()
    )


class StandaloneReminderListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = _annotate_reminders(
            StandaloneReminder.objects.filter(user=request.user, is_active=True)
        ).order_by("_next_trigger_at", "created_at")

        total = qs.count()
        limit, offset = _parse_pagination(request)
        reminders = list(qs[offset : offset + limit])

        results = []
        for r in reminders:
            latest = _get_latest_uncleared_instance(r)
            results.append(standalone_reminder_payload(r, latest))

        return Response(
            {"count": total, "limit": limit, "offset": offset, "results": results}
        )

    def post(self, request):
        serializer = StandaloneReminderCreateSerializer(
            data=request.data, context={"user": request.user}
        )
        serializer.is_valid(raise_exception=True)
        reminder = serializer.save()
        reminder = _annotate_reminders(
            StandaloneReminder.objects.filter(pk=reminder.pk)
        ).get()
        return Response(
            standalone_reminder_payload(reminder),
            status=status.HTTP_201_CREATED,
        )


class StandaloneReminderDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_reminder(self, request, pk):
        qs = _annotate_reminders(StandaloneReminder.objects.all())
        return get_object_or_404(qs, pk=pk, user=request.user)

    def get(self, request, pk):
        reminder = self._get_reminder(request, pk)
        latest = _get_latest_uncleared_instance(reminder)
        return Response(standalone_reminder_payload(reminder, latest))

    def patch(self, request, pk):
        reminder = self._get_reminder(request, pk)
        serializer = StandaloneReminderPatchSerializer(
            data=request.data,
            context={"user": request.user, "reminder": reminder},
        )
        serializer.is_valid(raise_exception=True)
        serializer.update(reminder, serializer.validated_data)
        reminder = self._get_reminder(request, pk)
        latest = _get_latest_uncleared_instance(reminder)
        return Response(standalone_reminder_payload(reminder, latest))

    def delete(self, request, pk):
        reminder = self._get_reminder(request, pk)
        reminder.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ReminderInstanceSnoozeView(APIView):
    """POST /api/standalone-reminders/{pk}/instances/{instance_pk}/snooze/"""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk, instance_pk):
        reminder = get_object_or_404(
            StandaloneReminder, pk=pk, user=request.user
        )
        instance = get_object_or_404(
            ReminderInstance, pk=instance_pk, reminder=reminder, cleared_at__isnull=True
        )
        serializer = SnoozeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        minutes = serializer.validated_data["snooze_minutes"]
        snooze_target = timezone.now() + timedelta(minutes=minutes)
        instance.snoozed_until = snooze_target
        instance.save(update_fields=["snoozed_until"])

        # Create a temporary schedule to re-fire at snooze time.
        ReminderSchedule.objects.update_or_create(
            standalone_reminder=reminder,
            defaults={
                "user": reminder.user,
                "next_trigger_at": snooze_target,
                "retry_interval_minutes": 0,
                "max_attempts": 1,
                "persistent": False,
                "is_active": True,
                "attempt_count": 0,
            },
        )

        return Response(reminder_instance_payload(instance))


class ReminderInstanceClearView(APIView):
    """POST /api/standalone-reminders/{pk}/instances/{instance_pk}/clear/"""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk, instance_pk):
        reminder = get_object_or_404(
            StandaloneReminder, pk=pk, user=request.user
        )
        instance = get_object_or_404(
            ReminderInstance, pk=instance_pk, reminder=reminder, cleared_at__isnull=True
        )
        instance.cleared_at = timezone.now()
        instance.save(update_fields=["cleared_at"])

        # One-time reminders: deactivate after clearing.
        if not reminder.recurrence:
            reminder.is_active = False
            reminder.save(update_fields=["is_active"])
            ReminderSchedule.objects.filter(
                standalone_reminder=reminder, is_active=True
            ).update(is_active=False)

        return Response(reminder_instance_payload(instance))
