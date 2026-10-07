import re
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def get_case_chat_group_name(case_reference: str) -> str:
    """
    Returns a deterministic, isolated group name for Channels.
    Only alphanumeric, hyphens, and underscores are retained, capped at 95 characters.
    """
    sanitized = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", str(case_reference))
    return f"case_chat_{sanitized}"[:95]


def broadcast_case_message(case_reference: str, message_payload: dict) -> None:
    """
    Broadcasts a serialized message payload to all active WebSocket connections in the case group.
    """
    channel_layer = get_channel_layer()
    if channel_layer:
        group_name = get_case_chat_group_name(case_reference)
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                "type": "chat.message",
                "message": message_payload,
            },
        )
