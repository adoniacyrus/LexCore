from django.utils import timezone
from apps.accounts.models import UserRole
from apps.cases.models import (
    Case,
    CaseStatus,
    MatterCategory,
    MatterStage,
    HearingRecord,
    CourtProceeding,
)


class CaseTimelineService:
    """
    Constructs a unified, chronological Case Timeline and visual Progress Tracker
    dynamically from existing database records (Case, Consultation, HearingRecord,
    CourtProceeding, and CaseActivity).

    Strictly adheres to:
    - No duplicate data storage.
    - Zero historical invention (events only generated from actual records).
    - Strict role-based visibility: clients never see internal lawyer notes,
      confidential staff assignments, or billing modifications.
    """

    EVENT_PRIORITY = {
        "CONSULTATION": 1,
        "CASE_CREATED": 2,
        "COURT_FILING": 3,
        "STAGE_CHANGED": 4,
        "STATUS_CHANGED": 5,
        "INTERNAL_ACTIVITY": 6,
        "PROCEEDING": 7,
        "HEARING": 8,
        "UPCOMING_HEARING": 9,
        "CASE_CLOSED": 10,
    }

    @classmethod
    def get_stage_pipeline(cls, case: Case):
        """
        Builds the ordered milestone stages for the case's category and identifies
        the current, completed, and upcoming stages.
        """
        # Determine standard stages sequence based on matter category
        category = case.matter_category
        if category in (MatterCategory.POLICE_MATTER,):
            stages_def = [
                ("CONSULTATION", "Consultation & Intake"),
                ("UNDER_REVIEW", "Review & Investigation"),
                ("FIR_REGISTERED", "FIR Registered"),
                ("COURT_PROCEEDINGS", "Court Proceedings"),
                ("RESOLVED", "Resolution"),
                ("CLOSED", "Closed"),
            ]
        elif category in (MatterCategory.LEGAL_NOTICE, MatterCategory.MEDIATION):
            stages_def = [
                ("CONSULTATION", "Consultation & Intake"),
                ("UNDER_REVIEW", "Review & Drafting"),
                ("NOTICE_ISSUED", "Notice / Mediation"),
                ("SETTLEMENT", "Settlement Negotiation"),
                ("RESOLVED", "Resolution"),
                ("CLOSED", "Closed"),
            ]
        elif category in (MatterCategory.ADVISORY, MatterCategory.DOCUMENTATION, MatterCategory.COMPLIANCE, MatterCategory.RETAINER):
            stages_def = [
                ("CONSULTATION", "Consultation & Intake"),
                ("UNDER_REVIEW", "Review & Analysis"),
                ("PRE_LITIGATION", "Drafting & Execution"),
                ("RESOLVED", "Final Delivery"),
                ("CLOSED", "Closed"),
            ]
        else:
            # Standard Litigation / Court proceedings / Default
            stages_def = [
                ("CONSULTATION", "Consultation & Intake"),
                ("UNDER_REVIEW", "Case Review"),
                ("PRE_LITIGATION", "Pre-Litigation"),
                ("COURT_PROCEEDINGS", "Court Proceedings"),
                ("RESOLVED", "Resolution"),
                ("CLOSED", "Closed"),
            ]

        # Make sure current stage is in the pipeline list if it is specialized (e.g. APPEAL_PROCEEDINGS)
        stage_keys = [s[0] for s in stages_def]
        if case.matter_stage not in stage_keys:
            # Insert before RESOLVED/CLOSED
            insert_idx = len(stages_def) - 2 if len(stages_def) >= 2 else 0
            stages_def.insert(insert_idx, (case.matter_stage, case.get_matter_stage_display()))
            stage_keys = [s[0] for s in stages_def]

        # Find current stage index
        current_idx = -1
        try:
            current_idx = stage_keys.index(case.matter_stage)
        except ValueError:
            current_idx = 0

        is_case_closed = (case.status == CaseStatus.CLOSED or case.matter_stage in (MatterStage.CLOSED, MatterStage.ARCHIVED))

        pipeline = []
        for idx, (key, label) in enumerate(stages_def):
            if is_case_closed:
                step_status = "completed"
                is_current = (key == "CLOSED" or (idx == current_idx and case.matter_stage == key))
            elif idx < current_idx:
                step_status = "completed"
                is_current = False
            elif idx == current_idx:
                step_status = "current"
                is_current = True
            else:
                step_status = "upcoming"
                is_current = False

            pipeline.append({
                "key": key,
                "label": label,
                "status": step_status,
                "is_current": is_current,
                "step_number": idx + 1,
            })

        return pipeline

    @classmethod
    def get_timeline(cls, case: Case, user) -> dict:
        today = timezone.localdate()
        is_client = getattr(user, "role", None) == UserRole.CLIENT

        events = []

        # 1. Originating Consultation (if present)
        if hasattr(case, "originating_consultation") and case.originating_consultation:
            consultation = case.originating_consultation
            cons_date = getattr(consultation, "preferred_date", None) or consultation.created_at.date()
            lawyer_name = case.responsible_lawyer.full_name if case.responsible_lawyer else "Lead Advocate"
            practice_name = case.practice_area.name if case.practice_area else "General Practice"
            events.append({
                "id": f"intake-{consultation.id}",
                "event_type": "CONSULTATION",
                "date": str(cons_date),
                "title": "Consultation & Matter Intake",
                "description": f"Initial consultation ({consultation.consultation_id}) conducted with {lawyer_name} under {practice_name}.",
                "state": "COMPLETED",
                "court": "",
                "metadata": {
                    "consultation_id": consultation.consultation_id,
                    "mode": getattr(consultation, "consultation_mode", "OFFICE"),
                },
            })

        # 2. Case Formally Opened / Created
        events.append({
            "id": f"case-created-{case.id}",
            "event_type": "CASE_CREATED",
            "date": str(case.start_date),
            "title": "Case Formally Opened",
            "description": f"Formal case {case.case_reference} initiated: \"{case.title}\".",
            "state": "COMPLETED",
            "court": case.court or "",
            "metadata": {
                "case_reference": case.case_reference,
                "case_type": case.get_case_type_display(),
            },
        })

        # 3. Court Filing & Registration (ONLY if real numbers exist)
        has_filing_numbers = bool(case.filing_number or case.registration_number or case.cnr_number)
        if has_filing_numbers:
            filing_parts = []
            if case.court:
                filing_parts.append(f"Court: {case.court}")
            if case.filing_number:
                filing_parts.append(f"Filing No: {case.filing_number}")
            if case.registration_number:
                filing_parts.append(f"Reg No: {case.registration_number}")
            if case.cnr_number:
                filing_parts.append(f"CNR: {case.cnr_number}")

            events.append({
                "id": f"filing-{case.id}",
                "event_type": "COURT_FILING",
                "date": str(case.start_date),
                "title": "Court Filing & Registration",
                "description": " • ".join(filing_parts),
                "state": "COMPLETED",
                "court": case.court or "",
                "metadata": {
                    "filing_number": case.filing_number,
                    "registration_number": case.registration_number,
                    "cnr_number": case.cnr_number,
                    "official_court_reference": case.official_court_reference,
                },
            })

        # 4. Case Activities (Stage & Status changes, plus staff assignments for staff only)
        # Note: hearing activities are excluded here because HearingRecord entries provide richer data.
        excluded_activity_types = {"HEARING_RECORDED", "HEARING_UPDATED", "HEARING_DELETED"}
        activities = case.activities.exclude(activity_type__in=excluded_activity_types).order_by("created_at")

        for act in activities:
            act_date = act.created_at.date()
            if act.activity_type == "STAGE_CHANGED":
                events.append({
                    "id": f"act-{act.id}",
                    "event_type": "STAGE_CHANGED",
                    "date": str(act_date),
                    "title": "Matter Stage Updated",
                    "description": act.description,
                    "state": "COMPLETED",
                    "court": "",
                    "metadata": {"activity_type": act.activity_type},
                })
            elif act.activity_type == "STATUS_CHANGED":
                events.append({
                    "id": f"act-{act.id}",
                    "event_type": "STATUS_CHANGED",
                    "date": str(act_date),
                    "title": "Case Status Updated",
                    "description": act.description,
                    "state": "COMPLETED",
                    "court": "",
                    "metadata": {"activity_type": act.activity_type},
                })
            elif not is_client and act.activity_type in (
                "SUPERVISING_COUNSEL_ASSIGNED",
                "SUPERVISING_COUNSEL_CHANGED",
                "ASSISTANT_LAWYER_ADDED",
                "ASSISTANT_LAWYER_REMOVED",
                "FEE_CHANGED",
            ):
                events.append({
                    "id": f"act-{act.id}",
                    "event_type": "INTERNAL_ACTIVITY",
                    "date": str(act_date),
                    "title": "Team & Practice Milestone",
                    "description": act.description,
                    "state": "COMPLETED",
                    "court": "",
                    "metadata": {"activity_type": act.activity_type},
                })

        # 5. Hearing Records
        hearing_records = case.hearing_records.all().order_by("hearing_date", "created_at")
        recorded_dates = set()
        future_hearing_dates = set()

        for hr in hearing_records:
            recorded_dates.add(hr.hearing_date)
            if hr.hearing_date < today:
                hr_state = "COMPLETED"
            elif hr.hearing_date == today:
                hr_state = "CURRENT"
            else:
                hr_state = "UPCOMING"

            # Construct concise, informative description
            desc_items = []
            if hr.outcome:
                desc_items.append(f"Outcome: {hr.outcome}")
            if hr.orders_or_directions:
                desc_items.append(f"Orders: {hr.orders_or_directions}")
            elif hr.proceedings:
                desc_items.append(f"Proceedings: {hr.proceedings}")

            desc = " — ".join(desc_items) if desc_items else f"Court hearing held on {hr.hearing_date}."

            events.append({
                "id": f"hearing-{hr.hearing_id}",
                "event_type": "HEARING",
                "date": str(hr.hearing_date),
                "title": f"Court Hearing: {hr.hearing_type or 'Regular Hearing'}",
                "description": desc,
                "state": hr_state,
                "court": hr.court or case.court or "",
                "metadata": {
                    "hearing_id": hr.hearing_id,
                    "hearing_type": hr.hearing_type,
                    "outcome": hr.outcome,
                    "next_hearing_date": str(hr.next_hearing_date) if hr.next_hearing_date else None,
                },
            })

            if hr.next_hearing_date and hr.next_hearing_date >= today:
                future_hearing_dates.add(hr.next_hearing_date)

        # 6. Legacy / Proceeding Records (if any have event_date not already recorded)
        proceedings = case.proceedings.all().order_by("event_date", "created_at")
        for proc in proceedings:
            if proc.event_date not in recorded_dates:
                if proc.event_date < today:
                    p_state = "COMPLETED"
                elif proc.event_date == today:
                    p_state = "CURRENT"
                else:
                    p_state = "UPCOMING"

                events.append({
                    "id": f"proc-{proc.id}",
                    "event_type": "PROCEEDING",
                    "date": str(proc.event_date),
                    "title": f"Court Proceeding: {proc.event_type}",
                    "description": proc.notes or f"Proceeding before {proc.court_name}.",
                    "state": p_state,
                    "court": proc.court_name or "",
                    "metadata": {
                        "bench": proc.bench,
                        "next_hearing_date": str(proc.next_hearing_date) if proc.next_hearing_date else None,
                    },
                })
            if proc.next_hearing_date and proc.next_hearing_date >= today:
                future_hearing_dates.add(proc.next_hearing_date)

        # 7. Next Scheduled Hearing (Upcoming Date not yet having a record)
        for fut_date in sorted(future_hearing_dates):
            if fut_date not in recorded_dates:
                events.append({
                    "id": f"upcoming-{fut_date}",
                    "event_type": "UPCOMING_HEARING",
                    "date": str(fut_date),
                    "title": "Scheduled Court Hearing",
                    "description": f"Scheduled proceedings before {case.court or 'the designated Court'}.",
                    "state": "UPCOMING",
                    "court": case.court or "",
                    "metadata": {
                        "next_hearing_date": str(fut_date),
                    },
                })

        # 8. Case Closure (if closed and not already captured by STATUS_CHANGED activity)
        if case.status == CaseStatus.CLOSED or case.matter_stage == MatterStage.CLOSED:
            has_closed_act = any(
                e["event_type"] == "STATUS_CHANGED" and "Closed" in e["description"]
                for e in events
            )
            if not has_closed_act:
                events.append({
                    "id": f"closure-{case.id}",
                    "event_type": "CASE_CLOSED",
                    "date": str(case.updated_at.date()),
                    "title": "Case Concluded & Closed",
                    "description": f"Case {case.case_reference} has formally completed all legal proceedings.",
                    "state": "COMPLETED",
                    "court": "",
                    "metadata": {},
                })

        # Chronological sort: by date ascending, then event priority
        events.sort(key=lambda x: (x["date"], cls.EVENT_PRIORITY.get(x["event_type"], 99)))

        # Pipeline progress
        pipeline = cls.get_stage_pipeline(case)

        return {
            "case_reference": case.case_reference,
            "title": case.title,
            "current_stage": case.matter_stage,
            "current_stage_label": case.get_matter_stage_display(),
            "status": case.status,
            "status_label": case.get_status_display(),
            "matter_category": case.matter_category,
            "matter_category_label": case.get_matter_category_display(),
            "court": case.court,
            "has_hearings": len(hearing_records) > 0,
            "total_hearings": len(hearing_records),
            "pipeline": pipeline,
            "events": events,
        }
