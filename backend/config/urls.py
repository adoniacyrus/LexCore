"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from apps.cases.views import HearingStatisticsView, HearingListView, NotificationListView, NotificationMarkReadView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/users/", include("apps.accounts.employee_urls")),
    path("api/clients/", include("apps.accounts.client_urls")),
    path("api/consultations/", include("apps.consultations.urls")),
    path("api/payments/", include("apps.payments.urls")),
    path("api/cases/tasks/", include("apps.tasks.urls")),
    path("api/cases/", include("apps.cases.urls")),
    path("api/documents/", include("apps.documents.urls")),
    path("api/hearings/statistics/", HearingStatisticsView.as_view(), name="hearing-statistics"),
    path("api/hearings/", HearingListView.as_view(), name="hearing-list"),
    path("api/notifications/", NotificationListView.as_view(), name="notification-list"),
    path("api/notifications/<int:pk>/mark-read/", NotificationMarkReadView.as_view(), name="notification-mark-read"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
