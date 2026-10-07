"""
Case PDF generation service for LexCore Legal Management System.
Generates comprehensive, court-grade Case Summary & Audit Dossier documents
including case overview, parties, court details, fee records, proceedings,
tasks, documents index, and complete activity history.
"""

import io
import html
from decimal import Decimal
from django.utils import timezone
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    HRFlowable,
)
from reportlab.pdfgen import canvas

from apps.payments.models import Payment, PaymentStatus
from apps.consultations.models import ConsultationType


class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute and print total page count,
    running top header (from page 2 onwards), and confidential running footer.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_decorations(self, total_pages):
        self.saveState()
        page_w, page_h = A4
        margin = 36

        # Running Header on page 2+
        if self._pageNumber > 1:
            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(colors.HexColor("#591722"))
            self.drawString(margin, page_h - 28, "LEXCORE ADVOCATES & LEGAL CONSULTANTS")
            self.setFont("Helvetica", 8)
            self.setFillColor(colors.HexColor("#64748b"))
            ref_str = getattr(self, "case_ref_str", "CASE DOSSIER")
            self.drawRightString(page_w - margin, page_h - 28, f"Official Case Record — {ref_str}")

            self.setStrokeColor(colors.HexColor("#e2e8f0"))
            self.setLineWidth(0.6)
            self.line(margin, page_h - 32, page_w - margin, page_h - 32)

        # Running Footer (all pages)
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.6)
        self.line(margin, 36, page_w - margin, 36)

        self.setFont("Helvetica", 7.5)
        self.setFillColor(colors.HexColor("#64748b"))
        self.drawString(
            margin,
            24,
            "CONFIDENTIAL & ATTORNEY-CLIENT PRIVILEGED  |  LexCore Legal Management System"
        )
        self.drawRightString(
            page_w - margin,
            24,
            f"Page {self._pageNumber} of {total_pages}"
        )
        self.restoreState()


