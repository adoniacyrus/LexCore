from django.urls import path

from apps.documents.views import CaseDocumentsView
from apps.tasks.views import CaseTaskListCreateView
from .views import (
    ActiveParalegalsListView,
    ActiveLawyersListView,
    CaseConvertView,
    CaseDetailView,
    CaseListView,
    CaseTeamUpdateView,
    CaseMatterBoardView,
)

urlpatterns = [
    path("", CaseListView.as_view(), name="case-list"),
    path("convert/", CaseConvertView.as_view(), name="case-convert"),
    path("matter-board/", CaseMatterBoardView.as_view(), name="case-matter-board"),
    path("active-paralegals/", ActiveParalegalsListView.as_view(), name="active-paralegals"),
    path("active-lawyers/", ActiveLawyersListView.as_view(), name="active-lawyers"),
    path("<str:pk>/", CaseDetailView.as_view(), name="case-detail"),
    path("<str:pk>/team/", CaseTeamUpdateView.as_view(), name="case-team-update"),
    path("<str:case_id>/documents/", CaseDocumentsView.as_view(), name="case-documents"),
    path("<str:case_id>/tasks/", CaseTaskListCreateView.as_view(), name="case-tasks"),
]
