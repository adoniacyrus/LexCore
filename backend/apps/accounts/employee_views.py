"""
Employee management API views.

ADMIN-only directory of internal staff (excludes CLIENT accounts).
"""

import logging

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .emails import (
    send_employee_welcome_email,
    send_forced_password_reset_email,
)
from .employee_serializers import (
    EmployeeCreateSerializer,
    EmployeeSerializer,
    EmployeeUpdateSerializer,
    generate_temporary_password,
)
from .models import User, UserRole
from .permissions import IsAdminRole

logger = logging.getLogger(__name__)


def _employee_queryset():
    return User.objects.exclude(role=UserRole.CLIENT)


def _get_employee(pk):
    return get_object_or_404(_employee_queryset(), pk=pk)


def _active_admin_count():
    return User.objects.filter(
        role=UserRole.ADMIN,
        is_active=True,
    ).count()


class EmployeeListCreateView(APIView):
    """
    GET  /api/users/ — list internal employees
    POST /api/users/ — create internal employee + welcome email
    """

    permission_classes = [IsAdminRole]

    def get(self, request):
        queryset = _employee_queryset().order_by("-created_at")
        return Response(
            EmployeeSerializer(queryset, many=True).data,
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        serializer = EmployeeCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        temporary_password = user._temporary_password  # noqa: SLF001

        email_sent = True
        try:
            send_employee_welcome_email(
                user=user,
                temporary_password=temporary_password,
            )
        except Exception:
            logger.exception("Failed to send employee welcome email to %s", user.email)
            email_sent = False

        payload = EmployeeSerializer(user).data
        payload["email_sent"] = email_sent
        payload["message"] = (
            "Employee created successfully. A welcome email with a temporary password has been sent."
            if email_sent
            else "Employee created successfully, but the welcome email could not be sent."
        )
        return Response(payload, status=status.HTTP_201_CREATED)


class EmployeeDetailView(APIView):
    """
    GET    /api/users/<id>/
    PATCH  /api/users/<id>/  — edit profile fields
    DELETE /api/users/<id>/  — permanently remove employee
    """

    permission_classes = [IsAdminRole]

    def get(self, request, pk):
        user = _get_employee(pk)
        return Response(EmployeeSerializer(user).data, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        user = _get_employee(pk)
        serializer = EmployeeUpdateSerializer(
            instance=user,
            data=request.data,
            partial=False,
        )
        serializer.is_valid(raise_exception=True)

        # Prevent demoting / re-roling away the last active admin.
        next_role = serializer.validated_data["role"]
        if (
            user.role == UserRole.ADMIN
            and user.is_active
            and next_role != UserRole.ADMIN
            and _active_admin_count() <= 1
        ):
            return Response(
                {"detail": "Cannot change the role of the last active administrator."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = serializer.save()
        return Response(
            {
                **EmployeeSerializer(user).data,
                "message": "Employee updated successfully.",
            },
            status=status.HTTP_200_OK,
        )

    def delete(self, request, pk):
        user = _get_employee(pk)

        if user.pk == request.user.pk:
            return Response(
                {"detail": "You cannot delete your own account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if (
            user.role == UserRole.ADMIN
            and user.is_active
            and _active_admin_count() <= 1
        ):
            return Response(
                {"detail": "Cannot delete the last active administrator."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.delete()
        return Response(
            {"message": "Employee deleted successfully."},
            status=status.HTTP_200_OK,
        )


class EmployeeSetActiveView(APIView):
    """
    POST /api/users/<id>/set-active/
    Body: { "is_active": true|false }
    """

    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        user = _get_employee(pk)
        is_active = request.data.get("is_active")
        if not isinstance(is_active, bool):
            return Response(
                {"is_active": "This field must be a boolean."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if user.pk == request.user.pk and is_active is False:
            return Response(
                {"detail": "You cannot deactivate your own account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if (
            user.role == UserRole.ADMIN
            and user.is_active
            and is_active is False
            and _active_admin_count() <= 1
        ):
            return Response(
                {"detail": "Cannot deactivate the last active administrator."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.is_active = is_active
        user.save(update_fields=["is_active"])

        label = "activated" if is_active else "deactivated"
        return Response(
            {
                **EmployeeSerializer(user).data,
                "message": f"Employee {label} successfully.",
            },
            status=status.HTTP_200_OK,
        )


class EmployeeForceResetPasswordView(APIView):
    """
    POST /api/users/<id>/force-reset-password/

    Generates a temporary password, hashes it, and emails the employee.
    """

    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        user = _get_employee(pk)
        temporary_password = generate_temporary_password()
        user.set_password(temporary_password)
        user.save(update_fields=["password"])

        email_sent = True
        try:
            send_forced_password_reset_email(
                user=user,
                temporary_password=temporary_password,
            )
        except Exception:
            logger.exception(
                "Failed to send forced password reset email to %s", user.email
            )
            email_sent = False

        return Response(
            {
                **EmployeeSerializer(user).data,
                "email_sent": email_sent,
                "message": (
                    "Password reset. A temporary password has been emailed to the employee."
                    if email_sent
                    else "Password was reset, but the email could not be sent."
                ),
            },
            status=status.HTTP_200_OK,
        )