class CasePDFService:
    """Service to render comprehensive Case Summary Report in PDF format."""

    PRIMARY_COLOR = colors.HexColor("#591722")      # LexCore Burgundy
    PRIMARY_LIGHT = colors.HexColor("#f8eff1")
    GOLD_ACCENT = colors.HexColor("#855b1b")        # LexCore Amber/Gold
    GOLD_LIGHT = colors.HexColor("#faf5ec")
    TEXT_DARK = colors.HexColor("#0f172a")
    TEXT_MUTED = colors.HexColor("#475569")
    BORDER_COLOR = colors.HexColor("#cbd5e1")
    BG_LIGHT = colors.HexColor("#f8fafc")
    BG_WHITE = colors.white
    SUCCESS_COLOR = colors.HexColor("#15803d")
    WARNING_COLOR = colors.HexColor("#b45309")

    @classmethod
    def _safe_escape(cls, text) -> str:
        """Escape HTML characters to prevent ReportLab XML errors."""
        if text is None:
            return ""
        return html.escape(str(text))

    @classmethod
    def _format_date(cls, dt_val) -> str:
        if not dt_val:
            return "—"
        if hasattr(dt_val, "strftime"):
            return dt_val.strftime("%b %d, %Y")
        return str(dt_val)

    @classmethod
    def _format_datetime(cls, dt_val) -> str:
        if not dt_val:
            return "—"
        if hasattr(dt_val, "strftime"):
            # Format in local time
            try:
                local_dt = timezone.localtime(dt_val)
                return local_dt.strftime("%b %d, %Y %I:%M %p")
            except Exception:
                return dt_val.strftime("%b %d, %Y %I:%M %p")
        return str(dt_val)

    @classmethod
    def _format_rupees(cls, amount) -> str:
        if amount is None:
            return "₹ 0.00"
        try:
            return f"₹ {Decimal(str(amount)):,.2f}"
        except Exception:
            return f"₹ {amount}"

    @classmethod
    def generate_case_pdf(cls, case, requesting_user=None) -> bytes:
        """
        Builds a comprehensive case dossier PDF including all case information,
        court filings, assigned legal personnel, fees collected till now,
        proceedings, tasks, documents, and historical activity timeline.
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=36,
            rightMargin=36,
            topMargin=42,
            bottomMargin=45,
        )

        usable_w = A4[0] - 72  # 523.27 pt

        styles = getSampleStyleSheet()

        # Custom Typography
        style_title = ParagraphStyle(
            "CaseReportTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=20,
            textColor=cls.PRIMARY_COLOR,
        )
        style_subtitle = ParagraphStyle(
            "CaseReportSubTitle",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=cls.TEXT_MUTED,
        )
        style_heading = ParagraphStyle(
            "CaseReportHeading",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=cls.PRIMARY_COLOR,
            spaceAfter=4,
        )
        style_body = ParagraphStyle(
            "CaseReportBody",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11.5,
            textColor=cls.TEXT_DARK,
        )
        style_body_bold = ParagraphStyle(
            "CaseReportBodyBold",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=11.5,
            textColor=cls.TEXT_DARK,
        )
        style_label = ParagraphStyle(
            "CaseReportLabel",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=cls.TEXT_MUTED,
        )
        style_val = ParagraphStyle(
            "CaseReportVal",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11.5,
            textColor=cls.TEXT_DARK,
        )
        style_th = ParagraphStyle(
            "CaseReportTH",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=colors.white,
        )
        style_td = ParagraphStyle(
            "CaseReportTD",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=10.5,
            textColor=cls.TEXT_DARK,
        )
        style_td_bold = ParagraphStyle(
            "CaseReportTDBold",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10.5,
            textColor=cls.TEXT_DARK,
        )

        elements = []

        # ---------------------------------------------------------
        # 1. HEADER BANNER & FIRM BRANDING
        # ---------------------------------------------------------
        now_str = cls._format_datetime(timezone.now())
        req_user_str = (
            f"{cls._safe_escape(requesting_user.full_name)} ({cls._safe_escape(requesting_user.get_role_display())})"
            if requesting_user
            else "System Generated"
        )

        header_data = [
            [
                Paragraph("<b>LEXCORE ADVOCATES & LEGAL CONSULTANTS</b>", style_title),
                Paragraph(f"<b>Dossier Date:</b> {now_str}", style_val),
            ],
            [
                Paragraph("Official Case Summary & Master Audit Report", style_subtitle),
                Paragraph(f"<b>Generated By:</b> {req_user_str}", style_val),
            ],
        ]
        t_header = Table(header_data, colWidths=[330, usable_w - 330])
        t_header.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
            ("TOPPADDING", (0, 0), (-1, -1), 1),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ]))
        elements.append(t_header)

        elements.append(Spacer(1, 6))
        elements.append(HRFlowable(width="100%", thickness=1.5, color=cls.PRIMARY_COLOR, spaceBefore=2, spaceAfter=8))

        # Case Reference Callout Card
        ref_badge = f"<font color='#591722'><b>{cls._safe_escape(case.case_reference)}</b></font>"
        status_color = "#15803d" if case.status == "OPEN" else "#64748b"
        status_badge = f"<font color='{status_color}'><b>{cls._safe_escape(case.get_status_display())}</b></font>"
        cat_badge = cls._safe_escape(case.get_matter_category_display())
        stage_badge = cls._safe_escape(case.get_matter_stage_display())

        callout_data = [
            [
                Paragraph(f"CASE REFERENCE: <b>{ref_badge}</b>", style_heading),
                Paragraph(f"STATUS: <b>{status_badge}</b>", style_body_bold),
            ],
            [
                Paragraph(f"<b>Title:</b> {cls._safe_escape(case.title)}", style_body_bold),
                Paragraph(f"<b>Category:</b> {cat_badge} &nbsp;|&nbsp; <b>Stage:</b> {stage_badge}", style_body),
            ]
        ]
        t_callout = Table(callout_data, colWidths=[310, usable_w - 310])
        t_callout.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), cls.PRIMARY_LIGHT),
            ("BOX", (0, 0), (-1, -1), 0.75, cls.PRIMARY_COLOR),
            ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2d8dc")),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ("ALIGN", (1, 1), (1, 1), "RIGHT"),
        ]))
        elements.append(t_callout)
        elements.append(Spacer(1, 10))

        # ---------------------------------------------------------
        # 2. CASE MATTER & PARTIES INFORMATION
        # ---------------------------------------------------------
        elements.append(Paragraph("1. Case Matter & Client Overview", style_heading))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=cls.GOLD_ACCENT, spaceBefore=1, spaceAfter=5))

        client_user = case.client
        client_phone = getattr(client_user, "phone_number", "") or "Not Provided"
        practice_name = case.practice_area.name if case.practice_area else "General Practice"
        orig_ref = (
            case.originating_consultation.consultation_id
            if case.originating_consultation
            else "Direct Case"
        )

        overview_data = [
            [
                Paragraph("<b>Client Name:</b>", style_label),
                Paragraph(cls._safe_escape(client_user.full_name if client_user else "—"), style_val),
                Paragraph("<b>Practice Area:</b>", style_label),
                Paragraph(cls._safe_escape(practice_name), style_val),
            ],
            [
                Paragraph("<b>Client Email:</b>", style_label),
                Paragraph(cls._safe_escape(client_user.email if client_user else "—"), style_val),
                Paragraph("<b>Originating Consultation:</b>", style_label),
                Paragraph(cls._safe_escape(orig_ref), style_val),
            ],
            [
                Paragraph("<b>Client Contact:</b>", style_label),
                Paragraph(cls._safe_escape(client_phone), style_val),
                Paragraph("<b>Commencement Date:</b>", style_label),
                Paragraph(cls._format_date(case.start_date), style_val),
            ],
            [
                Paragraph("<b>Matter Type:</b>", style_label),
                Paragraph(cls._safe_escape(case.get_case_type_display()), style_val),
                Paragraph("<b>Date Opened:</b>", style_label),
                Paragraph(cls._format_date(case.created_at), style_val),
            ],
        ]

        if case.description:
            overview_data.append([
                Paragraph("<b>Description:</b>", style_label),
                Paragraph(cls._safe_escape(case.description), style_val),
                Paragraph("", style_label),
                Paragraph("", style_val),
            ])

        t_overview = Table(overview_data, colWidths=[90, 171, 100, 162])
        t_overview_style = [
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("BACKGROUND", (0, 0), (-1, -1), cls.BG_LIGHT),
            ("BOX", (0, 0), (-1, -1), 0.5, cls.BORDER_COLOR),
            ("INNERGRID", (0, 0), (-1, -1), 0.3, cls.BORDER_COLOR),
        ]
        if case.description:
            t_overview_style.append(("SPAN", (1, 4), (3, 4)))
        t_overview.setStyle(TableStyle(t_overview_style))
        elements.append(t_overview)
        elements.append(Spacer(1, 10))

        # ---------------------------------------------------------
        # 3. LEGAL TEAM & COURT JURISDICTION
        # ---------------------------------------------------------
        elements.append(Paragraph("2. Assigned Legal Team & Official Court Details", style_heading))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=cls.GOLD_ACCENT, spaceBefore=1, spaceAfter=5))

        resp_lawyer = case.responsible_lawyer
        sup_lawyer = case.supervising_lawyer
        paralegal = case.supporting_paralegal
        assistants = list(case.assistant_lawyers.all())
        assistants_str = ", ".join([a.full_name for a in assistants]) if assistants else "None Assigned"

        court_name = case.court or "Not Registered / Pre-litigation"
        jurisdiction = case.jurisdiction or "—"
        bench = case.bench or "—"
        cnr_num = case.cnr_number or "—"
        filing_num = case.filing_number or "—"
        reg_num = case.registration_number or "—"
        court_ref = case.official_court_reference or "—"

        legal_court_data = [
            [
                Paragraph("<b>LEGAL TEAM ALLOCATION</b>", style_body_bold),
                "",
                Paragraph("<b>OFFICIAL COURT REGISTRY</b>", style_body_bold),
                "",
            ],
            [
                Paragraph("<b>Lead Counsel:</b>", style_label),
                Paragraph(cls._safe_escape(resp_lawyer.full_name if resp_lawyer else "—"), style_val),
                Paragraph("<b>Court Name:</b>", style_label),
                Paragraph(cls._safe_escape(court_name), style_val),
            ],
            [
                Paragraph("<b>Supervising:</b>", style_label),
                Paragraph(cls._safe_escape(sup_lawyer.full_name if sup_lawyer else "None"), style_val),
                Paragraph("<b>Jurisdiction / Bench:</b>", style_label),
                Paragraph(cls._safe_escape(f"{jurisdiction} / {bench}"), style_val),
            ],
            [
                Paragraph("<b>Paralegal:</b>", style_label),
                Paragraph(cls._safe_escape(paralegal.full_name if paralegal else "None"), style_val),
                Paragraph("<b>CNR Number:</b>", style_label),
                Paragraph(cls._safe_escape(cnr_num), style_val),
            ],
            [
                Paragraph("<b>Assistant Advocates:</b>", style_label),
                Paragraph(cls._safe_escape(assistants_str), style_val),
                Paragraph("<b>Filing / Reg No:</b>", style_label),
                Paragraph(cls._safe_escape(f"{filing_num} / {reg_num}"), style_val),
            ],
        ]

        t_legal_court = Table(legal_court_data, colWidths=[90, 171, 100, 162])
        t_legal_court.setStyle(TableStyle([
            ("SPAN", (0, 0), (1, 0)),
            ("SPAN", (2, 0), (3, 0)),
            ("BACKGROUND", (0, 0), (1, 0), cls.GOLD_LIGHT),
            ("BACKGROUND", (2, 0), (3, 0), cls.GOLD_LIGHT),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("BOX", (0, 0), (-1, -1), 0.5, cls.BORDER_COLOR),
            ("INNERGRID", (0, 0), (-1, -1), 0.3, cls.BORDER_COLOR),
        ]))
        elements.append(t_legal_court)
        elements.append(Spacer(1, 10))

        # ---------------------------------------------------------
        # 4. COMPREHENSIVE FINANCIAL SUMMARY & FEES COLLECTED TILL NOW
        # ---------------------------------------------------------
        elements.append(Paragraph("3. Financial Statement & Fees Collected Till Now", style_heading))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=cls.GOLD_ACCENT, spaceBefore=1, spaceAfter=5))

        # Collect all payments related to this case:
        # A) Originating consultation payments
        # B) Case appointments consultations payments
        orig_cons = case.originating_consultation
        all_case_consultations = []
        if orig_cons:
            all_case_consultations.append((orig_cons, "Originating Consultation"))

        for ca in case.case_appointments.all().order_by("preferred_date", "preferred_time"):
            all_case_consultations.append((ca, f"Case Appointment: {ca.subject or ca.consultation_id}"))

        total_collected = Decimal("0.00")
        total_pending = Decimal("0.00")
        payment_rows = []

        for cons, purpose in all_case_consultations:
            payments = cons.payments.all().order_by("created_at")
            if payments.exists():
                for p in payments:
                    amt = p.amount_rupees
                    if p.status == PaymentStatus.CAPTURED:
                        total_collected += amt
                    elif p.status in (PaymentStatus.PENDING, PaymentStatus.AUTHORIZED):
                        total_pending += amt

                    p_date = cls._format_datetime(p.paid_at or p.created_at)
                    tx_id = p.razorpay_payment_id or p.razorpay_order_id or f"TXN-{p.id}"
                    status_lbl = p.get_status_display()
                    status_style = style_td_bold if p.status == PaymentStatus.CAPTURED else style_td

                    payment_rows.append([
                        Paragraph(p_date, style_td),
                        Paragraph(cls._safe_escape(purpose), style_td),
                        Paragraph(cls._safe_escape(tx_id), style_td),
                        Paragraph(cls._safe_escape(cons.consultation_id), style_td),
                        Paragraph(cls._safe_escape(status_lbl), status_style),
                        Paragraph(cls._format_rupees(amt), style_td_bold),
                    ])
            else:
                # Consultation recorded fee but no payment row yet
                if cons.charged_fee:
                    if cons.payment_status == "PAID":
                        total_collected += cons.charged_fee
                        p_status = "Paid (Direct)"
                    else:
                        total_pending += cons.charged_fee
                        p_status = "Payment Pending"
                    payment_rows.append([
                        Paragraph(cls._format_datetime(cons.created_at), style_td),
                        Paragraph(cls._safe_escape(purpose), style_td),
                        Paragraph("Offline / Direct Fee", style_td),
                        Paragraph(cls._safe_escape(cons.consultation_id), style_td),
                        Paragraph(p_status, style_td),
                        Paragraph(cls._format_rupees(cons.charged_fee), style_td_bold),
                    ])

        # Financial Highlights Box
        appt_fee_str = cls._format_rupees(case.appointment_fee) if case.appointment_fee is not None else "Not Configured"
        fin_summary_data = [
            [
                Paragraph("<b>Total Fees Collected to Date:</b>", style_label),
                Paragraph(f"<font color='#15803d' size='10'><b>{cls._format_rupees(total_collected)}</b></font>", style_val),
                Paragraph("<b>Case Appointment Fee Rate:</b>", style_label),
                Paragraph(f"<b>{appt_fee_str}</b>", style_val),
            ],
            [
                Paragraph("<b>Total Pending / Outstanding:</b>", style_label),
                Paragraph(f"<font color='#b45309'><b>{cls._format_rupees(total_pending)}</b></font>", style_val),
                Paragraph("<b>Payment Method / Gateway:</b>", style_label),
                Paragraph("Razorpay Online Checkout / Firm Account", style_val),
            ],
        ]
        t_fin_summary = Table(fin_summary_data, colWidths=[130, 131, 130, 132])
        t_fin_summary.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f0fdf4")),
            ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#86efac")),
            ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#bbf7d0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(t_fin_summary)
        elements.append(Spacer(1, 5))

        # Payment Ledger Table
        if payment_rows:
            pay_table_data = [
                [
                    Paragraph("Date & Time", style_th),
                    Paragraph("Purpose / Service Item", style_th),
                    Paragraph("Transaction / Reference ID", style_th),
                    Paragraph("Consultation ID", style_th),
                    Paragraph("Status", style_th),
                    Paragraph("Amount", style_th),
                ]
            ] + payment_rows

            t_payments = Table(pay_table_data, colWidths=[90, 130, 110, 75, 55, 63])
            t_payments.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), cls.PRIMARY_COLOR),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("BOX", (0, 0), (-1, -1), 0.5, cls.BORDER_COLOR),
                ("INNERGRID", (0, 0), (-1, -1), 0.3, cls.BORDER_COLOR),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [cls.BG_WHITE, cls.BG_LIGHT]),
                ("ALIGN", (5, 0), (5, -1), "RIGHT"),
            ]))
            elements.append(t_payments)
        else:
            elements.append(Paragraph("<i>No fee transactions recorded for this case matter to date.</i>", style_body))

        elements.append(Spacer(1, 10))

        # ---------------------------------------------------------
        # 5. COURT PROCEEDINGS & HEARINGS
        # ---------------------------------------------------------
        proceedings = list(case.proceedings.all().order_by("-event_date", "-created_at"))
        elements.append(Paragraph(f"4. Court Proceedings & Scheduled Hearings ({len(proceedings)})", style_heading))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=cls.GOLD_ACCENT, spaceBefore=1, spaceAfter=5))

        if proceedings:
            proc_table_data = [
                [
                    Paragraph("Event Date", style_th),
                    Paragraph("Event Type", style_th),
                    Paragraph("Court & Bench", style_th),
                    Paragraph("Next Hearing Date", style_th),
                    Paragraph("Hearing Status", style_th),
                    Paragraph("Notes / Directives", style_th),
                ]
            ]
            for p in proceedings:
                next_dt = cls._format_date(p.next_hearing_date) if p.next_hearing_date else "—"
                h_status = p.hearing_status or "—"
                bench_info = f"{p.court_name}" + (f" ({p.bench})" if p.bench else "")
                notes_text = cls._safe_escape(p.notes or "—")

                proc_table_data.append([
                    Paragraph(cls._format_date(p.event_date), style_td),
                    Paragraph(cls._safe_escape(p.event_type), style_td_bold),
                    Paragraph(cls._safe_escape(bench_info), style_td),
                    Paragraph(next_dt, style_td),
                    Paragraph(cls._safe_escape(h_status), style_td),
                    Paragraph(notes_text, style_td),
                ])

            t_procs = Table(proc_table_data, colWidths=[65, 85, 110, 75, 60, 128])
            t_procs.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), cls.PRIMARY_COLOR),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("BOX", (0, 0), (-1, -1), 0.5, cls.BORDER_COLOR),
                ("INNERGRID", (0, 0), (-1, -1), 0.3, cls.BORDER_COLOR),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [cls.BG_WHITE, cls.BG_LIGHT]),
            ]))
            elements.append(t_procs)
        else:
            elements.append(Paragraph("<i>No court proceedings or hearings recorded for this case matter.</i>", style_body))

        elements.append(Spacer(1, 10))

        # ---------------------------------------------------------
        # 6. TASKS & WORK PROGRESS
        # ---------------------------------------------------------
        tasks = list(case.tasks.all().order_by("due_date", "created_at"))
        elements.append(Paragraph(f"5. Tasks & Assigned Work Items ({len(tasks)})", style_heading))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=cls.GOLD_ACCENT, spaceBefore=1, spaceAfter=5))

        if tasks:
            tasks_table_data = [
                [
                    Paragraph("Task ID", style_th),
                    Paragraph("Title & Details", style_th),
                    Paragraph("Assigned To", style_th),
                    Paragraph("Due Date", style_th),
                    Paragraph("Status", style_th),
                    Paragraph("Completed On", style_th),
                ]
            ]
            for t in tasks:
                assignee = t.assigned_to.full_name if t.assigned_to else "—"
                due_str = cls._format_date(t.due_date)
                comp_str = cls._format_datetime(t.completed_at) if t.completed_at else "—"
                status_str = t.get_status_display()
                t_desc = f"<b>{cls._safe_escape(t.title)}</b>"
                if t.description:
                    t_desc += f"<br/><font color='#64748b' size='7'>{cls._safe_escape(t.description)}</font>"

                tasks_table_data.append([
                    Paragraph(cls._safe_escape(t.task_id), style_td),
                    Paragraph(t_desc, style_td),
                    Paragraph(cls._safe_escape(assignee), style_td),
                    Paragraph(due_str, style_td),
                    Paragraph(cls._safe_escape(status_str), style_td_bold),
                    Paragraph(comp_str, style_td),
                ])

            t_tasks = Table(tasks_table_data, colWidths=[70, 160, 95, 65, 65, 68])
            t_tasks.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), cls.PRIMARY_COLOR),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("BOX", (0, 0), (-1, -1), 0.5, cls.BORDER_COLOR),
                ("INNERGRID", (0, 0), (-1, -1), 0.3, cls.BORDER_COLOR),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [cls.BG_WHITE, cls.BG_LIGHT]),
            ]))
            elements.append(t_tasks)
        else:
            elements.append(Paragraph("<i>No tasks allocated for this case matter.</i>", style_body))

        elements.append(Spacer(1, 10))

        # ---------------------------------------------------------
        # 7. CASE DOCUMENTS & FILINGS
        # ---------------------------------------------------------
        documents = list(case.documents.all().order_by("-uploaded_at"))
        elements.append(Paragraph(f"6. Official Case Documents & Filings ({len(documents)})", style_heading))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=cls.GOLD_ACCENT, spaceBefore=1, spaceAfter=5))

        if documents:
            docs_table_data = [
                [
                    Paragraph("Document Title", style_th),
                    Paragraph("Category", style_th),
                    Paragraph("Uploaded By", style_th),
                    Paragraph("Date & Time", style_th),
                    Paragraph("Description / Notes", style_th),
                ]
            ]
            for d in documents:
                uploader = d.uploaded_by.full_name if d.uploaded_by else "—"
                d_date = cls._format_datetime(d.uploaded_at)
                cat_display = d.get_category_display()
                desc_text = cls._safe_escape(d.description or "—")

                docs_table_data.append([
                    Paragraph(cls._safe_escape(d.title), style_td_bold),
                    Paragraph(cls._safe_escape(cat_display), style_td),
                    Paragraph(cls._safe_escape(uploader), style_td),
                    Paragraph(d_date, style_td),
                    Paragraph(desc_text, style_td),
                ])

            t_docs = Table(docs_table_data, colWidths=[120, 95, 95, 90, 123])
            t_docs.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), cls.PRIMARY_COLOR),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("BOX", (0, 0), (-1, -1), 0.5, cls.BORDER_COLOR),
                ("INNERGRID", (0, 0), (-1, -1), 0.3, cls.BORDER_COLOR),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [cls.BG_WHITE, cls.BG_LIGHT]),
            ]))
            elements.append(t_docs)
        else:
            elements.append(Paragraph("<i>No documents filed for this case matter.</i>", style_body))

        elements.append(Spacer(1, 10))

        # ---------------------------------------------------------
        # 8. TIMELINE & COMPLETE CASE ACTIVITY / UPDATE HISTORY
        # ---------------------------------------------------------
        activities = list(case.activities.all().order_by("created_at"))
        elements.append(Paragraph(f"7. Chronological History & Activity Audit Trail ({len(activities)})", style_heading))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=cls.GOLD_ACCENT, spaceBefore=1, spaceAfter=5))

        if activities:
            act_table_data = [
                [
                    Paragraph("Timestamp", style_th),
                    Paragraph("Action / Event Type", style_th),
                    Paragraph("User / Author", style_th),
                    Paragraph("Details & Update Description", style_th),
                ]
            ]
            for act in activities:
                act_time = cls._format_datetime(act.created_at)
                user_desc = (
                    f"{act.user.full_name} ({act.user.get_role_display()})"
                    if act.user
                    else "System Automated"
                )
                act_type_clean = act.activity_type.replace("_", " ").title()

                act_table_data.append([
                    Paragraph(act_time, style_td),
                    Paragraph(cls._safe_escape(act_type_clean), style_td_bold),
                    Paragraph(cls._safe_escape(user_desc), style_td),
                    Paragraph(cls._safe_escape(act.description), style_td),
                ])

            t_act = Table(act_table_data, colWidths=[95, 105, 110, 213])
            t_act.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), cls.PRIMARY_COLOR),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("BOX", (0, 0), (-1, -1), 0.5, cls.BORDER_COLOR),
                ("INNERGRID", (0, 0), (-1, -1), 0.3, cls.BORDER_COLOR),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [cls.BG_WHITE, cls.BG_LIGHT]),
            ]))
            elements.append(t_act)
        else:
            elements.append(Paragraph("<i>No history or activities logged for this case matter yet.</i>", style_body))

        elements.append(Spacer(1, 15))

        # ---------------------------------------------------------
        # 9. OFFICIAL ATTESTATION & CLOSING
        # ---------------------------------------------------------
        attestation_text = (
            "<b>NOTICE OF PRIVILEGE & ACCURACY:</b> This case summary document contains confidential and "
            "attorney-client privileged information extracted directly from the LexCore Enterprise Legal Management System. "
            "Any unauthorized copying, disclosure, or distribution is strictly prohibited under the Advocates Act, 1961. "
            "For inquiries regarding this matter, contact the responsible advocate or chambers administration."
        )
        t_attest = Table([[Paragraph(attestation_text, style_body)]], colWidths=[usable_w])
        t_attest.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), cls.BG_LIGHT),
            ("BOX", (0, 0), (-1, -1), 0.5, cls.BORDER_COLOR),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ]))
        elements.append(KeepTogether(t_attest))

        # Build document with custom canvas
        def _make_canvas(*args, **kwargs):
            c = NumberedCanvas(*args, **kwargs)
            c.case_ref_str = case.case_reference
            return c

        doc.build(elements, canvasmaker=_make_canvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes
