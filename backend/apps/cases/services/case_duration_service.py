from datetime import date
from django.db.models import Q
from django.utils import timezone

from apps.accounts.models import UserRole
from apps.cases.models import (
    Case,
    CaseStatus,
    MatterStage,
    HearingRecord,
    CourtProceeding,
    CaseActivity,
)


def format_duration_days(days: int | None) -> str:
    """
    Formats a duration in days into a concise, human-readable breakdown
    alongside the exact factual day count.
    Example: '4 mos, 22 days (142 days)' or '15 days'.
    """
    if days is None:
        return "Not available"
    if days < 0:
        return "0 days"
    if days == 0:
        return "0 days (Started today)"
    if days == 1:
        return "1 day"
    if days < 30:
        return f"{days} days"

    years = days // 365
    rem_days = days % 365
    months = rem_days // 30
    rem_d = rem_days % 30

    parts = []
    if years > 0:
        parts.append(f"{years} yr" if years == 1 else f"{years} yrs")
    if months > 0:
        parts.append(f"{months} mo" if months == 1 else f"{months} mos")
    if rem_d > 0 and years == 0:
        parts.append(f"{rem_d} day" if rem_d == 1 else f"{rem_d} days")

    formatted = ", ".join(parts) if parts else f"{days} days"
    return f"{formatted} ({days} days)"


