"""
Thin authentication API views for LexCore.

Business rules and validation live in serializers; views orchestrate
request → serializer → response and JWT token issuance / blacklist.
"""

from django.conf import settings
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .emails import send_password_reset_email
from .google_auth import GoogleAuthSerializer
from .models import User
from .serializers import (
    ForgotPasswordSerializer,
    LoginSerializer,
    LoginUserSerializer,
    LogoutSerializer,
    RegisterSerializer,
    ResetPasswordSerializer,
    UserSerializer,
)

GENERIC_FORGOT_MESSAGE = (
    "If an account exists, a password reset link has been sent."
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


class ForgotPasswordView(APIView):
    """
    POST /api/auth/forgot-password/

    Always returns a generic message (never reveals whether the email exists).
    When a matching active user exists, emails a reset link via configured SMTP.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user is not None:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = PasswordResetTokenGenerator().make_token(user)
            frontend_url = getattr(
                settings, "FRONTEND_URL", "http://localhost:5173"
            ).rstrip("/")
            reset_link = f"{frontend_url}/reset-password/{uid}/{token}"
            send_password_reset_email(user=user, reset_url=reset_link)

        return Response({"message": GENERIC_FORGOT_MESSAGE}, status=status.HTTP_200_OK)


class ResetPasswordView(APIView):
    """
    POST /api/auth/reset-password/

    Body: {"uid": "...", "token": "...", "password": "...", "confirm_password": "..."}
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        user.set_password(serializer.validated_data["password"])
        user.save(update_fields=["password"])
        return Response(
            {"message": "Password has been reset successfully."},
            status=status.HTTP_200_OK,
        )
