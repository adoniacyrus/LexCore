"""Employee management URL routes — mounted at /api/users/."""

from django.urls import path

from .employee_views import (
    EmployeeDetailView,
    EmployeeForceResetPasswordView,
    EmployeeListCreateView,
    EmployeeSetActiveView,
)

urlpatterns = [
    path("", EmployeeListCreateView.as_view(), name="employee-list-create"),
    path("<int:pk>/", EmployeeDetailView.as_view(), name="employee-detail"),
    path(
        "<int:pk>/set-active/",
        EmployeeSetActiveView.as_view(),
        name="employee-set-active",
    ),
    path(
        "<int:pk>/force-reset-password/",
        EmployeeForceResetPasswordView.as_view(),
        name="employee-force-reset-password",
    ),
]
