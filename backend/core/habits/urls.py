"""
URL patterns for /api/habits/.
"""

from django.urls import path

from core.habits.views import HabitCompleteView, HabitDetailView, HabitListCreateView

urlpatterns = [
    path("", HabitListCreateView.as_view(), name="habit-list-create"),
    path("<int:pk>/", HabitDetailView.as_view(), name="habit-detail"),
    path("<int:pk>/complete/", HabitCompleteView.as_view(), name="habit-complete"),
]
