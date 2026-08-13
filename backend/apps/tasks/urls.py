from django.urls import path
from .views import (
    CaseTaskListCreateView,
    CaseTaskDetailView,
    TaskDocumentsView,
)

urlpatterns = [
    path("", CaseTaskListCreateView.as_view(), name="task-list-create"),
    path("<int:pk>/", CaseTaskDetailView.as_view(), name="task-detail"),
    path("<int:pk>/documents/", TaskDocumentsView.as_view(), name="task-documents"),
]
