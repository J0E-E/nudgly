"""
WebSocket JWT authentication middleware for Django Channels.

Extracts a JWT access token from the query string (?token=<jwt>),
validates it via simplejwt, and populates scope["user"].
Rejects unauthenticated connections with close code 4003.
"""

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken

User = get_user_model()


@database_sync_to_async
def get_user_from_token(token_str):
    """Validate JWT access token and return the User, or AnonymousUser."""
    try:
        token = AccessToken(token_str)
        return User.objects.get(pk=token["user_id"])
    except (InvalidToken, TokenError, User.DoesNotExist, KeyError):
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    """
    Authenticate WebSocket connections via JWT in the query string.

    Client connects with: ws://host/ws/path/?token=<access_token>
    Invalid or missing token closes connection with code 4003.
    """

    async def __call__(self, scope, receive, send):
        query_string = scope.get("query_string", b"").decode("utf-8")
        query_params = parse_qs(query_string)
        token_list = query_params.get("token", [])

        if token_list:
            scope["user"] = await get_user_from_token(token_list[0])
        else:
            scope["user"] = AnonymousUser()

        if scope["user"].is_anonymous:
            await send({"type": "websocket.close", "code": 4003})
            return

        return await super().__call__(scope, receive, send)
