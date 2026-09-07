"""Consultation API routes — mounted at /api/consultations/."""

from django.urls import path

from .views import (
    AdminConsultationDetailView,
    AdminConsultationListView,
    ConsultationCreateView,
    ClientEligibleCasesView,
    EligibleLawyersView,
    LawyerAssignedListView,
    LawyerAssignedStatusView,
    MyConsultationsView,
    PracticeAreaDetailView,
    PracticeAreaListCreateView,
)

urlpatterns = [
    path(
        "practice-areas/",
        PracticeAreaListCreateView.as_view(),
        name="practice-area-list",
    ),
    path(
        "practice-areas/<int:pk>/",
        PracticeAreaDetailView.as_view(),
        name="practice-area-detail",
    ),
    path("", ConsultationCreateView.as_view(), name="consultation-create"),
    path("eligible-cases/", ClientEligibleCasesView.as_view(), name="consultation-eligible-cases"),
    path("my/", MyConsultationsView.as_view(), name="consultation-my-list"),
    path(
        "admin/",
        AdminConsultationListView.as_view(),
        name="consultation-admin-list",
    ),
    path(
        "admin/eligible-lawyers/",
        EligibleLawyersView.as_view(),
        name="consultation-eligible-lawyers",
    ),
    path(
        "admin/<str:pk>/",
        AdminConsultationDetailView.as_view(),
        name="consultation-admin-detail",
    ),
    path(
        "assigned/",
        LawyerAssignedListView.as_view(),
        name="consultation-assigned-list",
    ),
    path(
        "assigned/<str:pk>/status/",
        LawyerAssignedStatusView.as_view(),
        name="consultation-assigned-status",
    ),
]
