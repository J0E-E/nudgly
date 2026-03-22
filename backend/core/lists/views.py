"""
List CRUD views: list/create and detail/update/delete.
"""

from django.db.models import Count
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.lists.serializers import (
    ListCreateSerializer,
    ListPatchSerializer,
    list_payload,
)
from core.models import List


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


class ListListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = List.objects.filter(user=request.user).annotate(task_count=Count("tasks"))

        # Exclude archived by default.
        include_archived = request.query_params.get("include_archived", "").lower()
        if include_archived not in ("true", "1"):
            qs = qs.filter(archived_at__isnull=True)

        # Optional search filter on name.
        search = request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(name__icontains=search)

        qs = qs.order_by("sort_order", "created_at")

        total = qs.count()
        limit, offset = _parse_pagination(request)
        results = qs[offset : offset + limit]

        return Response(
            {
                "count": total,
                "limit": limit,
                "offset": offset,
                "results": [list_payload(lst) for lst in results],
            }
        )

    def post(self, request):
        serializer = ListCreateSerializer(
            data=request.data, context={"user": request.user}
        )
        serializer.is_valid(raise_exception=True)
        lst = serializer.save()
        return Response(list_payload(lst), status=status.HTTP_201_CREATED)


class ListDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_list(self, request, pk):
        return get_object_or_404(List, pk=pk, user=request.user)

    def get(self, request, pk):
        lst = self._get_list(request, pk)
        return Response(list_payload(lst))

    def patch(self, request, pk):
        lst = self._get_list(request, pk)
        serializer = ListPatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        lst = serializer.update(lst, serializer.validated_data)
        return Response(list_payload(lst))

    def delete(self, request, pk):
        lst = self._get_list(request, pk)
        lst.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
