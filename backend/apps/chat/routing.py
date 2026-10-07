from django.urls import re_path
from .consumers import CaseChatConsumer

websocket_urlpatterns = [
    re_path(
        r"^ws/cases/(?P<case_reference>[\w-]+)/chat/?$",
        CaseChatConsumer.as_asgi(),
    ),
]
