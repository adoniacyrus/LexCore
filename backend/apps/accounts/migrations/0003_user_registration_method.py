from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_user_practice_areas"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="registration_method",
            field=models.CharField(
                choices=[("SELF", "Self Registered"), ("ADMIN", "Admin Registered")],
                db_index=True,
                default="SELF",
                help_text="How this account was created (self-service or admin).",
                max_length=16,
                verbose_name="registration method",
            ),
        ),
    ]
