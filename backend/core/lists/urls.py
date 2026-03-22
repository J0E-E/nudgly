"""
URL patterns for List CRUD endpoints.
"""

from django.urls import path

from core.lists.views import ListDetailView, ListListCreateView

urlpatterns = [
    path("", ListListCreateView.as_view(), name="list-list-create"),
    path("<int:pk>/", ListDetailView.as_view(), name="list-detail"),
]
