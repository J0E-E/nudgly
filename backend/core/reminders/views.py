"""
Views for reminder endpoints.
"""

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import ReminderSchedule


class ReminderAcknowledgeView(APIView):
    """POST /api/reminders/{schedule_id}/acknowledge/"""

    permission_classes = [IsAuthenticated]

    def post(self, request, schedule_id):
        schedule = get_object_or_404(
            ReminderSchedule, pk=schedule_id, user=request.user
        )

        latest_event = schedule.events.order_by("-triggered_at").first()
        if latest_event and not latest_event.acknowledged:
            latest_event.acknowledged = True
            latest_event.save(update_fields=["acknowledged"])

        if schedule.is_active:
            schedule.is_active = False
            schedule.save(update_fields=["is_active"])

        return Response(status=status.HTTP_204_NO_CONTENT)
