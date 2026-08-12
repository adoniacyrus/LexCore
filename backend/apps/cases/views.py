from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User, UserRole
from apps.consultations.permissions import IsLawyerRole
from .models import Case
from .permissions import IsCaseParticipant
from .serializers import CaseConvertSerializer, CaseSerializer, UserBriefSerializer


class CaseConvertView(APIView):
    """
    POST /api/cases/convert/
    Converts an eligible consultation into a LexCore Case.
    Only accessible by the assigned SENIOR_LAWYER or JUNIOR_LAWYER.
    """

    permission_classes = [IsLawyerRole]

    def post(self, request):
        serializer = CaseConvertSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        case = serializer.save()

        # Prefetch and serialize the full created case
        full_case = Case.objects.select_related(
            "client",
            "practice_area",
            "responsible_lawyer",
            "supporting_paralegal",
            "originating_consultation",
        ).get(pk=case.pk)

        response_data = CaseSerializer(full_case).data
        response_data["message"] = "Case created successfully."

        return Response(response_data, status=status.HTTP_201_CREATED)


class CaseListView(APIView):
    """
    GET /api/cases/
    Lists cases filtered by the authenticated user's role:
    - ADMIN: returns all cases
    - LAWYER: returns cases where they are the responsible lawyer
    - PARALEGAL: returns cases where they are the supporting paralegal
    - CLIENT: returns cases where they are the client
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        queryset = Case.objects.select_related(
            "client",
            "practice_area",
            "responsible_lawyer",
            "supporting_paralegal",
            "originating_consultation",
        )

        if user.role == UserRole.ADMIN:
            # Admins see all cases
            pass
        elif user.role in (UserRole.SENIOR_LAWYER, UserRole.JUNIOR_LAWYER):
            queryset = queryset.filter(responsible_lawyer=user)
        elif user.role == UserRole.PARALEGAL:
            queryset = queryset.filter(supporting_paralegal=user)
        elif user.role == UserRole.CLIENT:
            queryset = queryset.filter(client=user)
        else:
            queryset = queryset.none()

        queryset = queryset.order_by("-created_at")
        serializer = CaseSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class CaseDetailView(APIView):
    """
    GET /api/cases/<pk>/
    PATCH /api/cases/<pk>/
    Retrieves or updates authorized details of a single case.
    Permissions check ensures the user is a participant of the case or an Admin.
    """

    permission_classes = [IsCaseParticipant]

    def get(self, request, pk):
        queryset = Case.objects.select_related(
            "client",
            "practice_area",
            "responsible_lawyer",
            "supporting_paralegal",
            "originating_consultation",
        )
        case_obj = get_object_or_404(queryset, pk=pk)
        self.check_object_permissions(request, case_obj)

        serializer = CaseSerializer(case_obj)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        queryset = Case.objects.select_related(
            "client",
            "practice_area",
            "responsible_lawyer",
            "supporting_paralegal",
            "originating_consultation",
        )
        case_obj = get_object_or_404(queryset, pk=pk)
        self.check_object_permissions(request, case_obj)

        user = request.user
        is_responsible_lawyer = (
            user.role in (UserRole.SENIOR_LAWYER, UserRole.JUNIOR_LAWYER)
            and case_obj.responsible_lawyer == user
        )
        is_admin = (user.role == UserRole.ADMIN)

        # Enforce case editing boundary:
        # - Responsible lawyer can edit anything (except read-only fields handled by serializer)
        # - Admin can ONLY edit administrative fields (supporting_paralegal, status)
        # - Clients and unassigned paralegals/lawyers are blocked (return 403)
        if not (is_responsible_lawyer or is_admin):
            return Response(
                {"detail": "You do not have permission to edit this case."},
                status=status.HTTP_403_FORBIDDEN
            )

        data = request.data.copy()
        if is_admin and not is_responsible_lawyer:
            # Admins are restricted to supporting_paralegal and status updates
            allowed_admin_fields = {"supporting_paralegal", "status"}
            for key in list(data.keys()):
                if key not in allowed_admin_fields:
                    data.pop(key)
            if not data:
                return Response(
                    {"detail": "Admins are only permitted to update administrative fields (supporting paralegal and status)."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        serializer = CaseSerializer(case_obj, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # Re-fetch with select_related for nested representation
        updated_case = Case.objects.select_related(
            "client",
            "practice_area",
            "responsible_lawyer",
            "supporting_paralegal",
            "originating_consultation",
        ).get(pk=case_obj.pk)

        return Response(CaseSerializer(updated_case).data, status=status.HTTP_200_OK)


class ActiveParalegalsListView(APIView):
    """
    GET /api/cases/active-paralegals/
    Lists all active paralegals to populate selection dropdowns during case conversion.
    Only accessible by lawyers.
    """

    permission_classes = [IsLawyerRole]

    def get(self, request):
        paralegals = User.objects.filter(
            role=UserRole.PARALEGAL,
            is_active=True,
        ).order_by("full_name")
        serializer = UserBriefSerializer(paralegals, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
