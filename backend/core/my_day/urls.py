from django.urls import path

from core.my_day.views import MyDayView

urlpatterns = [
    path("", MyDayView.as_view(), name="my-day"),
]
