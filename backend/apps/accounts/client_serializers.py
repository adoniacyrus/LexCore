"""
Admin Client Management serializers.

Creates the same CLIENT User accounts as public registration — only the
actor and registration_method differ (ADMIN vs SELF).
"""

from rest_framework import serializers

from .employee_serializers import generate_temporary_password
from .models import RegistrationMethod, User, UserRole


class ClientSerializer(serializers.ModelSerializer):
    """Read serializer for the client directory and detail view."""

    client_id = serializers.SerializerMethodField()
    registration_method_label = serializers.CharField(
        source="get_registration_method_display",
        read_only=True,
    )
    role_label = serializers.CharField(source="get_role_display", read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "client_id",
            "full_name",
            "email",
            "phone_number",
            "role",
            "role_label",
            "is_active",
            "registration_method",
            "registration_method_label",
            "created_at",
            "last_login",
        )
        read_only_fields = fields

    def get_client_id(self, obj):
        return f"CL-{obj.id:04d}"


class ClientCreateSerializer(serializers.Serializer):
    """
    Admin-provisioned CLIENT account.

    Same user type as public registration; password is generated server-side.
    """

    full_name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    phone_number = serializers.CharField(max_length=20)

    def validate_email(self, value: str) -> str:
        email = User.objects.normalize_email(value).strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError(
                "An account with this email already exists."
            )
        return email

    def validate_full_name(self, value: str) -> str:
        name = value.strip()
        if not name:
            raise serializers.ValidationError("Full name is required.")
        return name

    def validate_phone_number(self, value: str) -> str:
        phone = (value or "").strip()
        digits = "".join(c for c in phone if c.isdigit())
        if len(digits) < 10:
            raise serializers.ValidationError(
                "Enter a valid mobile number (at least 10 digits)."
            )
        return phone

    def create(self, validated_data):
        temporary_password = generate_temporary_password()
        user = User.objects.create_user(
            email=validated_data["email"],
            full_name=validated_data["full_name"],
            phone_number=validated_data["phone_number"],
            password=temporary_password,
            role=UserRole.CLIENT,
            registration_method=RegistrationMethod.ADMIN,
            is_staff=False,
            is_superuser=False,
            is_active=True,
        )
        user._temporary_password = temporary_password  # noqa: SLF001
        return user


class ClientUpdateSerializer(serializers.Serializer):
    """Admin edit of CLIENT profile fields (role / registration method unchanged)."""

    full_name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    phone_number = serializers.CharField(max_length=20)

    def validate_email(self, value: str) -> str:
        email = User.objects.normalize_email(value).strip().lower()
        qs = User.objects.filter(email__iexact=email)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                "An account with this email already exists."
            )
        return email

    def validate_full_name(self, value: str) -> str:
        name = value.strip()
        if not name:
            raise serializers.ValidationError("Full name is required.")
        return name

    def validate_phone_number(self, value: str) -> str:
        phone = (value or "").strip()
        digits = "".join(c for c in phone if c.isdigit())
        if len(digits) < 10:
            raise serializers.ValidationError(
                "Enter a valid mobile number (at least 10 digits)."
            )
        return phone

    def update(self, instance, validated_data):
        instance.full_name = validated_data["full_name"]
        instance.email = validated_data["email"]
        instance.phone_number = validated_data["phone_number"]
        instance.save(update_fields=["full_name", "email", "phone_number", "updated_at"])
        return instance
