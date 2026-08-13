import os
from rest_framework import serializers
from apps.cases.serializers import UserBriefSerializer
from apps.tasks.serializers import CaseTaskBriefSerializer
from .models import Document, DocumentCategory


class DocumentSerializer(serializers.ModelSerializer):
    uploaded_by = UserBriefSerializer(read_only=True)
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    file_type = serializers.SerializerMethodField()
    file_size = serializers.SerializerMethodField()
    task = CaseTaskBriefSerializer(read_only=True)

    class Meta:
        model = Document
        fields = (
            "id",
            "document_id",
            "case",
            "task",
            "uploaded_by",
            "title",
            "file",
            "category",
            "category_label",
            "description",
            "uploaded_at",
            "updated_at",
            "file_type",
            "file_size",
        )
        read_only_fields = (
            "id",
            "document_id",
            "case",
            "task",
            "uploaded_by",
            "uploaded_at",
            "updated_at",
            "file_type",
            "file_size",
        )

    def get_file_type(self, obj):
        if not obj.file:
            return "—"
        ext = os.path.splitext(obj.file.name)[1].lower()
        return ext.replace(".", "").upper()

    def get_file_size(self, obj):
        if not obj.file:
            return "0 KB"
        try:
            size_bytes = obj.file.size
            if size_bytes >= 1024 * 1024:
                return f"{size_bytes / (1024 * 1024):.1f} MB"
            return f"{size_bytes / 1024:.0f} KB"
        except Exception:
            return "—"

    def validate_file(self, value):
        # Enforce maximum size validation (10 MB)
        max_size = 10 * 1024 * 1024
        if value.size > max_size:
            raise serializers.ValidationError("File size exceeds the limit of 10 MB.")

        # Enforce supported extensions (PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG)
        allowed_extensions = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png"}
        ext = os.path.splitext(value.name)[1].lower()
        if ext not in allowed_extensions:
            raise serializers.ValidationError(
                f"Unsupported file format '{ext}'. Allowed formats: PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG."
            )
        return value
