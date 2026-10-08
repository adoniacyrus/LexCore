import json
import logging
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from apps.cases.models import Case
from .models import CaseConversation, CaseMessage
from .permissions import can_access_case_conversation, normalize_conversation_type
from .services import get_case_chat_group_name

logger = logging.getLogger(__name__)


class CaseChatConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer handling real-time chat for an authorized case conversation channel.
    Enforces JWT authentication and strict role-based conversation authorization before accepting connections.
    Persists messages in PostgreSQL/database and broadcasts them via isolated channel groups (client or team).
    """

    async def connect(self):
        self.user = self.scope.get("user")
        if not self.user or not self.user.is_authenticated:
            logger.warning("Rejecting WebSocket connection: Unauthenticated user.")
            await self.close(code=4001)
            return

        self.case_reference = self.scope["url_route"]["kwargs"].get("case_reference")
        self.case = await self.get_case(self.case_reference)
        if not self.case:
            logger.warning(f"Rejecting WebSocket connection: Case {self.case_reference} not found.")
            await self.close(code=4004)
            return

        raw_conv_type = self.scope["url_route"]["kwargs"].get("conversation_type")
        self.conversation_type = normalize_conversation_type(raw_conv_type)
        if not self.conversation_type:
            logger.warning(f"Rejecting WebSocket connection: Invalid conversation type '{raw_conv_type}'.")
            await self.close(code=4003)
            return

        is_authorized = await self.check_conversation_authorization(self.user, self.case, self.conversation_type)
        if not is_authorized:
            logger.warning(
                f"Rejecting WebSocket connection: User {self.user.id} not authorized for {self.conversation_type} in case {self.case_reference}."
            )
            await self.close(code=4003)
            return

        # Determine deterministic and isolated group name
        self.group_name = get_case_chat_group_name(self.case.case_reference, self.conversation_type)

        # Join the channel group
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name") and self.group_name:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        if not text_data:
            return

        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({"error": "Invalid JSON format."}))
            return

        raw_content = data.get("content", "")
        if not isinstance(raw_content, str):
            await self.send(text_data=json.dumps({"error": "Content must be a string."}))
            return

        content = raw_content.strip()
        if not content:
            await self.send(text_data=json.dumps({"error": "Message content cannot be empty."}))
            return

        # Sender is ALWAYS strictly the authenticated user from self.scope["user"]
        message_payload = await self.persist_message(self.case, self.conversation_type, self.user, content)

        # Broadcast the new message to all participants in this case conversation group
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "chat.message",
                "message": message_payload,
            },
        )

    async def chat_message(self, event):
        """
        Handler invoked by group_send with type="chat.message".
        Sends message JSON directly to the WebSocket client.
        """
        await self.send(text_data=json.dumps(event["message"]))

    @database_sync_to_async
    def get_case(self, case_reference):
        try:
            if str(case_reference).isdigit():
                return Case.objects.get(pk=int(case_reference))
            return Case.objects.get(case_reference=case_reference)
        except Case.DoesNotExist:
            return None

    @database_sync_to_async
    def check_conversation_authorization(self, user, case, conversation_type):
        return can_access_case_conversation(user, case, conversation_type)

    @database_sync_to_async
    def persist_message(self, case, conversation_type, user, content):
        conversation, _ = CaseConversation.objects.get_or_create(
            case=case,
            conversation_type=conversation_type,
        )
        msg = CaseMessage.objects.create(
            conversation=conversation,
            sender=user,
            content=content,
        )
        return {
            "id": msg.id,
            "sender_id": user.id,
            "sender_name": user.full_name or user.email,
            "sender_role": user.role,
            "conversation_type": conversation.conversation_type,
            "content": msg.content,
            "attachment_url": msg.attachment.url if msg.attachment else None,
            "attachment_name": msg.attachment_name,
            "attachment_size": msg.attachment_size,
            "attachment_type": msg.attachment_type,
            "created_at": msg.created_at.isoformat(),
        }
