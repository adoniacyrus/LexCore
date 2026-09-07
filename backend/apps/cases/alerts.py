from datetime import timedelta
from django.utils import timezone
from django.db import transaction
from .models import CourtProceeding, Notification

def create_hearing_notification(user, proceeding, alert_type, title, message):
    if not user:
        return
    Notification.objects.get_or_create(
        user=user,
        proceeding=proceeding,
        alert_type=alert_type,
        defaults={"title": title, "message": message}
    )

def get_case_participants(case):
    participants = set()
    if case.responsible_lawyer:
        participants.add(case.responsible_lawyer)
    if case.supervising_lawyer:
        participants.add(case.supervising_lawyer)
    if case.supporting_paralegal:
        participants.add(case.supporting_paralegal)
    if case.client:
        participants.add(case.client)
    for al in case.assistant_lawyers.all():
        participants.add(al)
    return participants

def generate_hearing_alerts():
    """
    Scans CourtProceeding records and generates Notifications for Case participants:
    - 7 Days Before: Upcoming Hearing alert.
    - Tomorrow: Hearing Tomorrow alert.
    - Today: Hearing Today alert.
    """
    today = timezone.localdate()
    
    with transaction.atomic():
        # 1. Today alerts
        proceedings_today = CourtProceeding.objects.filter(next_hearing_date=today)
        for p in proceedings_today:
            case = p.case
            title = "Hearing Today"
            message = "Court appearance required."
            recipients = get_case_participants(case)
            for user in recipients:
                create_hearing_notification(user, p, "TODAY", title, message)

        # 2. Tomorrow alerts
        tomorrow = today + timedelta(days=1)
        proceedings_tomorrow = CourtProceeding.objects.filter(next_hearing_date=tomorrow)
        for p in proceedings_tomorrow:
            case = p.case
            title = "Hearing Tomorrow"
            message = f"{case.title}\n{p.court_name}"
            recipients = get_case_participants(case)
            for user in recipients:
                create_hearing_notification(user, p, "TOMORROW", title, message)

        # 3. 7 Days Before alerts
        seven_days = today + timedelta(days=7)
        proceedings_seven = CourtProceeding.objects.filter(next_hearing_date=seven_days)
        for p in proceedings_seven:
            case = p.case
            title = "Upcoming Hearing"
            message = f"{case.case_reference}\nScheduled in 7 days."
            recipients = get_case_participants(case)
            for user in recipients:
                create_hearing_notification(user, p, "7_DAYS", title, message)
