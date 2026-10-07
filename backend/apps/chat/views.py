from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.cases.models import Case
from apps.cases.permissions import IsCaseParticipant
from apps.cases.views import _get_case_or_404
from .models import CaseConversation, CaseMessage
from .serializers import CaseMessageSerializer, CaseMessageCreateSerializer
from .services import broadcast_case_message


class CaseMessagesPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


class CaseMessagesView(APIView):
    """
    GET /api/cases/<case_reference>/messages/
    Lists message history for a given case. Authorized case participants only.

    POST /api/cases/<case_reference>/messages/
    Appends a new message to the case conversation. Sender is strictly request.user.
    Broadcasts newly created message to active WebSocket connections.
    """

    permission_classes = [IsAuthenticated, IsCaseParticipant]
    pagination_class = CaseMessagesPagination

    def get(self, request, case_reference):
        case = _get_case_or_404(Case.objects.all(), case_reference)
        self.check_object_permissions(request, case)

        conversation, _ = CaseConversation.objects.get_or_create(case=case)
        messages_qs = conversation.messages.select_related("sender").order_by("created_at")

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(messages_qs, request, view=self)
        if page is not None:
            serializer = CaseMessageSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = CaseMessageSerializer(messages_qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, case_reference):
        case = _get_case_or_404(Case.objects.all(), case_reference)
        self.check_object_permissions(request, case)

        serializer = CaseMessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        conversation, _ = CaseConversation.objects.get_or_create(case=case)
        message = serializer.save(
            conversation=conversation,
            sender=request.user,
        )

        read_serializer = CaseMessageSerializer(message)
        response_data = read_serializer.data

        # Broadcast to active WebSocket connections
        broadcast_case_message(case.case_reference, response_data)

        return Response(response_data, status=status.HTTP_201_CREATED)
