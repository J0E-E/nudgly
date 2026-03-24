"""
In-app notification views: list, unread count, mark read, mark all read.
"""

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import ReminderEvent


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


def notification_payload(event):
    return {
        "id": event.id,
        "schedule_id": event.schedule_id,
        "title": event.title,
        "body": event.body,
        "triggered_at": event.triggered_at.isoformat(),
        "read_at": event.read_at.isoformat() if event.read_at else None,
        "created_at": event.created_at.isoformat(),
    }


def _sent_events_for_user(user):
    return ReminderEvent.objects.filter(
        schedule__user=user, notification_sent=True
    )


class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = _sent_events_for_user(request.user)

        unread_only = request.query_params.get("unread_only", "").lower()
        if unread_only in ("true", "1"):
            qs = qs.filter(read_at__isnull=True)

        qs = qs.order_by("-triggered_at")
        total = qs.count()
        limit, offset = _parse_pagination(request)
        page = qs[offset : offset + limit]

        return Response(
            {
                "count": total,
                "limit": limit,
                "offset": offset,
                "results": [notification_payload(e) for e in page],
            }
        )


class UnreadCountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        count = _sent_events_for_user(request.user).filter(
            read_at__isnull=True
        ).count()
        return Response({"count": count})


class MarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        event = get_object_or_404(
            ReminderEvent,
            pk=pk,
            schedule__user=request.user,
            notification_sent=True,
        )
        if not event.read_at:
            event.read_at = timezone.now()
            event.save(update_fields=["read_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class MarkAllReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        _sent_events_for_user(request.user).filter(
            read_at__isnull=True
        ).update(read_at=timezone.now())
        return Response(status=status.HTTP_204_NO_CONTENT)
