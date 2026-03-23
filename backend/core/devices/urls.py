"""URL patterns for device token endpoints."""

from django.urls import path

from core.devices.views import DeviceDeactivateView, DeviceRegisterView

urlpatterns = [
    path("register/", DeviceRegisterView.as_view(), name="device-register"),
    path("<str:token>/", DeviceDeactivateView.as_view(), name="device-deactivate"),
]
