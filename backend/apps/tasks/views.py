from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import UserRole
from apps.cases.models import Case
from apps.documents.models import Document
from apps.documents.serializers import DocumentSerializer
from .models import CaseTask
from .permissions import IsTaskAuthorized, is_user_in_case_team
from .serializers import (
    CaseTaskSerializer,
    TaskStatusUpdateSerializer,
)


class CaseTaskListCreateView(APIView):
    """
    GET /api/cases/tasks/ or GET /api/cases/<case_id>/tasks/
    POST /api/cases/tasks/ or POST /api/cases/<case_id>/tasks/
    """
    permission_classes = [IsAuthenticated, IsTaskAuthorized]

    def get(self, request, case_id=None):
        user = request.user
        if user.role == UserRole.CLIENT:
            return Response(
                {"detail": "Clients do not have access to internal case tasks."},
                status=status.HTTP_403_FORBIDDEN,
            )

        target_case_id = case_id or request.query_params.get("case") or request.query_params.get("case_id")
        
        queryset = CaseTask.objects.select_related(
            "case", "assigned_to", "created_by"
        ).prefetch_related("documents")

        if user.role == UserRole.ADMIN:
            if target_case_id:
                queryset = queryset.filter(case_id=target_case_id)
        else:
            # Filter by cases where the user is a team member
            accessible_cases = Case.objects.filter(
                Q(responsible_lawyer=user) |
                Q(supporting_paralegal=user) |
                Q(assistant_lawyers=user)
            ).distinct()

            if target_case_id:
                case = get_object_or_404(Case, pk=target_case_id)
                if not is_user_in_case_team(user, case):
                    return Response(
                        {"detail": "You do not have permission to access tasks for this case."},
                        status=status.HTTP_403_FORBIDDEN,
                    )
                queryset = queryset.filter(case=case)
            else:
                queryset = queryset.filter(case__in=accessible_cases)

        # Filters
        task_status = request.query_params.get("status")
        if task_status:
            queryset = queryset.filter(status=task_status.upper())

        my_tasks = request.query_params.get("my_tasks") or request.query_params.get("assigned_to_me")
        if my_tasks and my_tasks.lower() in ("true", "1"):
            queryset = queryset.filter(assigned_to=user)

        assigned_to_param = request.query_params.get("assigned_to")
        if assigned_to_param:
            queryset = queryset.filter(assigned_to_id=assigned_to_param)

        queryset = queryset.order_by("due_date", "-created_at")
        serializer = CaseTaskSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, case_id=None):
        user = request.user
        if user.role == UserRole.CLIENT:
            return Response(
                {"detail": "Clients do not have access to internal task creation."},
                status=status.HTTP_403_FORBIDDEN,
            )

        target_case_id = case_id or request.data.get("case")
        if not target_case_id:
            return Response(
                {"case": "Case ID is required to create a task."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        case = get_object_or_404(Case, pk=target_case_id)

        # Only Admin or Responsible Lawyer can create tasks for a case
        is_admin = user.role == UserRole.ADMIN
        is_responsible_lawyer = case.responsible_lawyer_id == user.id

        if not (is_admin or is_responsible_lawyer):
            return Response(
                {"detail": "Only the Responsible Lawyer or an Administrator can create case tasks."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = CaseTaskSerializer(
            data=request.data,
            context={"request": request, "case": case},
        )
        serializer.is_valid(raise_exception=True)
        task = serializer.save(case=case, created_by=user)

        # Refetch with relations
        full_task = CaseTask.objects.select_related(
            "case", "assigned_to", "created_by"
        ).prefetch_related("documents").get(pk=task.pk)

        return Response(CaseTaskSerializer(full_task).data, status=status.HTTP_201_CREATED)


class CaseTaskDetailView(APIView):
    """
    GET /api/cases/tasks/<pk>/
    PATCH /api/cases/tasks/<pk>/
    """
    permission_classes = [IsAuthenticated, IsTaskAuthorized]

    def get(self, request, pk):
        task = get_object_or_404(
            CaseTask.objects.select_related("case", "assigned_to", "created_by").prefetch_related("documents"),
            pk=pk,
        )
        self.check_object_permissions(request, task)
        return Response(CaseTaskSerializer(task).data, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        task = get_object_or_404(
            CaseTask.objects.select_related("case", "assigned_to", "created_by").prefetch_related("documents"),
            pk=pk,
        )
        self.check_object_permissions(request, task)

        user = request.user
        is_admin_or_lead = (
            user.role == UserRole.ADMIN or
            task.case.responsible_lawyer_id == user.id
        )

        data_keys = set(request.data.keys())

        if is_admin_or_lead:
            # Full edit capabilities for Admin & Lead Lawyer
            serializer = CaseTaskSerializer(
                task,
                data=request.data,
                partial=True,
                context={"request": request, "case": task.case},
            )
        else:
            # Assistant lawyers and paralegals can only update their assigned task status
            non_status_keys = data_keys - {"status"}
            if non_status_keys:
                return Response(
                    {"detail": "Only the Responsible Lawyer or an Administrator can edit task details or reassign tasks."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            serializer = TaskStatusUpdateSerializer(task, data=request.data, partial=True)

        serializer.is_valid(raise_exception=True)
        serializer.save()

        # Refetch full task
        updated_task = CaseTask.objects.select_related(
            "case", "assigned_to", "created_by"
        ).prefetch_related("documents").get(pk=task.pk)

        return Response(CaseTaskSerializer(updated_task).data, status=status.HTTP_200_OK)


class TaskDocumentsView(APIView):
    """
    GET /api/cases/tasks/<pk>/documents/
    POST /api/cases/tasks/<pk>/documents/
    """
    permission_classes = [IsAuthenticated, IsTaskAuthorized]
    parser_classes = (MultiPartParser, FormParser)

    def get(self, request, pk):
        task = get_object_or_404(CaseTask, pk=pk)
        self.check_object_permissions(request, task)

        documents = Document.objects.filter(task=task).select_related(
            "case", "uploaded_by", "task"
        ).order_by("-uploaded_at")
        serializer = DocumentSerializer(documents, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, pk):
        task = get_object_or_404(CaseTask, pk=pk)
        self.check_object_permissions(request, task)

        serializer = DocumentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Upload document linked to both the Case and the specific Task
        document = serializer.save(
            case=task.case,
            task=task,
            uploaded_by=request.user,
        )

        return Response(DocumentSerializer(document).data, status=status.HTTP_201_CREATED)
