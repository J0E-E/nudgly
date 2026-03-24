"""
Habit CRUD views and completion endpoint.
"""

from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.habits.serializers import (
    HabitCompleteSerializer,
    HabitCreateSerializer,
    HabitPatchSerializer,
    completion_payload,
    habit_payload,
)
from core.habits.streak import (
    count_completions_in_period,
    get_period_bounds,
    update_streak,
)
from core.models import Habit, HabitCompletion, HabitFrequency


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


def _habit_with_period_completions(habit, user_timezone):
    """Compute period_completions for a single habit."""
    start, end = get_period_bounds(habit.frequency, user_timezone)
    count = count_completions_in_period(habit, start, end)
    return habit_payload(habit, period_completions=count)


class HabitListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Habit.objects.filter(user=request.user).order_by("created_at")
        total = qs.count()
        limit, offset = _parse_pagination(request)
        habits = qs[offset : offset + limit]

        user_tz = request.user.timezone or "UTC"
        results = [_habit_with_period_completions(h, user_tz) for h in habits]

        return Response(
            {
                "count": total,
                "limit": limit,
                "offset": offset,
                "results": results,
            }
        )

    def post(self, request):
        serializer = HabitCreateSerializer(
            data=request.data, context={"user": request.user}
        )
        serializer.is_valid(raise_exception=True)
        habit = serializer.save()
        return Response(
            habit_payload(habit, period_completions=0),
            status=status.HTTP_201_CREATED,
        )


class HabitDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_habit(self, request, pk):
        return get_object_or_404(Habit, pk=pk, user=request.user)

    def get(self, request, pk):
        habit = self._get_habit(request, pk)
        user_tz = request.user.timezone or "UTC"
        return Response(_habit_with_period_completions(habit, user_tz))

    def patch(self, request, pk):
        habit = self._get_habit(request, pk)
        serializer = HabitPatchSerializer(
            data=request.data,
            context={"user": request.user, "habit": habit},
        )
        serializer.is_valid(raise_exception=True)
        habit = serializer.update(habit, serializer.validated_data)
        user_tz = request.user.timezone or "UTC"
        return Response(_habit_with_period_completions(habit, user_tz))

    def delete(self, request, pk):
        habit = self._get_habit(request, pk)
        habit.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class HabitCompleteView(APIView):
    """POST /api/habits/{id}/complete/ — log completion or skip."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        habit = get_object_or_404(Habit, pk=pk, user=request.user)
        serializer = HabitCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        completion = HabitCompletion.objects.create(
            habit=habit,
            skipped=serializer.validated_data["skipped"],
        )

        if not completion.skipped:
            user_tz = request.user.timezone or "UTC"
            habit.last_completed_at = timezone.now()
            habit.save(update_fields=["last_completed_at"])
            update_streak(habit, user_tz)

        return Response(
            completion_payload(completion),
            status=status.HTTP_201_CREATED,
        )
