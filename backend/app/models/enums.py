"""
Makerove — Enumerations

All enum types used across the platform.
Vocabulary is enforced per §1 — no stigmatizing language.
"""
from __future__ import annotations

import enum


class UserRole(str, enum.Enum):
    """User roles with scope-based access. See §4 for the access matrix."""
    CLASS_TEACHER = "CLASS_TEACHER"
    SUBJECT_TEACHER = "SUBJECT_TEACHER"
    HOD = "HOD"
    COUNSELOR = "COUNSELOR"
    ADMIN = "ADMIN"
    STUDENT = "STUDENT"


class AttendanceStatus(str, enum.Enum):
    """Attendance statuses. Eligible = PRESENT | LATE | ABSENT. Excused never count (G2)."""
    PRESENT = "PRESENT"
    LATE = "LATE"
    ABSENT = "ABSENT"
    MEDICAL_LEAVE = "MEDICAL_LEAVE"
    APPROVED_LEAVE = "APPROVED_LEAVE"
    ON_DUTY = "ON_DUTY"


class StudentStatus(str, enum.Enum):
    """Student lifecycle status."""
    ACTIVE = "ACTIVE"
    GRADUATED = "GRADUATED"
    ERASED = "ERASED"


class EdgeType(str, enum.Enum):
    """Social graph edge types."""
    FRIENDS_WITH = "FRIENDS_WITH"
    STUDIES_WITH = "STUDIES_WITH"
    CO_ABSENT = "CO_ABSENT"
    MENTORS = "MENTORS"
    LEADS = "LEADS"


class EdgeSource(str, enum.Enum):
    """Origin of an edge in the graph."""
    SURVEY = "survey"
    DERIVED = "derived"


class SurveyRelation(str, enum.Enum):
    """Peer survey relationship types."""
    SITS_WITH = "SITS_WITH"
    STUDIES_WITH = "STUDIES_WITH"
    HANGS_OUT_WITH = "HANGS_OUT_WITH"


class ObservationCategory(str, enum.Enum):
    """
    Teacher observation categories — fixed, neutral list per §6.3.
    Subjective labels like 'rude' or 'disruptive' are intentionally NOT available.
    """
    # Concern categories
    ATTENDANCE_CONCERN = "attendance_concern"
    DISENGAGED = "disengaged"
    NEEDS_SUPPORT = "needs_support"
    # Supportive categories
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
    """Status of a group absence event in the teacher workflow."""
    NEW = "new"
    ACKNOWLEDGED = "acknowledged"
    DISMISSED = "dismissed"
    ACTED = "acted"


class GroupAbsenceBand(str, enum.Enum):
    """Score bands for group absence events."""
    HIGH_ATTENTION = "high_attention"       # >= 0.65
    WATCH = "watch"                         # 0.40–0.65
    NOTED = "noted"                         # < 0.40


class SupportPriorityBand(str, enum.Enum):
    """Support priority bands — supportive language only."""
    REACH_OUT = "reach_out"                 # "Reach out soon" >= 0.65
    KEEP_AN_EYE = "keep_an_eye"             # "Keep an eye" 0.40–0.65
    ON_TRACK = "on_track"                   # "On track" < 0.40


class StrengthsBand(str, enum.Enum):
    """Strengths score bands."""
    EMERGING = "emerging"                   # "Emerging strength" >= 0.70
    GROWING = "growing"                     # "Growing" 0.50–0.70
    NOT_SHOWN = "not_shown"                 # Below 0.50 → not displayed


class CalendarDayType(str, enum.Enum):
    """Academic calendar day types."""
    NATIONAL = "national"
    FESTIVAL = "festival"
    VACATION = "vacation"
    SPORTS_DAY = "sports_day"
    EXAM = "exam"
    EXAM_LEAVE = "exam_leave"
    EVENT = "event"
    WORKING_SATURDAY = "working_saturday"


class CalendarRiskBand(str, enum.Enum):
    """Calendar risk prediction bands."""
    GREEN = "green"
    YELLOW = "yellow"
    ORANGE = "orange"
    RED = "red"


class AnchorConfidence(str, enum.Enum):
    """Confidence level for group anchor identification."""
    MEDIUM = "medium"       # 3–4 episodes
    HIGH = "high"           # >= 5 episodes AND >= 3 significant edges


class AuditAction(str, enum.Enum):
    """Actions logged in the audit trail."""
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


class ConsentStatus(str, enum.Enum):
    """Consent record status."""
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
    MARKS = "marks"
    TIMETABLE = "timetable"
    CALENDAR = "calendar"
    SURVEY = "survey"
