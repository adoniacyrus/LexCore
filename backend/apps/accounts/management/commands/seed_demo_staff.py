"""
Seed a realistic LexCore chambers staff roster for demos.

Idempotent: upserts by email, assigns practice areas, and deactivates
obvious smoke-test accounts. Does not modify CLIENT accounts.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import User, UserRole
from apps.consultations.models import PracticeArea


# Demo password for newly created staff (existing passwords are left unchanged).
DEFAULT_PASSWORD = "LexCore@Demo1"

# Realistic firm roster for consultation assignment demos.
DEMO_STAFF = [
    {
        "email": "admin@lexcore.com",
        "full_name": "Priya Nair",
        "phone_number": "+91 98765 41001",
        "role": UserRole.ADMIN,
        "practice_areas": [],
        "is_staff": True,
    },
    {
        "email": "senior@lexcore.com",
        "full_name": "Vikram Malhotra",
        "phone_number": "+91 98765 41011",
        "role": UserRole.SENIOR_LAWYER,
        "practice_areas": ["Civil Law", "Property Law"],
    },
    {
        "email": "ananya.krishnan@lexcore.com",
        "full_name": "Ananya Krishnan",
        "phone_number": "+91 98765 41012",
        "role": UserRole.SENIOR_LAWYER,
        "practice_areas": ["Corporate Law", "Tax & Compliance"],
    },
    {
        "email": "adoniacyrus03@gmail.com",
        "full_name": "Adonia Cyrus",
        "phone_number": "+91 98765 41013",
        "role": UserRole.SENIOR_LAWYER,
        "practice_areas": ["Criminal Law"],
    },
    {
        "email": "junior@lexcore.com",
        "full_name": "Meera Iyer",
        "phone_number": "+91 98765 41021",
        "role": UserRole.JUNIOR_LAWYER,
        "practice_areas": ["Family Law", "Civil Law"],
    },
    {
        "email": "rohan.deshpande@lexcore.com",
        "full_name": "Rohan Deshpande",
        "phone_number": "+91 98765 41022",
        "role": UserRole.JUNIOR_LAWYER,
        "practice_areas": ["Consumer Law", "Property Law"],
    },
    {
        "email": "kabir.sengupta@lexcore.com",
        "full_name": "Kabir Sengupta",
        "phone_number": "+91 98765 41023",
        "role": UserRole.JUNIOR_LAWYER,
        "practice_areas": ["General Consultation"],
    },
    {
        "email": "paralegal@lexcore.com",
        "full_name": "Sneha Kulkarni",
        "phone_number": "+91 98765 41031",
        "role": UserRole.PARALEGAL,
        "practice_areas": [],
    },
    {
        "email": "arjun.patel@lexcore.com",
        "full_name": "Arjun Patel",
        "phone_number": "+91 98765 41032",
        "role": UserRole.PARALEGAL,
        "practice_areas": [],
    },
]

DEACTIVATE_EMAILS = {
    "emp.smoke.test@lexcore.test",
}


class Command(BaseCommand):
    help = "Seed realistic chambers staff and lawyer practice-area specializations."

    @transaction.atomic
    def handle(self, *args, **options):
        areas = {area.name: area for area in PracticeArea.objects.filter(is_active=True)}
        missing = sorted(
            {
                name
                for row in DEMO_STAFF
                for name in row["practice_areas"]
                if name not in areas
            }
        )
        if missing:
            self.stderr.write(
                self.style.ERROR(
                    "Missing practice areas (run migrations first): "
                    + ", ".join(missing)
                )
            )
            return

        created = 0
        updated = 0

        for row in DEMO_STAFF:
            email = row["email"].strip().lower()
            defaults = {
                "full_name": row["full_name"],
                "phone_number": row.get("phone_number", ""),
                "role": row["role"],
                "is_active": True,
                "is_staff": bool(row.get("is_staff", False)),
            }
            user = User.objects.filter(email=email).first()
            if user:
                for field, value in defaults.items():
                    setattr(user, field, value)
                user.save()
                updated += 1
                action = "updated"
            else:
                user = User.objects.create_user(
                    email=email,
                    full_name=defaults["full_name"],
                    password=DEFAULT_PASSWORD,
                    phone_number=defaults["phone_number"],
                    role=defaults["role"],
                    is_active=True,
                    is_staff=defaults["is_staff"],
                )
                created += 1
                action = "created"

            area_objs = [areas[name] for name in row["practice_areas"]]
            user.practice_areas.set(area_objs)

            area_names = ", ".join(row["practice_areas"]) or "-"
            self.stdout.write(
                f"  {action}: {user.full_name} <{user.email}> "
                f"[{user.get_role_display()}] -> {area_names}"
            )

        deactivated = 0
        for email in DEACTIVATE_EMAILS:
            qs = User.objects.filter(email=email, is_active=True)
            count = qs.update(is_active=False)
            deactivated += count
            if count:
                self.stdout.write(f"  deactivated: {email}")

        self.stdout.write(
            self.style.SUCCESS(
                f"Demo staff ready ({created} created, {updated} updated, "
                f"{deactivated} deactivated)."
            )
        )
        self.stdout.write(
            "New accounts use password "
            f"{DEFAULT_PASSWORD} (existing passwords unchanged)."
        )