class CaseDurationService:
    """
    Service for calculating factual Case Duration Analytics from real database records.

    Strictly adheres to:
    - Pure analytics, NO AI or machine learning models.
    - Zero unsupported estimated completion dates.
    - Real database values: Case start_date, CaseActivity stage timestamps,
      HearingRecord / CourtProceeding dates.
    - Role-based visibility: Clients see high-level progress without internal notes
      or private staff tracking.
    """

    @classmethod
    def calculate_duration_metrics(cls, case: Case, user) -> dict:
        today = timezone.localdate()
        is_client = getattr(user, "role", None) == UserRole.CLIENT

        # 1. Start Date (with graceful fallback to created_at or None)
        start_date = getattr(case, "start_date", None)
        if not start_date and getattr(case, "created_at", None):
            start_date = case.created_at.date()

        # 2. Closed Case Detection & Closure Date
        is_closed = (
            case.status in (CaseStatus.CLOSED, CaseStatus.ARCHIVED)
            or case.matter_stage in (MatterStage.CLOSED, MatterStage.ARCHIVED)
        )

        closure_date = None
        total_closed_duration_days = None
        total_closed_duration_humanized = None

        if is_closed:
            # Check CaseActivity logs for formal status/stage closure
            closure_act = (
                case.activities.filter(
                    Q(activity_type="STATUS_CHANGED", description__icontains="Closed")
                    | Q(activity_type="STAGE_CHANGED", description__icontains="Closed")
                    | Q(activity_type="STATUS_CHANGED", description__icontains="Archived")
                    | Q(activity_type="STAGE_CHANGED", description__icontains="Archived")
                )
                .order_by("-created_at")
                .first()
            )
            if closure_act:
                closure_date = closure_act.created_at.date()
            elif getattr(case, "updated_at", None):
                closure_date = case.updated_at.date()
            else:
                closure_date = today

            if start_date and closure_date:
                total_closed_duration_days = max(0, (closure_date - start_date).days)
                total_closed_duration_humanized = format_duration_days(total_closed_duration_days)

        # 3. Elapsed Duration
        if is_closed:
            elapsed_days = total_closed_duration_days
            elapsed_humanized = total_closed_duration_humanized
        else:
            if start_date:
                elapsed_days = max(0, (today - start_date).days)
                elapsed_humanized = format_duration_days(elapsed_days)
            else:
                elapsed_days = None
                elapsed_humanized = "Not available"

        # 4. End boundary for stage calculations
        end_boundary = closure_date if is_closed else today

        # 5. Time Spent in Stages
        stages_breakdown = cls._calculate_stage_breakdown(case, start_date, end_boundary)

        # Time in current stage
        time_in_current_stage_days = None
        if stages_breakdown:
            current_stage_entry = next((s for s in reversed(stages_breakdown) if s.get("is_current")), stages_breakdown[-1])
            time_in_current_stage_days = current_stage_entry.get("duration_days")
        elif start_date and end_boundary:
            time_in_current_stage_days = max(0, (end_boundary - start_date).days)

        time_in_current_stage_humanized = format_duration_days(time_in_current_stage_days)

        # 6. Hearing Metrics
        hearing_metrics = cls._calculate_hearing_metrics(case, today)

        # 7. Additional Lawyer/Staff Metrics
        staff_metrics = None
        if not is_client:
            staff_metrics = {
                "average_days_between_hearings": hearing_metrics["average_days_between_hearings"],
                "hearing_frequency_description": hearing_metrics["hearing_frequency_description"],
                "days_in_current_stage": time_in_current_stage_days,
                "filing_number": case.filing_number,
                "registration_number": case.registration_number,
                "cnr_number": case.cnr_number,
                "court": case.court,
                "responsible_lawyer_name": (
                    case.responsible_lawyer.full_name if getattr(case, "responsible_lawyer", None) else "Unassigned"
                ),
                "supervising_lawyer_name": (
                    case.supervising_lawyer.full_name if getattr(case, "supervising_lawyer", None) else None
                ),
                "supporting_paralegal_name": (
                    case.supporting_paralegal.full_name if getattr(case, "supporting_paralegal", None) else None
                ),
            }

        return {
            "case_reference": case.case_reference,
            "case_title": case.title,
            "status": case.status,
            "status_label": case.get_status_display() if hasattr(case, "get_status_display") else case.status,
            "current_stage": case.matter_stage,
            "current_stage_label": case.get_matter_stage_display() if hasattr(case, "get_matter_stage_display") else case.matter_stage,
            "is_closed": is_closed,

            # Dates
            "start_date": str(start_date) if start_date else None,
            "current_date": str(today),
            "closure_date": str(closure_date) if closure_date else None,

            # Duration Metrics
            "elapsed_days": elapsed_days,
            "elapsed_humanized": elapsed_humanized,
            "total_closed_duration_days": total_closed_duration_days,
            "total_closed_duration_humanized": total_closed_duration_humanized,

            # Stages
            "stages_breakdown": stages_breakdown,
            "time_in_current_stage_days": time_in_current_stage_days,
            "time_in_current_stage_humanized": time_in_current_stage_humanized,

            # Hearings
            "total_hearings": hearing_metrics["total_hearings"],
            "completed_hearings_count": hearing_metrics["completed_hearings_count"],
            "upcoming_hearings_count": hearing_metrics["upcoming_hearings_count"],
            "has_hearings": hearing_metrics["has_hearings"],
            "most_recent_hearing": hearing_metrics["most_recent_hearing"],
            "next_scheduled_hearing": hearing_metrics["next_scheduled_hearing"],

            # Staff Metrics
            "staff_metrics": staff_metrics,
            "is_client_view": is_client,
        }

    @classmethod
    def _calculate_stage_breakdown(cls, case: Case, start_date: date | None, end_date: date | None) -> list:
        if not start_date or not end_date or start_date > end_date:
            return []

        stage_choices = dict(MatterStage.choices)
        lookup = {k.lower(): k for k in stage_choices.keys()}
        lookup.update({v.lower(): k for k, v in stage_choices.items()})

        # Query stage change activities
        activities = list(
            case.activities.filter(activity_type="STAGE_CHANGED").order_by("created_at")
        )

        if not activities:
            total_days = max(0, (end_date - start_date).days)
            return [
                {
                    "stage": case.matter_stage,
                    "stage_label": stage_choices.get(case.matter_stage, case.matter_stage),
                    "start_date": str(start_date),
                    "end_date": str(end_date),
                    "duration_days": total_days,
                    "duration_humanized": format_duration_days(total_days),
                    "is_current": True,
                }
            ]

        intervals = []
        first_act = activities[0]
        act_date = first_act.created_at.date()

        # Deduce initial stage
        prev_stage = None
        desc = first_act.description.lower()
        if "from " in desc and " to " in desc:
            from_part = desc.split("from ")[1].split(" to ")[0].strip()
            for name, key in lookup.items():
                if name in from_part:
                    prev_stage = key
                    break

        if not prev_stage:
            prev_stage = (
                MatterStage.CONSULTATION
                if hasattr(case, "originating_consultation") and case.originating_consultation
                else MatterStage.UNDER_REVIEW
            )

        init_end = min(act_date, end_date)
        init_days = max(0, (init_end - start_date).days)
        intervals.append({
            "stage": prev_stage,
            "stage_label": stage_choices.get(prev_stage, prev_stage),
            "start_date": str(start_date),
            "end_date": str(init_end),
            "duration_days": init_days,
            "duration_humanized": format_duration_days(init_days),
            "is_current": False,
        })

        for idx, act in enumerate(activities):
            act_d = act.created_at.date()
            next_d = (
                activities[idx + 1].created_at.date()
                if idx + 1 < len(activities)
                else end_date
            )
            to_stage = None
            act_desc = act.description.lower()
            if " to " in act_desc:
                to_part = act_desc.split(" to ")[1].strip().rstrip(".")
                for name, key in lookup.items():
                    if name in to_part:
                        to_stage = key
                        break
            if not to_stage:
                for name, key in lookup.items():
                    if name in act_desc:
                        to_stage = key
                        break
            if not to_stage:
                to_stage = case.matter_stage if idx == len(activities) - 1 else MatterStage.UNDER_REVIEW

            is_last = (idx == len(activities) - 1)
            int_end = min(next_d, end_date)
            int_days = max(0, (int_end - act_d).days)

            intervals.append({
                "stage": to_stage,
                "stage_label": stage_choices.get(to_stage, to_stage),
                "start_date": str(act_d),
                "end_date": str(int_end),
                "duration_days": int_days,
                "duration_humanized": format_duration_days(int_days),
                "is_current": is_last,
            })

        return intervals

    @classmethod
    def _calculate_hearing_metrics(cls, case: Case, today: date) -> dict:
        hearing_records = list(case.hearing_records.all().order_by("hearing_date", "created_at"))
        proceedings = list(case.proceedings.all().order_by("event_date", "created_at"))

        recorded_dates = {hr.hearing_date for hr in hearing_records}
        all_past = []
        future_hearings = []

        for hr in hearing_records:
            h_date = hr.hearing_date
            item = {
                "date": str(h_date),
                "hearing_date_obj": h_date,
                "hearing_type": hr.hearing_type or "Regular Hearing",
                "court": hr.court or case.court or "",
                "outcome": hr.outcome or "",
            }
            if h_date <= today:
                all_past.append(item)
            else:
                future_hearings.append(item)

            if hr.next_hearing_date and hr.next_hearing_date >= today:
                future_hearings.append({
                    "date": str(hr.next_hearing_date),
                    "hearing_date_obj": hr.next_hearing_date,
                    "hearing_type": "Scheduled Hearing",
                    "court": hr.court or case.court or "",
                    "bench": getattr(case, "bench", "") or "",
                    "outcome": "",
                })

        for proc in proceedings:
            p_date = proc.event_date
            if p_date not in recorded_dates:
                item = {
                    "date": str(p_date),
                    "hearing_date_obj": p_date,
                    "hearing_type": proc.event_type or "Court Proceeding",
                    "court": proc.court_name or case.court or "",
                    "outcome": proc.notes or "",
                }
                if p_date <= today:
                    all_past.append(item)
                else:
                    future_hearings.append(item)

            if proc.next_hearing_date and proc.next_hearing_date >= today:
                future_hearings.append({
                    "date": str(proc.next_hearing_date),
                    "hearing_date_obj": proc.next_hearing_date,
                    "hearing_type": "Scheduled Hearing",
                    "court": proc.court_name or case.court or "",
                    "bench": proc.bench or "",
                    "outcome": "",
                })

        # Sort past hearings descending (most recent first)
        all_past.sort(key=lambda x: x["hearing_date_obj"], reverse=True)
        # Sort future hearings ascending (next upcoming first)
        future_hearings.sort(key=lambda x: x["hearing_date_obj"])

        most_recent_dict = None
        if all_past:
            m = all_past[0]
            most_recent_dict = {
                "date": m["date"],
                "days_ago": max(0, (today - m["hearing_date_obj"]).days),
                "hearing_type": m["hearing_type"],
                "court": m["court"],
                "outcome": m["outcome"],
            }

        next_dict = None
        if future_hearings:
            n = future_hearings[0]
            next_dict = {
                "date": n["date"],
                "days_until": max(0, (n["hearing_date_obj"] - today).days),
                "hearing_type": n["hearing_type"],
                "court": n["court"],
                "bench": n.get("bench", ""),
            }

        past_dates = {item["date"] for item in all_past}
        future_dates = {item["date"] for item in future_hearings}
        total_unique_dates = past_dates | future_dates

        # Frequency between hearings if >= 2 past hearings
        average_days_between_hearings = None
        hearing_frequency_description = None
        if len(past_dates) >= 2:
            sorted_dates = sorted([date.fromisoformat(d) for d in past_dates])
            span = (sorted_dates[-1] - sorted_dates[0]).days
            avg = round(span / (len(sorted_dates) - 1), 1)
            average_days_between_hearings = avg
            hearing_frequency_description = f"~{int(round(avg))} days between hearings"

        return {
            "total_hearings": len(total_unique_dates),
            "completed_hearings_count": len(past_dates),
            "upcoming_hearings_count": len(future_dates),
            "has_hearings": len(total_unique_dates) > 0,
            "most_recent_hearing": most_recent_dict,
            "next_scheduled_hearing": next_dict,
            "average_days_between_hearings": average_days_between_hearings,
            "hearing_frequency_description": hearing_frequency_description,
        }
