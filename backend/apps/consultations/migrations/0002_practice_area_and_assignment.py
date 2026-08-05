"""
Replace CharField practice_area with PracticeArea FK, add assigned_lawyer,
seed practice area master data.
"""

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


SEED_AREAS = [
    ("General Consultation", "Initial intake and matters that need triage."),
    ("Civil Law", "Civil disputes, contracts, and related remedies."),
    ("Criminal Law", "Criminal defence and related proceedings."),
    ("Family Law", "Matrimonial, custody, and family matters."),
    ("Property Law", "Title, conveyancing, and property disputes."),
    ("Corporate Law", "Company, commercial, and corporate advisory."),
    ("Consumer Law", "Consumer protection and related claims."),
    ("Tax & Compliance", "Tax advisory and regulatory compliance."),
]

LEGACY_CODE_TO_NAME = {
    "CIVIL": "Civil Law",
    "CORPORATE": "Corporate Law",
    "CRIMINAL": "Criminal Law",
    "FAMILY": "Family Law",
    "PROPERTY": "Property Law",
    "TAX": "Tax & Compliance",
}


def seed_and_migrate_practice_areas(apps, schema_editor):
    PracticeArea = apps.get_model("consultations", "PracticeArea")
    Consultation = apps.get_model("consultations", "Consultation")

    name_to_id = {}
    for name, description in SEED_AREAS:
        area, _ = PracticeArea.objects.get_or_create(
            name=name,
            defaults={"description": description, "is_active": True},
        )
        name_to_id[name] = area.id

    for consultation in Consultation.objects.all():
        legacy = getattr(consultation, "practice_area_legacy", None)
        if not legacy:
            continue
        target_name = LEGACY_CODE_TO_NAME.get(legacy)
        if not target_name:
            continue
        area_id = name_to_id.get(target_name)
        if area_id:
            consultation.practice_area_id = area_id
            consultation.save(update_fields=["practice_area_id"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("consultations", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="PracticeArea",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("name", models.CharField(max_length=120, unique=True)),
                ("description", models.TextField(blank=True, default="")),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "practice area",
                "verbose_name_plural": "practice areas",
                "ordering": ["name"],
            },
        ),
        migrations.RenameField(
            model_name="consultation",
            old_name="practice_area",
            new_name="practice_area_legacy",
        ),
        migrations.AddField(
            model_name="consultation",
            name="practice_area",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="consultations",
                to="consultations.practicearea",
            ),
        ),
        migrations.AddField(
            model_name="consultation",
            name="assigned_lawyer",
            field=models.ForeignKey(
                blank=True,
                limit_choices_to={
                    "role__in": ("SENIOR_LAWYER", "JUNIOR_LAWYER")
                },
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="assigned_consultations",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddIndex(
            model_name="consultation",
            index=models.Index(
                fields=["assigned_lawyer", "-created_at"],
                name="consultatio_assigne_idx",
            ),
        ),
        migrations.RunPython(seed_and_migrate_practice_areas, noop_reverse),
        migrations.RemoveField(
            model_name="consultation",
            name="practice_area_legacy",
        ),
        migrations.AlterField(
            model_name="consultation",
            name="status",
            field=models.CharField(
                choices=[
                    ("PENDING", "Pending"),
                    ("UNDER_REVIEW", "Under Review"),
                    ("APPROVED", "Approved"),
                    ("ACCEPTED", "Accepted"),
                    ("REJECTED", "Rejected"),
                    ("CANCELLED", "Cancelled"),
                    ("COMPLETED", "Completed"),
                ],
                db_index=True,
                default="PENDING",
                max_length=20,
            ),
        ),
    ]
