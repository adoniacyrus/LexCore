"""
Authentication serializers for LexCore JWT auth.

All request validation lives here; views stay thin.
"""

from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import User, UserRole


class RegisterSerializer(serializers.Serializer):
    """
    Client self-registration only.

    Role is never accepted from the client — always forced to CLIENT.
    """

    full_name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    phone_number = serializers.CharField(
        max_length=20,
        required=False,
        allow_blank=True,
        default="",
    )
    password = serializers.CharField(write_only=True, style={"input_type": "password"})
    confirm_password = serializers.CharField(
        write_only=True,
        style={"input_type": "password"},
    )

    def validate_email(self, value: str) -> str:
        email = User.objects.normalize_email(value).strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return email

    def validate_full_name(self, value: str) -> str:
        name = value.strip()
        if not name:
            raise serializers.ValidationError("Full name is required.")
        return name

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": "Passwords do not match."}
            )

        # Run Django's AUTH_PASSWORD_VALIDATORS against a unsaved user instance
        # so similarity checks can use email / full_name.
        provisional = User(
            email=attrs["email"],
            full_name=attrs["full_name"],
        )
        try:
            validate_password(attrs["password"], user=provisional)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)}) from exc

        return attrs

    def create(self, validated_data):
        validated_data.pop("confirm_password")
        phone = (validated_data.get("phone_number") or "").strip()

        return User.objects.create_user(
            email=validated_data["email"],
            full_name=validated_data["full_name"],
            phone_number=phone,
            password=validated_data["password"],
            role=UserRole.CLIENT,
            is_staff=False,
            is_superuser=False,
        )


class LoginSerializer(serializers.Serializer):
    """Authenticate with email + password; attach the User for token issuance."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate_email(self, value: str) -> str:
        return User.objects.normalize_email(value).strip().lower()

    def validate(self, attrs):
        email = attrs["email"]
        password = attrs["password"]

        # ModelBackend uses USERNAME_FIELD ("email"); pass it as username=.
        user = authenticate(
            request=self.context.get("request"),
            username=email,
            password=password,
        )

        if user is None:
            raise serializers.ValidationError("Invalid email or password.")

        if not user.is_active:
            raise serializers.ValidationError("This account is inactive.")

        attrs["user"] = user
        return attrs


class UserSerializer(serializers.ModelSerializer):
    """Public profile payload returned by login and /me/."""

    class Meta:
        model = User
        fields = ("id", "full_name", "email", "role", "phone_number")
        read_only_fields = fields


class LoginUserSerializer(serializers.ModelSerializer):
    """User object embedded in the login response (exact contract)."""

    class Meta:
        model = User
        fields = ("id", "full_name", "email", "role")
        read_only_fields = fields


class LogoutSerializer(serializers.Serializer):
    """Refresh token required so SimpleJWT can blacklist it."""

    refresh = serializers.CharField()
