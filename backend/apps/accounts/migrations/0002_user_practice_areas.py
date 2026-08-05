from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("consultations", "0002_practice_area_and_assignment"),
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="practice_areas",
            field=models.ManyToManyField(
                blank=True,
                help_text="Practice areas this lawyer specializes in.",
                related_name="lawyers",
                to="consultations.practicearea",
            ),
        ),
    ]
