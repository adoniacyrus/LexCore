from django.urls import path
from .views import CaseMessagesView

urlpatterns = [
    path("<str:case_reference>/messages/", CaseMessagesView.as_view(), name="case-messages"),
]
