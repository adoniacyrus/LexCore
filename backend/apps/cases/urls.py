from django.urls import path

from apps.documents.views import CaseDocumentsView
from apps.tasks.views import CaseTaskListCreateView
from apps.chat.views import CaseMessagesView
from .views import (
    ActiveParalegalsListView,
    ActiveLawyersListView,
    CaseConvertView,
    CaseDetailView,
    CaseListView,
    CaseTeamUpdateView,
    CaseAppointmentFeeView,
    CaseMatterBoardView,
    CaseProceedingListCreateView,
    CaseSummaryPDFView,
    CaseHearingRecordListCreateView,
    CaseHearingRecordDetailView,
    CaseTimelineView,
)

urlpatterns = [
    path("", CaseListView.as_view(), name="case-list"),
    path("convert/", CaseConvertView.as_view(), name="case-convert"),
    path("matter-board/", CaseMatterBoardView.as_view(), name="case-matter-board"),
    path("active-paralegals/", ActiveParalegalsListView.as_view(), name="active-paralegals"),
    path("active-lawyers/", ActiveLawyersListView.as_view(), name="active-lawyers"),
    path("<str:pk>/", CaseDetailView.as_view(), name="case-detail"),
    path("<str:pk>/team/", CaseTeamUpdateView.as_view(), name="case-team-update"),
    path("<str:pk>/appointment-fee/", CaseAppointmentFeeView.as_view(), name="case-appointment-fee"),
    path("<str:pk>/summary-pdf/", CaseSummaryPDFView.as_view(), name="case-summary-pdf"),
    path("<str:case_id>/documents/", CaseDocumentsView.as_view(), name="case-documents"),
    path("<str:case_id>/tasks/", CaseTaskListCreateView.as_view(), name="case-tasks"),
    path("<str:case_id>/proceedings/", CaseProceedingListCreateView.as_view(), name="case-proceedings"),
    path("<str:case_id>/hearings/", CaseHearingRecordListCreateView.as_view(), name="case-hearings"),
    path("<str:case_id>/hearings/<str:pk>/", CaseHearingRecordDetailView.as_view(), name="case-hearing-detail"),
    path("hearings/<str:pk>/", CaseHearingRecordDetailView.as_view(), name="hearing-record-detail"),
    path("<str:case_id>/timeline/", CaseTimelineView.as_view(), name="case-timeline"),
    path("<str:case_reference>/messages/", CaseMessagesView.as_view(), name="case-messages"),
]

