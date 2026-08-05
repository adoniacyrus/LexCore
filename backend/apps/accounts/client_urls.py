"""Client management URL routes — mounted at /api/clients/."""

from django.urls import path

from .client_views import (
    ClientDetailView,
    ClientForceResetPasswordView,
    ClientListCreateView,
    ClientSetActiveView,
)

urlpatterns = [
    path("", ClientListCreateView.as_view(), name="client-list-create"),
    path("<int:pk>/", ClientDetailView.as_view(), name="client-detail"),
    path(
        "<int:pk>/set-active/",
        ClientSetActiveView.as_view(),
        name="client-set-active",
    ),
    path(
        "<int:pk>/force-reset-password/",
        ClientForceResetPasswordView.as_view(),
        name="client-force-reset-password",
    ),
]
