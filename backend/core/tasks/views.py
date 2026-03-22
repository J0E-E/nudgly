"""
Task CRUD views: list/create and detail/update/delete.
"""

from django.db.models import F
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import Task, TaskStatus
from core.tasks.serializers import (
    TaskCreateSerializer,
    TaskPatchSerializer,
    task_payload,
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


class TaskListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Task.objects.filter(user=request.user)

        # Optional status filter.
        status_filter = request.query_params.get("status")
        if status_filter and status_filter in TaskStatus.values:
            qs = qs.filter(status=status_filter)

        # Optional list_id filter.
        list_id_param = request.query_params.get("list_id")
        if list_id_param is not None:
            if list_id_param.lower() == "none":
                qs = qs.filter(list__isnull=True)
            else:
                try:
                    qs = qs.filter(list_id=int(list_id_param))
                except (ValueError, TypeError):
                    pass

        qs = qs.order_by(F("due_date").asc(nulls_last=True), "created_at")

        total = qs.count()
        limit, offset = _parse_pagination(request)
        results = qs[offset : offset + limit]

        return Response(
            {
                "count": total,
                "limit": limit,
                "offset": offset,
                "results": [task_payload(t) for t in results],
            }
        )

    def post(self, request):
        serializer = TaskCreateSerializer(
            data=request.data, context={"user": request.user}
        )
        serializer.is_valid(raise_exception=True)
        task = serializer.save()
        return Response(task_payload(task), status=status.HTTP_201_CREATED)


class TaskDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_task(self, request, pk):
        return get_object_or_404(Task, pk=pk, user=request.user)

    def get(self, request, pk):
        task = self._get_task(request, pk)
        return Response(task_payload(task))

    def patch(self, request, pk):
        task = self._get_task(request, pk)
        serializer = TaskPatchSerializer(
            data=request.data, context={"user": request.user}
        )
        serializer.is_valid(raise_exception=True)
        task = serializer.update(task, serializer.validated_data)
        return Response(task_payload(task))

    def delete(self, request, pk):
        task = self._get_task(request, pk)
        task.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
