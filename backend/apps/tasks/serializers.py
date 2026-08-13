from django.contrib.auth import get_user_model
from rest_framework import serializers
from apps.cases.models import Case
from apps.cases.serializers import UserBriefSerializer
from .models import CaseTask, TaskStatus

User = get_user_model()


class CaseTaskBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = CaseTask
        fields = ("id", "task_id", "title", "status", "due_date")
        read_only_fields = fields


class CaseTaskSerializer(serializers.ModelSerializer):
    assigned_to = UserBriefSerializer(read_only=True)
    created_by = UserBriefSerializer(read_only=True)
    assigned_to_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True),
        source="assigned_to",
        write_only=True,
    )
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    case_reference = serializers.CharField(source="case.case_reference", read_only=True)
    documents_count = serializers.SerializerMethodField()

    class Meta:
        model = CaseTask
        fields = (
            "id",
            "task_id",
            "case",
            "case_reference",
            "title",
            "description",
            "assigned_to",
            "assigned_to_id",
            "created_by",
            "due_date",
            "status",
            "status_label",
            "created_at",
            "updated_at",
            "completed_at",
            "documents_count",
        )
        read_only_fields = (
            "id",
            "task_id",
            "case",
            "case_reference",
            "assigned_to",
            "created_by",
            "status_label",
            "created_at",
            "updated_at",
            "completed_at",
            "documents_count",
        )

    def get_documents_count(self, obj):
        return obj.documents.count()

    def validate(self, attrs):
        case = self.instance.case if self.instance else self.context.get("case")
        assigned_user = attrs.get("assigned_to", getattr(self.instance, "assigned_to", None))

        if case and assigned_user:
            # Gather valid case team user IDs
            valid_team_ids = set()
            if case.responsible_lawyer_id:
                valid_team_ids.add(case.responsible_lawyer_id)
            if case.supporting_paralegal_id:
                valid_team_ids.add(case.supporting_paralegal_id)
            valid_team_ids.update(case.assistant_lawyers.values_list("id", flat=True))

            if assigned_user.id not in valid_team_ids:
                raise serializers.ValidationError(
                    {"assigned_to_id": "The assigned user must be a member of the case team (Responsible Lawyer, Assistant Lawyer, or Supporting Paralegal)."}
                )

        return attrs


class TaskStatusUpdateSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = CaseTask
        fields = ("status", "status_label")
