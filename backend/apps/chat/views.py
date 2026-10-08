from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.cases.models import Case
from apps.cases.views import _get_case_or_404
from .models import CaseConversation, CaseMessage, ConversationType
from .permissions import (
    can_access_case_conversation,
    normalize_conversation_type,
)
from .serializers import CaseMessageSerializer, CaseMessageCreateSerializer
from .services import broadcast_case_message


class CaseMessagesPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


class CaseMessagesView(APIView):
    """
    GET /api/cases/<case_reference>/messages/?conversation=<client|team>
    Lists message history for a given case and conversation channel.
    Enforces role-based messaging authorization.

    POST /api/cases/<case_reference>/messages/?conversation=<client|team>
    Appends a new message to the designated case conversation.
    Sender is strictly request.user.
    Broadcasts newly created message to active WebSocket connections for that channel.
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = CaseMessagesPagination

    def _resolve_conversation_type(self, request, case):
        raw_conv = request.query_params.get("conversation")
        if not raw_conv and request.method == "POST":
            raw_conv = request.data.get("conversation") or request.data.get("conversation_type")

        if raw_conv:
            conv_type = normalize_conversation_type(raw_conv)
            if not conv_type:
                return None, Response(
                    {"detail": f"Invalid conversation type '{raw_conv}'. Must be 'client' or 'team'."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return conv_type, None

        # Fallback when conversation parameter is omitted:
        if case.client_id == request.user.id:
            return ConversationType.CLIENT_LAWYER, None
        elif request.user.id == case.responsible_lawyer_id:
            return None, Response(
                {"detail": "Query parameter 'conversation' ('client' or 'team') is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        else:
            return ConversationType.TEAM, None

    def get(self, request, case_reference):
        case = _get_case_or_404(Case.objects.all(), case_reference)

        conv_type, error_response = self._resolve_conversation_type(request, case)
        if error_response:
            return error_response

        if not can_access_case_conversation(request.user, case, conv_type):
            return Response(
                {"detail": "You do not have permission to access this case conversation."},
                status=status.HTTP_403_FORBIDDEN,
            )

        conversation, _ = CaseConversation.objects.get_or_create(
            case=case,
            conversation_type=conv_type,
        )
        messages_qs = conversation.messages.select_related("sender", "conversation").order_by("created_at")

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(messages_qs, request, view=self)
        if page is not None:
            serializer = CaseMessageSerializer(page, many=True, context={"request": request})
            return paginator.get_paginated_response(serializer.data)

        serializer = CaseMessageSerializer(messages_qs, many=True, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, case_reference):
        case = _get_case_or_404(Case.objects.all(), case_reference)

        conv_type, error_response = self._resolve_conversation_type(request, case)
        if error_response:
            return error_response

        if not can_access_case_conversation(request.user, case, conv_type):
            return Response(
                {"detail": "You do not have permission to access this case conversation."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = CaseMessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        conversation, _ = CaseConversation.objects.get_or_create(
            case=case,
            conversation_type=conv_type,
        )
        message = serializer.save(
            conversation=conversation,
            sender=request.user,
        )

        read_serializer = CaseMessageSerializer(message, context={"request": request})
        response_data = read_serializer.data

        # Broadcast to active WebSocket connections for this specific conversation type
        broadcast_case_message(case.case_reference, conv_type, response_data)

        return Response(response_data, status=status.HTTP_201_CREATED)
