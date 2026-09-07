from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User, UserRole
from apps.consultations.permissions import IsLawyerRole
from .models import Case
from .permissions import IsCaseParticipant
from .serializers import (
    CaseConvertSerializer,
    CaseSerializer,
    UserBriefSerializer,
    LawyerBriefSerializer,
    CaseTeamUpdateSerializer,
)


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
        ).prefetch_related("assistant_lawyers")

        if user.role == UserRole.ADMIN:
            # Admins see all cases
            pass
        elif user.role in (UserRole.SENIOR_LAWYER, UserRole.JUNIOR_LAWYER):
            from django.db.models import Q
            queryset = queryset.filter(Q(responsible_lawyer=user) | Q(supervising_lawyer=user) | Q(assistant_lawyers=user)).distinct()
        elif user.role == UserRole.PARALEGAL:
            queryset = queryset.filter(supporting_paralegal=user)
        elif user.role == UserRole.CLIENT:
            queryset = queryset.filter(client=user)
        else:
            queryset = queryset.none()

        matter_category = request.query_params.get("matter_category")
        matter_stage = request.query_params.get("matter_stage")
        if matter_category:
            queryset = queryset.filter(matter_category=matter_category)
        if matter_stage:
            queryset = queryset.filter(matter_stage=matter_stage)

        queryset = queryset.order_by("-created_at")
        serializer = CaseSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


def _get_case_or_404(queryset, pk_or_ref):
    """Lookup a Case by numeric PK or case_reference (e.g. CASE-2026-0001)."""
    if str(pk_or_ref).isdigit():
        return get_object_or_404(queryset, pk=int(pk_or_ref))
    return get_object_or_404(queryset, case_reference=pk_or_ref)


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
        ).prefetch_related("assistant_lawyers")
        case_obj = _get_case_or_404(queryset, pk)
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
        ).prefetch_related("assistant_lawyers")
        case_obj = _get_case_or_404(queryset, pk)
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
            # Admins are restricted to supporting_paralegal, status, matter_category, and matter_stage updates
            allowed_admin_fields = {"supporting_paralegal", "status", "matter_category", "matter_stage"}
            for key in list(data.keys()):
                if key not in allowed_admin_fields:
                    data.pop(key)
            if not data:
                return Response(
                    {"detail": "Admins are only permitted to update administrative fields (supporting paralegal, status, matter category and matter stage)."},
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
        ).prefetch_related("assistant_lawyers").get(pk=case_obj.pk)

        return Response(CaseSerializer(updated_case).data, status=status.HTTP_200_OK)


