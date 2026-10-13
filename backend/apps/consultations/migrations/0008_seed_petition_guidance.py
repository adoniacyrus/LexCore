"""
Data migration to seed Phase 1 Petition Filing Guidance master categories.
Provides structured informational guidance (overview, petition types, documents required,
process steps, preparation tips, disclaimers) linked to firm Practice Areas.
"""

from django.db import migrations

SEED_GUIDANCE = [
    {
        "title": "Civil Matters",
        "slug": "civil-matters",
        "practice_area_name": "Civil Law",
        "overview": (
            "Civil matters govern private disputes between individuals, businesses, or public bodies "
            "regarding personal rights, monetary claims, property possession, or contractual defaults. "
            "The primary legal objective is restitution, recovery of losses, compensation, or injunctive relief."
        ),
        "common_petition_types": [
            "Civil Suit for Recovery of Money (Summary or Ordinary Suit)",
            "Suit for Declaration of Title, Rights, and Ownership",
            "Application for Temporary or Permanent Injunction",
            "Suit for Specific Performance of Agreement",
            "Petition for Damages and Compensation",
        ],
        "documents_required": [
            "Government Identity Proof (Aadhaar, Passport, Voter ID, or PAN card)",
            "Proof of current residential or registered business address",
            "Original or certified copies of agreements, contracts, or undertakings",
            "Financial records demonstrating transaction or loss (bank statements, payment receipts, invoices)",
            "Written correspondence, emails, letters, and WhatsApp/text communication history",
            "Copy of any statutory or legal demand notice previously issued, with postal tracking receipts",
            "Written reply received from the respondent (if any)",
        ],
        "process_overview": [
            {
                "step": 1,
                "title": "Merit & Jurisdiction Assessment",
                "description": "Evaluating factual merits, pecuniary jurisdiction, territorial jurisdiction, and the applicable statutory limitation period.",
            },
            {
                "step": 2,
                "title": "Pre-Litigation Legal Notice",
                "description": "Issuing a formal statutory or demand notice granting the opposing party a stipulated period to comply or settle.",
            },
            {
                "step": 3,
                "title": "Pleading Preparation & Verification",
                "description": "Drafting the plaint, supporting affidavits, verifying statements of truth, and compiling the document index.",
            },
            {
                "step": 4,
                "title": "Court Filing & Registry Scrutiny",
                "description": "Paying court fees based on valuation, filing before registry, and curing any registry scrutiny objections.",
            },
            {
                "step": 5,
                "title": "Admission & Summons",
                "description": "Court admits the plaint and issues formal summons to the defendants to appear and file their written statements.",
            },
            {
                "step": 6,
                "title": "Trial, Evidence & Final Decree",
                "description": "Framing of issues, examination of witnesses, marking exhibits, oral arguments, culminating in final judgment and decree.",
            },
        ],
        "what_to_prepare": [
            "A chronological summary of events with approximate dates and key interactions",
            "Full legal names, designations, and contact addresses of all opposing parties",
            "Estimated financial loss or exact monetary sum being claimed",
            "Clear articulation of your primary desired outcome (e.g. monetary recovery, stay order, injunction)",
            "Summary of any prior compromise attempts or settlement negotiations",
        ],
        "disclaimer": (
            "This guidance is provided for general informational purposes only and does not "
            "constitute formal legal advice or create an advocate-client relationship. Civil procedures, "
            "court fees, and limitation periods depend upon specific statutory enactments and facts. "
            "Please consult our advocates for personalized assessment."
        ),
        "is_active": True,
        "display_order": 1,
    },
    {
        "title": "Criminal Matters",
        "slug": "criminal-matters",
        "practice_area_name": "Criminal Law",
        "overview": (
            "Criminal matters involve offenses against state penal laws or statutory provisions investigated "
            "by law enforcement authorities or initiated via private complaints before magistrates. "
            "Legal intervention is often time-critical, focusing on protecting constitutional liberties, obtaining bail, "
            "or preparing an evidentiary defense."
        ),
        "common_petition_types": [
            "Anticipatory Bail Application (Section 438 CrPC / BNSS)",
            "Regular Bail Application (Section 437 / 439 CrPC / BNSS)",
            "Private Criminal Complaint before Magistrate (Section 200 CrPC)",
            "Petition for Quashing of FIR / Charge Sheet under Section 482 CrPC",
            "Application for Discharge prior to Trial Framing",
        ],
        "documents_required": [
            "Copy of First Information Report (FIR) or Police Diary entry",
            "Copy of written complaint or notice received from police or court",
            "Arrest memo, remand application, or seizure memo (if available)",
            "Medical examination reports or injury certificates (if relevant)",
            "Alibi documentation (travel tickets, CCTV footage, electronic location records)",
            "Identity and address proofs of proposed sureties / family guarantors",
        ],
        "process_overview": [
            {
                "step": 1,
                "title": "Liberty Protection & Bail Strategy",
                "description": "Assessing arrest risk and filing anticipatory or regular bail before the Sessions Court or High Court.",
            },
            {
                "step": 2,
                "title": "Investigation Oversight",
                "description": "Cooperating with investigatory notices while safeguarding fundamental rights against self-incrimination.",
            },
            {
                "step": 3,
                "title": "Charge Sheet Scrutiny",
                "description": "Reviewing final police investigation report, witness statements, and forensic seizure memos.",
            },
            {
                "step": 4,
                "title": "Discharge or Framing of Charges",
                "description": "Arguing for discharge if no prima facie offense is established; otherwise framing formal defense strategy.",
            },
            {
                "step": 5,
                "title": "Trial & Cross-Examination",
                "description": "Cross-examining prosecution witnesses, presenting defense evidence, and delivering final closing arguments.",
            },
        ],
        "what_to_prepare": [
            "Exact details of any police station visits, notices received, or dates of alleged incidents",
            "Names and contact details of family members or reliable local sureties",
            "Any evidence demonstrating lack of involvement or presence elsewhere at the time of the alleged incident",
            "History of any prior disputes, enmity, or cross-complaints between the parties",
            "List of potential defense witnesses who can verify your account",
        ],
        "disclaimer": (
            "Criminal law proceedings carry severe consequences affecting personal liberty. This guidance is general "
            "information only. If facing arrest or police investigation, immediately contact our criminal defense "
            "advocates for urgent representation."
        ),
        "is_active": True,
        "display_order": 2,
    },
    {
        "title": "Family Matters",
        "slug": "family-matters",
        "practice_area_name": "Family Law",
        "overview": (
            "Family matters encompass domestic relations, marital disputes, dissolution of marriage, child custody, "
            "spousal maintenance, and domestic protection. Court procedures in family matters emphasize confidential "
            "counselling, mediation, and child welfare alongside formal legal adjudication."
        ),
        "common_petition_types": [
            "Petition for Dissolution of Marriage (Mutual Consent or Contested Divorce)",
            "Application for Interim and Final Maintenance / Alimony",
            "Petition for Child Custody and Visitation Rights",
            "Application under the Protection of Women from Domestic Violence Act",
            "Petition for Restitution of Conjugal Rights",
        ],
        "documents_required": [
            "Marriage Certificate, wedding photographs, or wedding invitation card",
            "Birth certificates of children (for custody or educational maintenance claims)",
            "Income affidavits, ITR filings, and salary slips of both spouses",
            "Details of joint bank accounts, shared immovable property, and stridhan inventory",
            "Copies of previous police complaints, CAW cell proceedings, or mediation records",
            "Communication records showing cruelty, desertion, or dispute history",
        ],
        "process_overview": [
            {
                "step": 1,
                "title": "Consultation & Strategic Approach",
                "description": "Evaluating whether mutual consent resolution is feasible or whether contested proceedings are required.",
            },
            {
                "step": 2,
                "title": "Family Court Petition Filing",
                "description": "Submitting formal petition along with mandatory income/asset disclosure affidavits and annexures.",
            },
            {
                "step": 3,
                "title": "Mandatory Mediation & Counselling",
                "description": "Family court refers parties to court-attached mediation center to explore amicable resolution.",
            },
            {
                "step": 4,
                "title": "Interim Relief Hearings",
                "description": "Adjudication of urgent interim maintenance, residence orders, or immediate child visitation schedule.",
            },
            {
                "step": 5,
                "title": "Evidence & Final Adjudication",
                "description": "If mediation is unsuccessful, matter proceeds to trial, witness affidavits, cross-examination, and final order.",
            },
        ],
        "what_to_prepare": [
            "Date and place of marriage, date of separation, and current living arrangements",
            "Children's details (ages, school, daily routine, and specific medical or educational needs)",
            "Detailed monthly expenditure summary and estimated income of spouse",
            "List of personal assets, jewelry, and belongings currently retained by the spouse",
            "Specific goals regarding custody, maintenance, or mutual separation terms",
        ],
        "disclaimer": (
            "Family disputes require compassionate and sensitive handling. This guidance is general information only. "
            "Please schedule a confidential consultation with our family law team."
        ),
        "is_active": True,
        "display_order": 3,
    },
    {
        "title": "Property & Real Estate Matters",
        "slug": "property-matters",
        "practice_area_name": "Property Law",
        "overview": (
            "Property disputes involve conflicting claims over land, residential or commercial buildings, boundary demarcation, "
            "tenant eviction, partition of ancestral estates, or fraudulent conveyances. Verification of the revenue chain-of-title "
            "is fundamental in property litigation."
        ),
        "common_petition_types": [
            "Suit for Partition and Separate Possession of Ancestral Property",
            "Suit for Declaration of Ownership and Recovery of Possession",
            "Application for Restraining Alienation or Creation of Third-Party Rights (Status Quo)",
            "Eviction Petition against Defaulting Tenants under Rent Control Laws",
            "Challenge to Fraudulent Conveyance or Cancellation of Registered Sale Deed",
        ],
        "documents_required": [
            "Registered Title Deeds (Sale Deed, Gift Deed, Will, Partition Deed, or Relinquishment Deed)",
            "Revenue records (Khata / Patta certificate, Mutation register extract, Jamabandi)",
            "Encumbrance Certificate (EC) for past 15 to 30 years from Sub-Registrar",
            "Approved building sanction plan, site map, and boundary demarcation sketches",
            "Property tax receipts, electricity bills, and municipal receipts demonstrating possession",
            "Tenancy / lease agreement and rent payment receipts (for eviction disputes)",
        ],
        "process_overview": [
            {
                "step": 1,
                "title": "Chain-of-Title Diligence",
                "description": "Searching sub-registrar and revenue records to verify legal standing and title continuity.",
            },
            {
                "step": 2,
                "title": "Demand Notice & Legal Warning",
                "description": "Serving formal notice demanding partition, vacation, or cessation of unauthorized encroachment.",
            },
            {
                "step": 3,
                "title": "Civil Suit with Urgent Interim Injunction",
                "description": "Filing plaint in court of competent jurisdiction alongside urgent interim application to restrain third-party rights.",
            },
            {
                "step": 4,
                "title": "Court Commission & Demarcation",
                "description": "Appointment of court commissioner or surveyor to inspect property and record physical boundary realities.",
            },
            {
                "step": 5,
                "title": "Preliminary & Final Decree",
                "description": "Passing of preliminary decree determining shares, followed by physical partition and final decree.",
            },
        ],
        "what_to_prepare": [
            "Complete schedule of property with survey/plot numbers, boundaries, and square footage",
            "Family tree / genealogical chart showing legal heirs (for ancestral inheritance claims)",
            "Timeline of when the disputed possession or encroachment began",
            "Any communication with municipal, gram panchayat, or revenue authorities",
            "Clear copies of all title deeds in your possession",
        ],
        "disclaimer": (
            "Property laws and revenue procedures vary widely across states and municipal jurisdictions. "
            "Consult our property counsel to examine your original title documentation."
        ),
        "is_active": True,
        "display_order": 4,
    },
    {
        "title": "Contract & Commercial Disputes",
        "slug": "contract-matters",
        "practice_area_name": "Corporate Law",
        "overview": (
            "Commercial and contractual disputes arise from non-performance of business obligations, breach of service agreements, "
            "unpaid commercial supplies, or partnership friction. Commercial matters often require mandatory pre-institution mediation "
            "under the Commercial Courts Act before approaching courts."
        ),
        "common_petition_types": [
            "Commercial Suit for Recovery of Dues with Interest",
            "Petition under Section 9 of the Arbitration & Conciliation Act for Interim Measures",
            "Application under Section 11 for Appointment of Sole Arbitrator",
            "Summary Suit under Order 37 of Civil Procedure Code",
            "Insolvency Petition under Insolvency & Bankruptcy Code (IBC) before NCLT",
        ],
        "documents_required": [
            "Executed commercial contract, purchase order (PO), master service agreement (MSA)",
            "Invoices, delivery challans, bills of lading, and goods receipt notes (GRN)",
            "Formal notice of default or breach served under the dispute resolution clause",
            "Account ledger statements certified under Banker's Books Evidence Act",
            "Minutes of meetings, amendment addendums, and email negotiations",
        ],
        "process_overview": [
            {
                "step": 1,
                "title": "Dispute Resolution Clause Examination",
                "description": "Reviewing whether the contract stipulates litigation, institutional arbitration, or mediation.",
            },
            {
                "step": 2,
                "title": "Contractual Cure Notice",
                "description": "Issuing formal cure notice granting the contractually required notice period to remedy breach.",
            },
            {
                "step": 3,
                "title": "Mandatory Pre-Institution Mediation",
                "description": "Initiating pre-institution mediation through the District Legal Services Authority where mandated by law.",
            },
            {
                "step": 4,
                "title": "Filing Commercial Plaint or Section 9 Petition",
                "description": "Instituting proceedings accompanied by Statement of Truth and affidavit of admission/denial of documents.",
            },
            {
                "step": 5,
                "title": "Case Management & Summary Adjudication",
                "description": "Participating in structured case management hearings, expedited evidence, and summary decree.",
            },
        ],
        "what_to_prepare": [
            "Exact contract clauses governing governing law, jurisdiction, and dispute resolution",
            "Calculated ledger balance including principal sum, interest rate claimed, and due dates",
            "Names and designations of authorized corporate representatives",
            "Summary of defenses or excuses raised by the counterparty in previous communications",
        ],
        "disclaimer": (
            "Commercial disputes often involve strict contractual notice windows and pre-institution mediation mandates. "
            "Prompt legal evaluation is essential to prevent waiver of claims."
        ),
        "is_active": True,
        "display_order": 5,
    },
    {
        "title": "Employment & Workplace Matters",
        "slug": "employment-matters",
        "practice_area_name": "Corporate Law",
        "overview": (
            "Employment matters involve wrongful termination, unpaid severance or bonus claims, non-compete enforcement, "
            "sexual harassment complaints (POSH), or breach of confidentiality. Dispute resolution avenues differ "
            "between managerial personnel and statutory workmen."
        ),
        "common_petition_types": [
            "Statement of Claim before Labour Conciliation Officer / Industrial Tribunal",
            "Civil Suit for Recovery of Arrears of Salary and Notice Pay",
            "Complaint under the Sexual Harassment of Women at Workplace (POSH) Act",
            "Injunction Suit to Enforce Confidentiality and Non-Solicitation Covenants",
            "Writ Petition against Arbitrary Termination in Public Sector Undertakings",
        ],
        "documents_required": [
            "Letter of Appointment, Employment Agreement, and HR Policy handbook",
            "Pay slips, Form 16, Provident Fund (PF) statements, and bank salary credit entries",
            "Formal termination letter, show cause notice, or suspension order",
            "Copies of internal grievance communications and HR email exchanges",
            "Performance appraisal ratings, commendations, or bonus confirmation letters",
        ],
        "process_overview": [
            {
                "step": 1,
                "title": "Employee Categorization & Jurisdiction Analysis",
                "description": "Determining whether the employee falls under workman or managerial category to establish forum.",
            },
            {
                "step": 2,
                "title": "Internal Grievance & Legal Notice",
                "description": "Exhausting internal ombudsman mechanisms and issuing formal legal notice for arrears.",
            },
            {
                "step": 3,
                "title": "Conciliation Proceedings",
                "description": "Appearing before Labour Officer / Conciliation Officer for statutory conciliation attempt.",
            },
            {
                "step": 4,
                "title": "Tribunal Reference or Civil Plaint",
                "description": "If conciliation fails, matter is referred to Labour Court / Industrial Tribunal or filed in Civil Court.",
            },
            {
                "step": 5,
                "title": "Evidence & Binding Award",
                "description": "Hearing witness testimony, reviewing personnel records, and issuance of binding award or decree.",
            },
        ],
        "what_to_prepare": [
            "Date of joining, date of exit/termination, and total tenure of service",
            "Breakdown of unpaid amounts (salary, leave encashment, gratuity, notice pay)",
            "Copy of any non-disclosure or non-compete agreements signed",
            "Detailed chronology of events leading to the dispute",
        ],
        "disclaimer": (
            "Employment disputes depend strictly on the employment agreement terms and statutory labor codes. "
            "Consult our employment advocates to determine the appropriate legal forum."
        ),
        "is_active": True,
        "display_order": 6,
    },
    {
        "title": "Consumer Protection Matters",
        "slug": "consumer-matters",
        "practice_area_name": "Consumer Law",
        "overview": (
            "Consumer complaints arise when a purchaser of goods or beneficiary of services experiences deficiencies in service, "
            "defective merchandise, misleading advertising, or unfair trade practices by manufacturers, real estate builders, "
            "or corporate service providers."
        ),
        "common_petition_types": [
            "Consumer Complaint before District Consumer Disputes Redressal Commission",
            "Appeal or Revision before State Consumer Disputes Redressal Commission",
            "Original Complaint before National Consumer Commission (NCDRC) for high-value claims",
            "Application for Interim Relief or Stay of Coercive Action",
            "Execution Application for Non-Compliance with Consumer Commission Order",
        ],
        "documents_required": [
            "Tax Invoice, purchase bill, cash memo, or booking receipt",
            "Warranty card, guarantee certificate, or service level agreement",
            "Photographs, videos, or expert technical inspection reports demonstrating defect",
            "Written complaint sent to customer support, ticket numbers, and response emails",
            "Copy of statutory legal notice served to the manufacturer or service provider",
        ],
        "process_overview": [
            {
                "step": 1,
                "title": "Pecuniary & Territorial Jurisdiction",
                "description": "Calculating total consideration paid plus compensation claimed to select District, State, or National Commission.",
            },
            {
                "step": 2,
                "title": "Pre-Litigation Legal Notice",
                "description": "Serving mandatory legal notice granting 15 to 30 days to rectify deficiency, replace product, or refund consideration.",
            },
            {
                "step": 3,
                "title": "Drafting & Filing Consumer Complaint",
                "description": "Filing verified complaint accompanied by supporting affidavit, document index, and nominal statutory fee.",
            },
            {
                "step": 4,
                "title": "Admission & Summons",
                "description": "Commission examines prima facie complaint, admits it within 21 days, and issues notice to opposite party.",
            },
            {
                "step": 5,
                "title": "Written Version & Summary Adjudication",
                "description": "Opposite party files response within 30-45 days; Commission decides on affidavit evidence without lengthy formal trial.",
            },
        ],
        "what_to_prepare": [
            "Exact date of purchase or service engagement",
            "Total monetary amount paid and proof of payment methods",
            "Specific loss, injury, or harassment suffered as a direct result",
            "Exact relief sought (full refund with interest, product replacement, compensation for mental agony)",
        ],
        "disclaimer": (
            "Consumer complaints have strict two-year limitation periods from the date cause of action arose. "
            "Consult our legal counsel promptly to file before limitation expires."
        ),
        "is_active": True,
        "display_order": 7,
    },
]


