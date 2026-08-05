"""
Admin Client Management API views.

ADMIN-only directory of CLIENT role accounts (separate from employees).
"""

import logging

from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .client_serializers import (
    ClientCreateSerializer,
    ClientSerializer,
    ClientUpdateSerializer,
)
from .emails import send_client_welcome_email, send_forced_password_reset_email
from .employee_serializers import generate_temporary_password
from .models import User, UserRole
from .permissions import IsAdminRole

logger = logging.getLogger(__name__)


def _client_queryset():
    return User.objects.filter(role=UserRole.CLIENT)


def _get_client(pk):
    return get_object_or_404(_client_queryset(), pk=pk)


class ClientListCreateView(APIView):
    """
    GET  /api/clients/ — list clients (search + filters)
    POST /api/clients/ — create client + welcome email
    """

    permission_classes = [IsAdminRole]

    def get(self, request):
        qs = _client_queryset().order_by("-created_at")

        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(full_name__icontains=q)
                | Q(email__icontains=q)
                | Q(phone_number__icontains=q)
            )

        status_filter = (request.query_params.get("status") or "").strip().lower()
        if status_filter == "active":
            qs = qs.filter(is_active=True)
        elif status_filter == "inactive":
            qs = qs.filter(is_active=False)

        method = (request.query_params.get("registration_method") or "").strip().upper()
        if method in ("SELF", "ADMIN"):
            qs = qs.filter(registration_method=method)

        return Response(
            ClientSerializer(qs, many=True).data,
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        serializer = ClientCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        temporary_password = user._temporary_password  # noqa: SLF001

        email_sent = True
        try:
            send_client_welcome_email(
                user=user,
                temporary_password=temporary_password,
            )
        except Exception:
            logger.exception("Failed to send client welcome email to %s", user.email)
            email_sent = False

        payload = ClientSerializer(user).data
        payload["email_sent"] = email_sent
        payload["message"] = (
            "Client created successfully. A welcome email with a temporary password has been sent."
            if email_sent
            else (
                "Client created successfully, but the welcome email could not be sent. "
                "Ask the client to use Forgot Password if needed."
            )
        )
        return Response(payload, status=status.HTTP_201_CREATED)


class ClientDetailView(APIView):
    """
    GET    /api/clients/<id>/
    PATCH  /api/clients/<id>/  — edit profile fields
    DELETE /api/clients/<id>/  — permanently remove client
    """

    permission_classes = [IsAdminRole]

    def get(self, request, pk):
        client = _get_client(pk)
        return Response(ClientSerializer(client).data, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        client = _get_client(pk)
        serializer = ClientUpdateSerializer(
            instance=client,
            data=request.data,
            partial=False,
        )
        serializer.is_valid(raise_exception=True)
        client = serializer.save()
        return Response(
            {
                **ClientSerializer(client).data,
                "message": "Client updated successfully.",
            },
            status=status.HTTP_200_OK,
        )

    def delete(self, request, pk):
        client = _get_client(pk)
        client.delete()
        return Response(
            {"message": "Client deleted successfully."},
            status=status.HTTP_200_OK,
        )


class ClientSetActiveView(APIView):
    """
    POST /api/clients/<id>/set-active/
    Body: { "is_active": true|false }
    """

    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        client = _get_client(pk)
        is_active = request.data.get("is_active")
        if not isinstance(is_active, bool):
            return Response(
                {"is_active": "This field must be a boolean."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        client.is_active = is_active
        client.save(update_fields=["is_active", "updated_at"])

        label = "activated" if is_active else "deactivated"
        return Response(
            {
                **ClientSerializer(client).data,
                "message": f"Client {label} successfully.",
            },
            status=status.HTTP_200_OK,
        )


class ClientForceResetPasswordView(APIView):
    """
    POST /api/clients/<id>/force-reset-password/

    Generates a temporary password, hashes it, and emails the client.
    """

    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        client = _get_client(pk)
        temporary_password = generate_temporary_password()
        client.set_password(temporary_password)
        client.save(update_fields=["password"])

        email_sent = True
        try:
            send_forced_password_reset_email(
                user=client,
                temporary_password=temporary_password,
            )
        except Exception:
            logger.exception(
                "Failed to send forced password reset email to %s", client.email
            )
            email_sent = False

        return Response(
            {
                **ClientSerializer(client).data,
                "email_sent": email_sent,
                "message": (
                    "Password reset. A temporary password has been emailed to the client."
                    if email_sent
                    else "Password was reset, but the email could not be sent."
                ),
            },
            status=status.HTTP_200_OK,
        )