class ActiveParalegalsListView(APIView):
    """
    GET /api/cases/active-paralegals/
    Lists all active paralegals to populate selection dropdowns during case conversion and team management.
    Accessible by Admin, Senior Lawyer, and Junior Lawyer.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role not in (UserRole.ADMIN, UserRole.SENIOR_LAWYER, UserRole.JUNIOR_LAWYER):
            return Response(
                {"detail": "You do not have permission to perform this action."},
                status=status.HTTP_403_FORBIDDEN,
            )
        paralegals = User.objects.filter(
            role=UserRole.PARALEGAL,
            is_active=True,
        ).order_by("full_name")
        serializer = UserBriefSerializer(paralegals, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ActiveLawyersListView(APIView):
    """
    GET /api/cases/active-lawyers/
    Returns a list of all active senior and junior advocates to populate dropdown selectors.
    Only accessible by ADMIN.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role not in (UserRole.ADMIN, UserRole.SENIOR_LAWYER, UserRole.JUNIOR_LAWYER):
            return Response(
                {"detail": "You do not have permission to perform this action."},
                status=status.HTTP_403_FORBIDDEN,
            )
        lawyers = User.objects.filter(
            role__in=(UserRole.SENIOR_LAWYER, UserRole.JUNIOR_LAWYER),
            is_active=True,
        ).prefetch_related("practice_areas").order_by("full_name")
        serializer = LawyerBriefSerializer(lawyers, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class CaseTeamUpdateView(APIView):
    """
    PATCH /api/cases/<id>/team/
    Allows:
    - Admin: full litigation team updates (responsible lawyer and supporting paralegal).
    - Responsible Lawyer: supporting paralegal management only (responsible lawyer cannot be updated).
    All other roles receive 403 Forbidden.
    """

    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        case_obj = _get_case_or_404(Case, pk)
        user = request.user

        is_admin = user.role == UserRole.ADMIN
        is_responsible_lawyer = (
            user.role in (UserRole.SENIOR_LAWYER, UserRole.JUNIOR_LAWYER)
            and case_obj.responsible_lawyer == user
        )

        if not (is_admin or is_responsible_lawyer):
            return Response(
                {"detail": "You do not have permission to manage the team for this case."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if is_admin:
            # Admin can edit all fields
            serializer = CaseTeamUpdateSerializer(
                case_obj, data=request.data, partial=True, context={"request": request}
            )
        else:
            if "responsible_lawyer" in request.data:
                try:
                    if int(request.data["responsible_lawyer"]) != case_obj.responsible_lawyer.id:
                        return Response(
                            {"responsible_lawyer": "Only administrators can reassign the responsible lawyer."},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                except (ValueError, TypeError):
                    pass
            # Responsible Lawyer can update supporting_paralegal and assistant_lawyers
            data = request.data.copy()
            data.pop("responsible_lawyer", None)
            serializer = CaseTeamUpdateSerializer(
                case_obj, data=data, partial=True, context={"request": request}
            )

        serializer.is_valid(raise_exception=True)
        updated_case = serializer.save()

        # Refetch with select_related for nested representation
        full_case = Case.objects.select_related(
            "client",
            "practice_area",
            "responsible_lawyer",
            "supporting_paralegal",
            "originating_consultation",
        ).prefetch_related("assistant_lawyers").get(pk=updated_case.pk)

        return Response(CaseSerializer(full_case).data, status=status.HTTP_200_OK)


class CaseMatterBoardView(APIView):
    """
    GET /api/cases/matter-board/
    Returns matter summary counts and category-wise aggregated totals.
    Respects user's role-based permissions:
    - ADMIN: all matters
    - LAWYER: responsible or assistant matters
    - PARALEGAL: supporting matters
    - CLIENT: client matters
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Count, Q
        from apps.cases.models import MatterCategory

        user = request.user
        queryset = Case.objects.all()

        if user.role == UserRole.ADMIN:
            pass
        elif user.role in (UserRole.SENIOR_LAWYER, UserRole.JUNIOR_LAWYER):
            queryset = queryset.filter(Q(responsible_lawyer=user) | Q(supervising_lawyer=user) | Q(assistant_lawyers=user)).distinct()
        elif user.role == UserRole.PARALEGAL:
            queryset = queryset.filter(supporting_paralegal=user)
        elif user.role == UserRole.CLIENT:
            queryset = queryset.filter(client=user)
        else:
            queryset = queryset.none()

        # Summary calculations
        # Open matters: status in (OPEN, IN_PROGRESS, ON_HOLD)
        # Closed matters: status == CLOSED
        # Archived matters: status == ARCHIVED
        summary = queryset.aggregate(
            total=Count("id"),
            open_count=Count("id", filter=Q(status__in=["OPEN", "IN_PROGRESS", "ON_HOLD"])),
            closed_count=Count("id", filter=Q(status="CLOSED")),
            archived_count=Count("id", filter=Q(status="ARCHIVED"))
        )

        summary_data = {
            "total": summary["total"] or 0,
            "open": summary["open_count"] or 0,
            "closed": summary["closed_count"] or 0,
            "archived": summary["archived_count"] or 0
        }

        # Categories list
        categories_data = []

        category_counts = (
            queryset.values("matter_category")
            .annotate(
                total=Count("id"),
                open_count=Count("id", filter=Q(status__in=["OPEN", "IN_PROGRESS", "ON_HOLD"])),
                closed_count=Count("id", filter=Q(status="CLOSED"))
            )
        )

        category_map = {c["matter_category"]: c for c in category_counts}

        for cat_choice in MatterCategory.choices:
            code = cat_choice[0]
            label = cat_choice[1]
            mapped = category_map.get(code, {})
            categories_data.append({
                "category": code,
                "category_label": label,
                "total": mapped.get("total", 0),
                "open": mapped.get("open_count", 0),
                "closed": mapped.get("closed_count", 0)
            })

        return Response({
            "summary": summary_data,
            "categories": categories_data
        }, status=status.HTTP_200_OK)


from rest_framework import generics
from datetime import timedelta
from django.utils import timezone
from django.db.models import Q
from .models import CourtProceeding, Notification
from .serializers import CourtProceedingSerializer, NotificationSerializer
from .alerts import generate_hearing_alerts

def get_user_accessible_proceedings(user):
    queryset = CourtProceeding.objects.all()
    if user.role == UserRole.ADMIN:
        return queryset
    elif user.role in (UserRole.SENIOR_LAWYER, UserRole.JUNIOR_LAWYER):
        queryset = queryset.filter(
            Q(case__responsible_lawyer=user) |
            Q(case__supervising_lawyer=user) |
            Q(case__assistant_lawyers=user)
        ).distinct()
    elif user.role == UserRole.PARALEGAL:
        queryset = queryset.filter(case__supporting_paralegal=user)
    elif user.role == UserRole.CLIENT:
        queryset = queryset.filter(case__client=user)
    else:
        queryset = CourtProceeding.objects.none()
    return queryset


class HearingListView(generics.ListAPIView):
    serializer_class = CourtProceedingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        generate_hearing_alerts()
        
        queryset = get_user_accessible_proceedings(user).filter(next_hearing_date__isnull=False)
        
        # Apply filters
        court = self.request.query_params.get("court")
        if court:
            queryset = queryset.filter(court_name__iexact=court)
            
        practice_area = self.request.query_params.get("practice_area")
        if practice_area:
            queryset = queryset.filter(case__practice_area_id=practice_area)
            
        lawyer = self.request.query_params.get("lawyer")
        if lawyer:
            if user.role == UserRole.ADMIN:
                queryset = queryset.filter(
                    Q(case__responsible_lawyer_id=lawyer) |
                    Q(case__supervising_lawyer_id=lawyer) |
                    Q(case__assistant_lawyers=lawyer)
                ).distinct()
                
        # Date range filtering
        start_date = self.request.query_params.get("start_date")
        end_date = self.request.query_params.get("end_date")
        if start_date and end_date:
            queryset = queryset.filter(next_hearing_date__range=[start_date, end_date])
            
        return queryset


class HearingStatisticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        generate_hearing_alerts()
        
        proceedings = get_user_accessible_proceedings(user)
        today_date = timezone.localdate()
        tomorrow_date = today_date + timedelta(days=1)
        start_of_week = today_date - timedelta(days=today_date.weekday())
        end_of_week = start_of_week + timedelta(days=6)
        
        hearings = proceedings.filter(next_hearing_date__isnull=False)
        
        today_count = 0
        tomorrow_count = 0
        this_week_count = 0
        missed_count = 0
        completed_count = 0
        
        for h in hearings:
            h_status = h.hearing_status
            h_date = h.next_hearing_date
            
            if h_date == today_date:
                today_count += 1
            elif h_date == tomorrow_date:
                tomorrow_count += 1
                
            if start_of_week <= h_date <= end_of_week:
                this_week_count += 1
                
            if h_status == "MISSED":
                missed_count += 1
            elif h_status == "COMPLETED":
                completed_count += 1
                
        return Response({
            "today": today_count,
            "tomorrow": tomorrow_count,
            "this_week": this_week_count,
            "missed": missed_count,
            "completed": completed_count
        }, status=status.HTTP_200_OK)


class CaseProceedingListCreateView(generics.ListCreateAPIView):
    serializer_class = CourtProceedingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        case_id = self.kwargs.get("case_id")
        # Fetch case
        case = generics.get_object_or_404(Case, pk=case_id)
        # Check permissions manually
        from .permissions import IsCaseParticipant
        perm = IsCaseParticipant()
        if not perm.has_object_permission(self.request, self, case):
            self.permission_denied(self.request)
        return CourtProceeding.objects.filter(case=case)

    def perform_create(self, serializer):
        case_id = self.kwargs.get("case_id")
        case = generics.get_object_or_404(Case, pk=case_id)
        # Check permissions manually
        from .permissions import IsCaseParticipant
        perm = IsCaseParticipant()
        if not perm.has_object_permission(self.request, self, case):
            self.permission_denied(self.request)
        serializer.save(case=case)
        generate_hearing_alerts()


class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        generate_hearing_alerts()
        return Notification.objects.filter(user=self.request.user)


class NotificationMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        notification = generics.get_object_or_404(Notification, pk=pk, user=request.user)
        notification.is_read = True
        notification.save()
        return Response({"status": "read"}, status=status.HTTP_200_OK)

