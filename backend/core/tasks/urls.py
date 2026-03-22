"""
URL patterns for Task CRUD endpoints.
"""

from django.urls import path

from core.tasks.views import TaskDetailView, TaskListCreateView, TaskScheduleView

urlpatterns = [
    path("", TaskListCreateView.as_view(), name="task-list-create"),
    path("<int:pk>/", TaskDetailView.as_view(), name="task-detail"),
    path("<int:pk>/schedule/", TaskScheduleView.as_view(), name="task-schedule"),
]
