"""
Thin authentication API views for LexCore.

Business rules and validation live in serializers; views orchestrate
request → serializer → response and JWT token issuance / blacklist.
"""

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .google_auth import GoogleAuthSerializer
from .serializers import (
    LoginSerializer,
    LoginUserSerializer,
    LogoutSerializer,
    RegisterSerializer,
    UserSerializer,
)


def _tokens_for_user(user):
    """Issue a fresh access + refresh pair for the given user."""
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }


class RegisterView(APIView):
    """POST /api/auth/register/ — client self-registration (AllowAny)."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"message": "Registration successful."},
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    """POST /api/auth/login/ — email/password → JWT + user payload."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        tokens = _tokens_for_user(user)
        return Response(
            {
                **tokens,
                "user": LoginUserSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )


class MeView(APIView):
    """GET /api/auth/me/ — current user from JWT (IsAuthenticated)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            UserSerializer(request.user).data,
            status=status.HTTP_200_OK,
        )


class LogoutView(APIView):
    """
    POST /api/auth/logout/ — blacklist the refresh token.

    Body: {"refresh": "<refresh_token>"}
    Access token remains valid until expiry; clients should discard both.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            token = RefreshToken(serializer.validated_data["refresh"])
            token.blacklist()
        except TokenError:
            return Response(
                {"detail": "Invalid or expired refresh token."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {"message": "Logout successful."},
            status=status.HTTP_200_OK,
        )


class GoogleAuthView(APIView):
    """
    POST /api/auth/google/

    Body: {"id_token": "...", "intent": "login" | "register"}

    - register → create CLIENT only (if email is new), return JWT
    - login → authenticate existing user of any role, return JWT
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = GoogleAuthSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        tokens = _tokens_for_user(user)
        return Response(
            {
                **tokens,
                "user": LoginUserSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )
