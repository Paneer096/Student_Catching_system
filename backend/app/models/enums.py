"""
Makarov — Enumerations

All enum types used across the platform.
Vocabulary enforced per §5.3 and §10 — no stigmatizing language.
No composite scores, no labels like 'ringleader' or 'troublemaker'.
"""
from __future__ import annotations

import enum


class UserRole(str, enum.Enum):
    """User roles with scope-based access per §10."""
    CLASS_TEACHER = "CLASS_TEACHER"
    SUBJECT_TEACHER = "SUBJECT_TEACHER"
    HOD = "HOD"
    COUNSELOR = "COUNSELOR"
    ADMIN = "ADMIN"
    STUDENT = "STUDENT"


class AttendanceStatus(str, enum.Enum):
    """
    Attendance statuses per §2.
    Mapping from ingestion shortcodes: P→PRESENT, A→ABSENT, L→LATE, OD→ON_DUTY, ML→MEDICAL_LEAVE.
    Eligible statuses (for bunk computation): PRESENT, LATE, ABSENT.
    Excused statuses (never count as bunk): MEDICAL_LEAVE, ON_DUTY.
    """
    PRESENT = "PRESENT"
    LATE = "LATE"
    ABSENT = "ABSENT"
    MEDICAL_LEAVE = "MEDICAL_LEAVE"    # ML in CSV
    ON_DUTY = "ON_DUTY"                # OD in CSV


# Status codes accepted during CSV ingestion (§9)
INGESTION_STATUS_MAP: dict[str, AttendanceStatus] = {
    "P": AttendanceStatus.PRESENT,
    "A": AttendanceStatus.ABSENT,
    "L": AttendanceStatus.LATE,
    "OD": AttendanceStatus.ON_DUTY,
    "ML": AttendanceStatus.MEDICAL_LEAVE,
}


class StudentStatus(str, enum.Enum):
    """Student lifecycle status."""
    ACTIVE = "ACTIVE"
    GRADUATED = "GRADUATED"
    ERASED = "ERASED"


class EdgeType(str, enum.Enum):
    """
    Graph edge types per §4.
    Every edge carries derived_from, computed_at, and params_hash.
    Banned edge names: CONNECTED_TO, ASSOCIATED_WITH, KNOWS, RELATED_TO, INFLUENCES.
    """
    # Core derived edge — §5.1: statistically validated co-bunking
    SKIPS_WITH = "SKIPS_WITH"

    # Survey nomination — §4: raw nomination with mutual flag and kind property
    NAMED_FRIEND = "NAMED_FRIEND"

    # Structural (not drawn on bunk graph; used in filters)
    ENROLLED_IN = "ENROLLED_IN"        # Student → Section
    TEACHES = "TEACHES"                # Teacher → Section (prop subject_code)

    # Club membership
    MEMBER_OF = "MEMBER_OF"            # Student → Club

    # Teacher actions (through intermediate Observation/Intervention node)
    OBSERVED = "OBSERVED"              # Teacher → Observation → Student
    INTERVENED = "INTERVENED"          # Teacher → Intervention → Student

    # Experimental, off by default — §5.4
    LEADS_SKIPS = "LEADS_SKIPS"        # Student → Student (who tends to skip earlier)


class EdgeSource(str, enum.Enum):
    """Origin of an edge in the graph."""
    SURVEY = "survey"
    DERIVED = "derived"


class FriendKind(str, enum.Enum):
    """
    Kind property on NAMED_FRIEND edges per §4.
    STUDIES_WITH / HANGS_OUT_WITH become a property `kind`, not separate edge types.
    """
    SITS_WITH = "SITS_WITH"
    STUDIES_WITH = "STUDIES_WITH"
    HANGS_OUT_WITH = "HANGS_OUT_WITH"


class PatternType(str, enum.Enum):
    """
    Rule-based flags per §5.3. Replace trouble_score / classification.
    Thresholds live in settings; each flag has a computed evidence string.
    There is NO composite 'trouble score'. The only numeric risk is
    the prediction probability (§6).
    """
    # attendance below min_attendance (default 75%). Show "can still miss N sessions".
    BELOW_MIN_ATTENDANCE = "BELOW_MIN_ATTENDANCE"

    # bunk rate last 14d vs prior 60d, two-proportion z-test, p < 0.05
    SUDDEN_DROP = "SUDDEN_DROP"

    # bunks concentrated in one subject / period / weekday (chi-square, min 5 bunks)
    SLOT_CONCENTRATION = "SLOT_CONCENTRATION"

    # member of a bunk group (from Leiden/Louvain on SKIPS_WITH graph)
    GROUP_SKIPPER = "GROUP_SKIPPER"

    # at least k consecutive full-day absences → welfare check-in, not discipline
    LONG_ABSENCE = "LONG_ABSENCE"

    # bunk rate falling significantly
    IMPROVING = "IMPROVING"


class ObservationCategory(str, enum.Enum):
    """
    Teacher observation categories — fixed, neutral list.
    Subjective labels like 'rude' or 'disruptive' are intentionally NOT available.
    """
    ATTENDANCE_CONCERN = "attendance_concern"
    DISENGAGED = "disengaged"
    NEEDS_SUPPORT = "needs_support"
    HELPFUL_TO_PEERS = "helpful_to_peers"
    IMPROVING = "improving"
    LEADERSHIP_SHOWN = "leadership_shown"
    MENTOR_POTENTIAL = "mentor_potential"
    ATTENTIVE = "attentive"


class InterventionType(str, enum.Enum):
    """Types of teacher-initiated interventions."""
    CONVERSATION = "conversation"
    COUNSELING_REFERRAL = "counseling_referral"
    PEER_MENTORING = "peer_mentoring"
    ROLE_ASSIGNMENT = "role_assignment"
    PARENT_MEETING_BY_TEACHER = "parent_meeting_by_teacher"
    RECOGNITION = "recognition"


class InterventionOutcome(str, enum.Enum):
    """Outcome of an intervention — always labelled as association, not proof."""
    IMPROVED = "improved"
    NO_CHANGE = "no_change"
    WORSENED = "worsened"
    RESOLVED = "resolved"
    UNKNOWN = "unknown"


class GroupAbsenceStatus(str, enum.Enum):
    """Status of a mass-absence event in the teacher workflow."""
    NEW = "new"
    ACKNOWLEDGED = "acknowledged"
    DISMISSED = "dismissed"
    ACTED = "acted"


class AuditAction(str, enum.Enum):
    """Actions logged in the audit trail per §10."""
    READ = "read"
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    LOGIN = "login"
    LOGOUT = "logout"
    REVEAL_NAME = "reveal_name"
    EXPORT = "export"
    CONSENT_ACCEPT = "consent_accept"
    CONSENT_WITHDRAW = "consent_withdraw"
    CONTEST = "contest"
    ERASURE_REQUEST = "erasure_request"
    DISMISS_FLAG = "dismiss_flag"


class ConsentStatus(str, enum.Enum):
    """Consent record status per §10 (DPDP Act 2023)."""
    ACCEPTED = "accepted"
    WITHDRAWN = "withdrawn"


class ContestStatus(str, enum.Enum):
    """Status of a student contest/correction/erasure request."""
    PENDING = "pending"
    REVIEWED = "reviewed"
    RESOLVED = "resolved"
    REJECTED = "rejected"


class IngestionFileType(str, enum.Enum):
    """Types of files that can be ingested."""
    ROSTER = "roster"
    ATTENDANCE = "attendance"
    TIMETABLE = "timetable"
    SURVEY = "survey"


class IngestionRunStatus(str, enum.Enum):
    """Status of an ingestion run."""
    PENDING = "pending"
    DRY_RUN = "dry_run"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
