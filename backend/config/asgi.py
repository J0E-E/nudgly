"""
ASGI config for Nudgly API.

Routes HTTP to Django's ASGI handler and WebSocket connections
through JWT auth middleware to the WS URL router.
"""

import os

from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# Initialize Django ASGI application early to populate the AppRegistry
# before importing consumers or middleware that depend on models.
django_asgi_app = get_asgi_application()

from core.ws.auth import JWTAuthMiddleware  # noqa: E402
from core.ws.urls import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": JWTAuthMiddleware(URLRouter(websocket_urlpatterns)),
    }
)
