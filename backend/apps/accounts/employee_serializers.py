"""
Employee (internal staff) management serializers.

Clients are excluded — only ADMIN / lawyer / paralegal roles are managed here.
"""

import secrets
import string

from rest_framework import serializers

from apps.consultations.models import PracticeArea

from .models import User, UserRole

EMPLOYEE_ROLES = (
    UserRole.ADMIN,
    UserRole.SENIOR_LAWYER,
    UserRole.JUNIOR_LAWYER,
    UserRole.PARALEGAL,
)

LAWYER_ROLES = (UserRole.SENIOR_LAWYER, UserRole.JUNIOR_LAWYER)


def generate_temporary_password(length: int = 12) -> str:
    """
    Generate a secure temporary password.

    Guarantees at least one upper, lower, digit, and symbol so it satisfies
    LexCore's client-side password policy on first change.
    """
    alphabet = string.ascii_letters + string.digits + "!@#$%&*"
    while True:
        password = "".join(secrets.choice(alphabet) for _ in range(length))
        if (
            any(c.islower() for c in password)
            and any(c.isupper() for c in password)
            and any(c.isdigit() for c in password)
            and any(c in "!@#$%&*" for c in password)
        ):
            return password


class PracticeAreaBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = PracticeArea
        fields = ("id", "name")
        read_only_fields = fields


def _validate_practice_area_ids(role, practice_area_ids):
    if practice_area_ids is None:
        return None
    if role not in LAWYER_ROLES:
        return []
    ids = list(practice_area_ids)
    if not ids:
        return []
    found = list(PracticeArea.objects.filter(id__in=ids, is_active=True))
    if len(found) != len(set(ids)):
        raise serializers.ValidationError(
            "One or more practice areas are invalid or inactive."
        )
    return found


class EmployeeSerializer(serializers.ModelSerializer):
    """Read serializer for the employee directory."""

    practice_areas = PracticeAreaBriefSerializer(many=True, read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "full_name",
            "email",
            "phone_number",
            "role",
            "is_active",
            "created_at",
            "practice_areas",
        )
        read_only_fields = fields


class EmployeeCreateSerializer(serializers.Serializer):
    """Create an internal employee (no password accepted from the client)."""

    full_name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    phone_number = serializers.CharField(
        max_length=20,
        required=False,
        allow_blank=True,
        default="",
    )
    role = serializers.ChoiceField(choices=[(r.value, r.label) for r in EMPLOYEE_ROLES])
    practice_area_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
    )

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

    def validate_role(self, value: str) -> str:
        if value == UserRole.CLIENT:
            raise serializers.ValidationError(
                "Clients cannot be created from employee management."
            )
        if value not in EMPLOYEE_ROLES:
            raise serializers.ValidationError("Invalid employee role.")
        return value

    def validate(self, attrs):
        areas = _validate_practice_area_ids(
            attrs.get("role"),
            attrs.get("practice_area_ids"),
        )
        attrs["practice_areas"] = areas
        return attrs

    def create(self, validated_data):
        temporary_password = generate_temporary_password()
        role = validated_data["role"]
        phone = (validated_data.get("phone_number") or "").strip()
        practice_areas = validated_data.pop("practice_areas", None)
        validated_data.pop("practice_area_ids", None)

        user = User.objects.create_user(
            email=validated_data["email"],
            full_name=validated_data["full_name"],
            phone_number=phone,
            password=temporary_password,
            role=role,
            is_staff=True,
            is_superuser=(role == UserRole.ADMIN),
            is_active=True,
        )
        if practice_areas is not None:
            user.practice_areas.set(practice_areas)
        # Attach plaintext temp password for the view to email (never persisted).
        user._temporary_password = temporary_password  # noqa: SLF001
        return user


class EmployeeUpdateSerializer(serializers.Serializer):
    """Update an internal employee profile (no password from client)."""

    full_name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    phone_number = serializers.CharField(
        max_length=20,
        required=False,
        allow_blank=True,
        default="",
    )
    role = serializers.ChoiceField(choices=[(r.value, r.label) for r in EMPLOYEE_ROLES])
    practice_area_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
    )

    def validate_full_name(self, value: str) -> str:
        name = value.strip()
        if not name:
            raise serializers.ValidationError("Full name is required.")
        return name

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

    def validate_role(self, value: str) -> str:
        if value == UserRole.CLIENT or value not in EMPLOYEE_ROLES:
            raise serializers.ValidationError("Invalid employee role.")
        return value

    def validate(self, attrs):
        if "practice_area_ids" in self.initial_data:
            areas = _validate_practice_area_ids(
                attrs.get("role"),
                attrs.get("practice_area_ids"),
            )
            attrs["practice_areas"] = areas
        return attrs

    def update(self, instance, validated_data):
        role = validated_data["role"]
        instance.full_name = validated_data["full_name"]
        instance.email = validated_data["email"]
        instance.phone_number = (validated_data.get("phone_number") or "").strip()
        instance.role = role
        instance.is_staff = True
        instance.is_superuser = role == UserRole.ADMIN
        instance.save(
            update_fields=[
                "full_name",
                "email",
                "phone_number",
                "role",
                "is_staff",
                "is_superuser",
            ]
        )
        if "practice_areas" in validated_data:
            instance.practice_areas.set(validated_data["practice_areas"] or [])
        elif role not in LAWYER_ROLES:
            instance.practice_areas.clear()
        return instance