def seed_guidance(apps, schema_editor):
    PetitionGuidance = apps.get_model("consultations", "PetitionGuidance")
    PracticeArea = apps.get_model("consultations", "PracticeArea")

    for item in SEED_GUIDANCE:
        pa_name = item.get("practice_area_name")
        pa = None
        if pa_name:
            pa = PracticeArea.objects.filter(name__iexact=pa_name).first()

        defaults = {
            "slug": item["slug"],
            "practice_area": pa,
            "overview": item["overview"],
            "common_petition_types": item["common_petition_types"],
            "documents_required": item["documents_required"],
            "process_overview": item["process_overview"],
            "what_to_prepare": item["what_to_prepare"],
            "disclaimer": item["disclaimer"],
            "is_active": item["is_active"],
            "display_order": item["display_order"],
        }

        PetitionGuidance.objects.get_or_create(
            title=item["title"],
            defaults=defaults,
        )


def unseed_guidance(apps, schema_editor):
    PetitionGuidance = apps.get_model("consultations", "PetitionGuidance")
    titles = [item["title"] for item in SEED_GUIDANCE]
    PetitionGuidance.objects.filter(title__in=titles).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("consultations", "0007_petitionguidance"),
    ]

    operations = [
        migrations.RunPython(seed_guidance, unseed_guidance),
    ]
