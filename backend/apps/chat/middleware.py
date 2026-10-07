from urllib.parse import parse_qs
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken

User = get_user_model()


@database_sync_to_async
def get_user_from_token(token_string: str):
    """
    Validates a SimpleJWT token string and retrieves the active user.
    Returns AnonymousUser if invalid, expired, or user not found/inactive.
    """
    if not token_string:
        return AnonymousUser()
    try:
        access_token = AccessToken(token_string)
        user_id_claim = settings.SIMPLE_JWT.get("USER_ID_CLAIM", "user_id")
        user_id = access_token.get(user_id_claim)
        if not user_id:
            return AnonymousUser()
        return User.objects.get(id=user_id, is_active=True)
    except (InvalidToken, TokenError, User.DoesNotExist, Exception):
        return AnonymousUser()


class JwtAuthMiddleware(BaseMiddleware):
    """
    Channels ASGI middleware that authenticates users via SimpleJWT.
    Inspects query string `?token=<jwt_access_token>` first (standard for browser WebSockets),
    then falls back to `Authorization: Bearer <token>` in ASGI headers.
    """

    async def __call__(self, scope, receive, send):
        token = None

        query_string = scope.get("query_string", b"").decode("utf-8")
        if query_string:
            query_params = parse_qs(query_string)
            token_list = query_params.get("token")
            if token_list and len(token_list) > 0:
                token = token_list[0]

        if not token:
            headers = dict(scope.get("headers", []))
            auth_header = headers.get(b"authorization", b"").decode("utf-8")
            if auth_header.startswith("Bearer "):
                token = auth_header.split("Bearer ", 1)[1].strip()

        scope["user"] = await get_user_from_token(token) if token else AnonymousUser()
        return await super().__call__(scope, receive, send)
