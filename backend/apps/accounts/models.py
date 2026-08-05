"""
LexCore accounts — production custom User model.

Email is the unique login identifier (no username field).
Roles map to chambers access levels used across the LexCore portal.
"""

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import models
from django.utils import timezone


# ---------------------------------------------------------------------------
# Role choices
# ---------------------------------------------------------------------------


class UserRole(models.TextChoices):
    """
    Chambers access roles.

    Only CLIENT accounts are expected to self-register later.
    Staff roles (ADMIN … PARALEGAL) are provisioned by an Administrator.
    """

    ADMIN = "ADMIN", "Firm Administrator"
    SENIOR_LAWYER = "SENIOR_LAWYER", "Senior Advocate"
    JUNIOR_LAWYER = "JUNIOR_LAWYER", "Junior Advocate"
    PARALEGAL = "PARALEGAL", "Paralegal"
    CLIENT = "CLIENT", "Client"


# ---------------------------------------------------------------------------
# Manager
# ---------------------------------------------------------------------------


class CustomUserManager(BaseUserManager):
    """
    Manager for the email-based User model.

    BaseUserManager is required because AbstractBaseUser does not ship a
    manager. It provides normalize_email() and is what `createsuperuser`
    and Django's auth helpers expect on AUTH_USER_MODEL.objects.
    """

    use_in_migrations = True

    def _validate_email(self, email: str) -> str:
        """Normalize and reject empty / invalid emails before persistence."""
        if not email:
            raise ValueError("Users must have an email address.")

        # normalize_email lowercases the domain; we also lowercase the local
        # part so uniqueness checks are consistent regardless of input case.
        email = self.normalize_email(email).strip().lower()

        try:
            validate_email(email)
        except ValidationError as exc:
            raise ValueError(exc.messages[0]) from exc

        return email

    def create_user(self, email, full_name, password=None, **extra_fields):
        """
        Create and save a regular user.

        Uses set_password() so passwords are hashed with Django's configured
        password hashers (never store plaintext). password=None yields an
        unusable password (invite / set-password-later flows).
        """
        email = self._validate_email(email)

        if not full_name or not str(full_name).strip():
            raise ValueError("Users must have a full name.")

        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        extra_fields.setdefault("role", UserRole.CLIENT)

        user = self.model(
            email=email,
            full_name=str(full_name).strip(),
            **extra_fields,
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, full_name, password=None, **extra_fields):
        """
        Create a Django superuser with full admin privileges.

        is_staff + is_superuser are mandatory for Django Admin access.
        Role defaults to ADMIN for LexCore domain semantics.
        """
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", UserRole.ADMIN)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(
            email=email,
            full_name=full_name,
            password=password,
            **extra_fields,
        )


# ---------------------------------------------------------------------------
# User model
# ---------------------------------------------------------------------------


class User(AbstractBaseUser, PermissionsMixin):
    """
    LexCore user account.

    AbstractBaseUser  — password hashing API, last_login, is_authenticated /
                        is_anonymous, and the USERNAME_FIELD contract.
    PermissionsMixin  — is_superuser, groups, and user_permissions so Admin
                        and permission checks work without a username model.
    """

    email = models.EmailField(
        "email address",
        unique=True,
        db_index=True,
        help_text="Primary login identifier.",
    )
    full_name = models.CharField(
        "full name",
        max_length=255,
        help_text="Display name used across the chambers portal.",
    )
    phone_number = models.CharField(
        "phone number",
        max_length=20,
        blank=True,
        default="",
        help_text="Optional contact number (e.g. +91 …).",
    )
    role = models.CharField(
        "role",
        max_length=32,
        choices=UserRole.choices,
        default=UserRole.CLIENT,
        db_index=True,
        help_text="Chambers access role.",
    )
    practice_areas = models.ManyToManyField(
        "consultations.PracticeArea",
        blank=True,
        related_name="lawyers",
        help_text="Practice areas this lawyer specializes in.",
    )

    # Flags used by Django Admin / ModelBackend permission checks
    is_active = models.BooleanField(
        default=True,
        help_text="Inactive users cannot authenticate.",
    )
    is_staff = models.BooleanField(
        default=False,
        help_text="Designates whether the user can access the Django admin site.",
    )
    # is_superuser, groups, user_permissions → PermissionsMixin

    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    objects = CustomUserManager()

    EMAIL_FIELD = "email"
    USERNAME_FIELD = "email"  # authenticate() / createsuperuser use email
    REQUIRED_FIELDS = ["full_name"]  # extra prompts for createsuperuser

    class Meta:
        verbose_name = "user"
        verbose_name_plural = "users"
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.full_name} <{self.email}>"

    def clean(self):
        """Normalize email on model validation (forms / admin)."""
        super().clean()
        if self.email:
            self.email = (
                self.__class__.objects.normalize_email(self.email).strip().lower()
            )

    def get_full_name(self) -> str:
        """Django Admin / auth convention for the user's display name."""
        return self.full_name

    def get_short_name(self) -> str:
        """Short display name for admin headers and greetings."""
        return self.full_name.split()[0] if self.full_name else self.email
