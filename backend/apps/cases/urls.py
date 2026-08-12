from django.urls import path

from .views import (
    ActiveParalegalsListView,
    CaseConvertView,
    CaseDetailView,
    CaseListView,
)

urlpatterns = [
    path("", CaseListView.as_view(), name="case-list"),
    path("convert/", CaseConvertView.as_view(), name="case-convert"),
    path("active-paralegals/", ActiveParalegalsListView.as_view(), name="active-paralegals"),
    path("<int:pk>/", CaseDetailView.as_view(), name="case-detail"),
]
