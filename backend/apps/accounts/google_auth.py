"""
Google Sign-In helpers for LexCore.

Verifies Google ID tokens and resolves / creates LexCore users.
Register intent creates CLIENT accounts only.
Login intent authenticates any existing role (client or legal team).
"""

from django.conf import settings
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from rest_framework import serializers

from .models import User, UserRole


class GoogleAuthSerializer(serializers.Serializer):
    """Accept a Google Identity Services ID token + auth intent."""

    credential = serializers.CharField(write_only=True, required=False, allow_blank=True)
    id_token = serializers.CharField(write_only=True, required=False, allow_blank=True)
    intent = serializers.ChoiceField(choices=("login", "register"))

    def validate(self, attrs):
        client_id = (getattr(settings, "GOOGLE_OAUTH_CLIENT_ID", "") or "").strip().strip('"').strip("'")
        if not client_id:
            raise serializers.ValidationError(
                "Google Sign-In is not configured on the server."
            )

        # Accept either key from the client (GIS uses "credential")
        raw_token = (attrs.get("id_token") or attrs.get("credential") or "").strip()
        if not raw_token:
            raise serializers.ValidationError(
                {"id_token": "Google credential is required."}
            )

        try:
            idinfo = google_id_token.verify_oauth2_token(
                raw_token,
                google_requests.Request(),
                audience=client_id,
                clock_skew_in_seconds=60,
            )
        except ValueError as exc:
            # Surface the underlying reason (audience mismatch, expiry, certs, etc.)
            raise serializers.ValidationError(
                {"id_token": f"Invalid Google credential: {exc}"}
            ) from exc

        # GIS tokens must come from Google accounts
        issuer = idinfo.get("iss")
        if issuer not in ("accounts.google.com", "https://accounts.google.com"):
            raise serializers.ValidationError(
                {"id_token": "Invalid Google credential issuer."}
            )

        email = (idinfo.get("email") or "").strip().lower()
        if not email or not idinfo.get("email_verified", False):
            raise serializers.ValidationError(
                {"id_token": "Google account email is missing or unverified."}
            )

        full_name = (
            (idinfo.get("name") or "").strip()
            or (idinfo.get("given_name") or "").strip()
            or email.split("@")[0]
        )

        attrs["email"] = User.objects.normalize_email(email).strip().lower()
        attrs["full_name"] = full_name
        attrs["google_sub"] = idinfo.get("sub", "")
        return attrs

    def save(self, **kwargs):
        intent = self.validated_data["intent"]
        email = self.validated_data["email"]
        full_name = self.validated_data["full_name"]

        user = User.objects.filter(email__iexact=email).first()

        if intent == "register":
            if user is not None:
                raise serializers.ValidationError(
                    "An account with this email already exists. Please login instead."
                )
            from .models import RegistrationMethod

            user = User.objects.create_user(
                email=email,
                full_name=full_name,
                password=None,
                role=UserRole.CLIENT,
                registration_method=RegistrationMethod.SELF,
                is_staff=False,
                is_superuser=False,
            )
            return user

        # intent == login — any existing LexCore role may sign in
        if user is None:
            raise serializers.ValidationError(
                "No LexCore account found for this Google email. "
                "Clients can register first; staff accounts are provisioned by an administrator."
            )
        if not user.is_active:
            raise serializers.ValidationError("This account is inactive.")
        return user
