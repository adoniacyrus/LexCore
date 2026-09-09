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
    LawyerAvailableSlotsView,
    LawyerConsultationCalendarView,
    LawyerDateOverrideDetailView,
    LawyerDateOverrideListCreateView,
    LawyerScheduleConfigView,
    LawyerTimeBlockDetailView,
    LawyerTimeBlockListCreateView,
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
    # Availability, time slots & lawyer schedule management
    path(
        "availability/slots/",
        LawyerAvailableSlotsView.as_view(),
        name="consultation-available-slots",
    ),
    path(
        "availability/my-schedule/",
        LawyerScheduleConfigView.as_view(),
        name="consultation-my-schedule",
    ),
    path(
        "availability/overrides/",
        LawyerDateOverrideListCreateView.as_view(),
        name="consultation-date-overrides",
    ),
    path(
        "availability/overrides/<int:pk>/",
        LawyerDateOverrideDetailView.as_view(),
        name="consultation-date-override-detail",
    ),
    path(
        "availability/time-blocks/",
        LawyerTimeBlockListCreateView.as_view(),
        name="consultation-time-blocks",
    ),
    path(
        "availability/time-blocks/<int:pk>/",
        LawyerTimeBlockDetailView.as_view(),
        name="consultation-time-block-detail",
    ),
    path(
        "lawyer-calendar/",
        LawyerConsultationCalendarView.as_view(),
        name="consultation-lawyer-calendar",
    ),
]

