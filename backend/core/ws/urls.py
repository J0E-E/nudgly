"""WebSocket URL routing."""

from django.urls import path

from core.ws.consumers import NotificationConsumer

websocket_urlpatterns = [
    path("ws/notifications/", NotificationConsumer.as_asgi()),
]
