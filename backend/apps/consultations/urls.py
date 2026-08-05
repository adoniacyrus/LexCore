"""Consultation API routes — mounted at /api/consultations/."""

from django.urls import path

from .views import ConsultationCreateView, MyConsultationsView

urlpatterns = [
    path("", ConsultationCreateView.as_view(), name="consultation-create"),
    path("my/", MyConsultationsView.as_view(), name="consultation-my-list"),
]
