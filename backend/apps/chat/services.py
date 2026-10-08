import re
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .permissions import conversation_type_slug


def get_case_chat_group_name(case_reference: str, conversation_type: str = "client") -> str:
    """
    Returns a deterministic, isolated group name for Channels.
    Format: case_chat_<client|team>_<sanitized_ref>
    Only alphanumeric, hyphens, and underscores are retained, capped at 95 characters.
    """
    type_slug = conversation_type_slug(conversation_type)
    sanitized = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", str(case_reference))
    return f"case_chat_{type_slug}_{sanitized}"[:95]


def broadcast_case_message(case_reference: str, conversation_type: str, message_payload: dict) -> None:
    """
    Broadcasts a serialized message payload to all active WebSocket connections in the
    corresponding isolated case conversation group (client or team).
    """
    channel_layer = get_channel_layer()
    if channel_layer:
        group_name = get_case_chat_group_name(case_reference, conversation_type)
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                "type": "chat.message",
                "message": message_payload,
            },
        )
