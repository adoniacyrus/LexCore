from django.urls import path
from .views import DocumentDetailView

urlpatterns = [
    path("<int:pk>/", DocumentDetailView.as_view(), name="document-detail"),
]
