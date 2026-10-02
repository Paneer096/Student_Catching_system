"""
Makerove — SQLAlchemy ORM Models

Complete data model per §5. All tables use UUIDs as primary keys.
PII columns (name, dob) are marked for Fernet encryption at application level.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def generate_uuid() -> str:
    """Generate a new UUID4 string."""
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


# ─── Users & Auth ─────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(30), nullable=False)  # UserRole enum value
    teacher_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("teachers.id"), nullable=True)
    student_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("students.id"), nullable=True)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    teacher = relationship("Teacher", back_populates="user", uselist=False)
    student = relationship("Student", back_populates="user", uselist=False)
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    csrf_token: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    last_activity: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)

    user = relationship("User", back_populates="sessions")


class LoginAttempt(Base):
    __tablename__ = "login_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    ip_address: Mapped[str] = mapped_column(String(45), nullable=False)
    attempted_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    success: Mapped[bool] = mapped_column(Boolean, default=False)


# ─── Core Academic Entities ───────────────────────────────────────────────────

class Section(Base):
    __tablename__ = "sections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    semester: Mapped[int] = mapped_column(Integer, nullable=False)
    strength: Mapped[int] = mapped_column(Integer, nullable=False)
    department: Mapped[str] = mapped_column(String(50), nullable=False)
    class_teacher_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("teachers.id"), nullable=True)

    students = relationship("Student", back_populates="section")
    class_teacher = relationship("Teacher", back_populates="class_sections", foreign_keys=[class_teacher_id])


class Teacher(Base):
    __tablename__ = "teachers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String(200), nullable=False)  # PII — encrypt at app level
    department: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="teacher", uselist=False)
    class_sections = relationship("Section", back_populates="class_teacher", foreign_keys=[Section.class_teacher_id])
    observations = relationship("Observation", back_populates="teacher")
    interventions = relationship("Intervention", back_populates="teacher")
    teacher_subjects = relationship("TeacherSubjectSection", back_populates="teacher")


class Student(Base):
    __tablename__ = "students"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    roll_no: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)  # PII — encrypt at app level
    section_id: Mapped[str] = mapped_column(String(36), ForeignKey("sections.id"), nullable=False, index=True)
    branch: Mapped[str] = mapped_column(String(50), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    dob: Mapped[date] = mapped_column(Date, nullable=False)  # PII — encrypt at app level
    gender: Mapped[str | None] = mapped_column(String(10), nullable=True)  # Optional, off by default (G8)
    support_program: Mapped[bool] = mapped_column(Boolean, default=False)  # Counselor-only (§7.5)
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    section = relationship("Section", back_populates="students")
    user = relationship("User", back_populates="student", uselist=False)
    attendance_records = relationship("Attendance", back_populates="student")
    marks_records = relationship("Marks", back_populates="student")
    observations_received = relationship("Observation", back_populates="student")

    @property
    def is_minor(self) -> bool:
        """Derived from date of birth — under 18 (G6)."""
        today = date.today()
        age = today.year - self.dob.year - ((today.month, today.day) < (self.dob.month, self.dob.day))
        return age < 18


class Subject(Base):
    __tablename__ = "subjects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    credits: Mapped[int] = mapped_column(Integer, nullable=False)
    is_lab: Mapped[bool] = mapped_column(Boolean, default=False)
    criticality: Mapped[int] = mapped_column(Integer, default=3)  # 1–5 scale


class TimetableSlot(Base):
    __tablename__ = "timetable_slots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    section_id: Mapped[str] = mapped_column(String(36), ForeignKey("sections.id"), nullable=False, index=True)
    day: Mapped[str] = mapped_column(String(10), nullable=False)  # Monday–Saturday
    period: Mapped[int] = mapped_column(Integer, nullable=False)
    subject_code: Mapped[str] = mapped_column(String(20), ForeignKey("subjects.code"), nullable=False)
    teacher_id: Mapped[str] = mapped_column(String(36), ForeignKey("teachers.id"), nullable=False)
    room: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_lab: Mapped[bool] = mapped_column(Boolean, default=False)

    __table_args__ = (
        UniqueConstraint("section_id", "day", "period", name="uq_timetable_slot"),
    )


class TeacherSubjectSection(Base):
    __tablename__ = "teacher_subject_sections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    teacher_id: Mapped[str] = mapped_column(String(36), ForeignKey("teachers.id"), nullable=False)
    subject_code: Mapped[str] = mapped_column(String(20), ForeignKey("subjects.code"), nullable=False)
    section_id: Mapped[str] = mapped_column(String(36), ForeignKey("sections.id"), nullable=False)

    teacher = relationship("Teacher", back_populates="teacher_subjects")

    __table_args__ = (
        UniqueConstraint("teacher_id", "subject_code", "section_id", name="uq_teacher_subject_section"),
    )


# ─── Data: Attendance, Marks, Calendar ────────────────────────────────────────

class Attendance(Base):
    __tablename__ = "attendance"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    period: Mapped[int] = mapped_column(Integer, nullable=False)
    subject_code: Mapped[str] = mapped_column(String(20), ForeignKey("subjects.code"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)  # AttendanceStatus
    batch_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("ingestion_batches.id"), nullable=True)

    student = relationship("Student", back_populates="attendance_records")

    __table_args__ = (
        UniqueConstraint("student_id", "date", "period", name="uq_attendance_student_date_period"),
        Index("ix_attendance_section_date", "date"),
    )


class Marks(Base):
    __tablename__ = "marks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id"), nullable=False, index=True)
    semester: Mapped[int] = mapped_column(Integer, nullable=False)
    subject_code: Mapped[str] = mapped_column(String(20), ForeignKey("subjects.code"), nullable=False)
    internal_1: Mapped[float | None] = mapped_column(Float, nullable=True)
    internal_2: Mapped[float | None] = mapped_column(Float, nullable=True)
    external: Mapped[float | None] = mapped_column(Float, nullable=True)
    total: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_total: Mapped[float] = mapped_column(Float, nullable=False, default=100.0)

    student = relationship("Student", back_populates="marks_records")

    __table_args__ = (
        UniqueConstraint("student_id", "semester", "subject_code", name="uq_marks_student_sem_sub"),
    )


class CGPASnapshot(Base):
    __tablename__ = "cgpa_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id"), nullable=False, index=True)
    semester: Mapped[int] = mapped_column(Integer, nullable=False)
    cgpa: Mapped[float] = mapped_column(Float, nullable=False)
    computed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class CalendarDay(Base):
    __tablename__ = "calendar_days"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    date: Mapped[date] = mapped_column(Date, unique=True, nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(30), nullable=False)  # CalendarDayType
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_holiday: Mapped[bool] = mapped_column(Boolean, default=False)


# ─── Peer Survey ──────────────────────────────────────────────────────────────

class SurveyWave(Base):
    __tablename__ = "survey_waves"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    wave_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class SurveyResponse(Base):
    __tablename__ = "survey_responses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    wave_id: Mapped[str] = mapped_column(String(36), ForeignKey("survey_waves.id"), nullable=False)
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id"), nullable=False)
    target_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id"), nullable=False)
    relation: Mapped[str] = mapped_column(String(20), nullable=False)  # SurveyRelation

    __table_args__ = (
        UniqueConstraint("wave_id", "student_id", "target_id", "relation", name="uq_survey_response"),
    )


class Club(Base):
    __tablename__ = "clubs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)


class ClubMembership(Base):
    __tablename__ = "club_memberships"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id"), nullable=False)
    club_id: Mapped[str] = mapped_column(String(36), ForeignKey("clubs.id"), nullable=False)

    __table_args__ = (
        UniqueConstraint("student_id", "club_id", name="uq_club_membership"),
    )


# ─── Observations & Interventions ─────────────────────────────────────────────

class Observation(Base):
    __tablename__ = "observations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    teacher_id: Mapped[str] = mapped_column(String(36), ForeignKey("teachers.id"), nullable=False)
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id"), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(30), nullable=False)  # ObservationCategory
    note: Mapped[str | None] = mapped_column(Text, nullable=True)  # Never sent to Gemini
    date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    teacher = relationship("Teacher", back_populates="observations")
    student = relationship("Student", back_populates="observations_received")


class Intervention(Base):
    __tablename__ = "interventions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    teacher_id: Mapped[str] = mapped_column(String(36), ForeignKey("teachers.id"), nullable=False)
    type: Mapped[str] = mapped_column(String(30), nullable=False)  # InterventionType
    date: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    follow_up_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    outcome: Mapped[str | None] = mapped_column(String(20), nullable=True)  # InterventionOutcome
    outcome_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    teacher = relationship("Teacher", back_populates="interventions")
    students = relationship("InterventionStudent", back_populates="intervention", cascade="all, delete-orphan")


class InterventionStudent(Base):
    __tablename__ = "intervention_students"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    intervention_id: Mapped[str] = mapped_column(String(36), ForeignKey("interventions.id"), nullable=False)
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id"), nullable=False)

    intervention = relationship("Intervention", back_populates="students")

    __table_args__ = (
        UniqueConstraint("intervention_id", "student_id", name="uq_intervention_student"),
    )


# ─── Graph Edges ──────────────────────────────────────────────────────────────

class Edge(Base):
    __tablename__ = "edges"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    src: Mapped[str] = mapped_column(String(36), ForeignKey("students.id"), nullable=False, index=True)
    dst: Mapped[str] = mapped_column(String(36), ForeignKey("students.id"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(20), nullable=False)  # EdgeType
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    evidence_count: Mapped[int] = mapped_column(Integer, default=0)
    p_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    q_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    window_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    window_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    source: Mapped[str] = mapped_column(String(10), default="derived")  # EdgeSource
    computed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


# ─── Detection Results ────────────────────────────────────────────────────────

class GroupAbsenceEvent(Base):
    __tablename__ = "group_absence_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    section_id: Mapped[str] = mapped_column(String(36), ForeignKey("sections.id"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    period: Mapped[int] = mapped_column(Integer, nullable=False)
    subject_code: Mapped[str] = mapped_column(String(20), ForeignKey("subjects.code"), nullable=False)
    absent_ids: Mapped[dict] = mapped_column(JSON, nullable=False)  # List of student IDs
    absent_count: Mapped[int] = mapped_column(Integer, nullable=False)
    baseline_share: Mapped[float] = mapped_column(Float, nullable=False)
    cohesion: Mapped[float] = mapped_column(Float, nullable=False)
    community_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    band: Mapped[str] = mapped_column(String(20), nullable=False)  # GroupAbsenceBand
    status: Mapped[str] = mapped_column(String(20), default="new")  # GroupAbsenceStatus
    dismissal_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    explanation: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class AnchorScore(Base):
    __tablename__ = "anchor_scores"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id"), nullable=False, index=True)
    section_id: Mapped[str] = mapped_column(String(36), ForeignKey("sections.id"), nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    pagerank_norm: Mapped[float] = mapped_column(Float, nullable=False)
    betweenness_norm: Mapped[float] = mapped_column(Float, nullable=False)
    leadlag_norm: Mapped[float] = mapped_column(Float, nullable=False)
    episodes_participated: Mapped[int] = mapped_column(Integer, nullable=False)
    lead_rate: Mapped[float] = mapped_column(Float, nullable=False)
    significant_edges: Mapped[int] = mapped_column(Integer, nullable=False)
    confidence: Mapped[str | None] = mapped_column(String(10), nullable=True)  # AnchorConfidence
    community_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    explanation: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    window_start: Mapped[date] = mapped_column(Date, nullable=False)
    window_end: Mapped[date] = mapped_column(Date, nullable=False)
    computed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class ScoreSnapshot(Base):
    __tablename__ = "score_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id"), nullable=False, index=True)
    score_type: Mapped[str] = mapped_column(String(30), nullable=False)  # "support_priority" | "strengths"
    score: Mapped[float] = mapped_column(Float, nullable=False)
    band: Mapped[str] = mapped_column(String(20), nullable=False)
    components: Mapped[dict] = mapped_column(JSON, nullable=False)  # Per-factor contributions
    is_recovering: Mapped[bool] = mapped_column(Boolean, default=False)
    excluded_medical: Mapped[bool] = mapped_column(Boolean, default=False)
    window_start: Mapped[date] = mapped_column(Date, nullable=False)
    window_end: Mapped[date] = mapped_column(Date, nullable=False)
    expires_at: Mapped[date | None] = mapped_column(Date, nullable=True)  # G9: 30-day expiry
    computed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class CalendarRisk(Base):
    __tablename__ = "calendar_risk"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    section_id: Mapped[str] = mapped_column(String(36), ForeignKey("sections.id"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    period: Mapped[int] = mapped_column(Integer, nullable=False)
    predicted_absent_share: Mapped[float] = mapped_column(Float, nullable=False)
    baseline_share: Mapped[float] = mapped_column(Float, nullable=False)
    band: Mapped[str] = mapped_column(String(10), nullable=False)  # CalendarRiskBand
    drivers: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # Counterfactual attributions
    model_used: Mapped[str] = mapped_column(String(20), default="heuristic")  # "heuristic" | "ml" | "blended"
    computed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("section_id", "date", "period", name="uq_calendar_risk"),
    )


class ModelRegistry(Base):
    __tablename__ = "model_registry"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    model_type: Mapped[str] = mapped_column(String(30), nullable=False)
    training_window_start: Mapped[date] = mapped_column(Date, nullable=False)
    training_window_end: Mapped[date] = mapped_column(Date, nullable=False)
    metrics: Mapped[dict] = mapped_column(JSON, nullable=False)
    features_used: Mapped[dict] = mapped_column(JSON, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


# ─── Security & Audit ─────────────────────────────────────────────────────────

class ConsentRecord(Base):
    __tablename__ = "consent_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    notice_version: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)  # ConsentStatus
    purpose: Mapped[str] = mapped_column(String(50), default="general")
    recorded_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class ContestRequest(Base):
    __tablename__ = "contest_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(20), nullable=False)  # "contest" | "correction" | "erasure"
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # ContestStatus
    reviewer_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class AuditLog(Base):
    """
    Hash-chained audit log (G10).
    Every read of a student-level record and every write is appended.
    prev_hash links to the previous entry, forming a tamper-evident chain.
    """
    __tablename__ = "audit_log"

    seq: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ts: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    actor_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)  # User UUID, never name
    action: Mapped[str] = mapped_column(String(30), nullable=False)  # AuditAction
    entity_type: Mapped[str] = mapped_column(String(30), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(36), nullable=False)
    purpose: Mapped[str] = mapped_column(String(100), nullable=False)
    detail_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    prev_hash: Mapped[str] = mapped_column(String(64), nullable=False)  # SHA-256 of previous entry
    hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)  # SHA-256 of this entry


# ─── Ingestion & LLM Logging ─────────────────────────────────────────────────

class IngestionBatch(Base):
    __tablename__ = "ingestion_batches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    file_type: Mapped[str] = mapped_column(String(20), nullable=False)  # IngestionFileType
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    uploaded_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    rows_ok: Mapped[int] = mapped_column(Integer, default=0)
    rows_rejected: Mapped[int] = mapped_column(Integer, default=0)
    report_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_dry_run: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class LLMCallLog(Base):
    """Log of Gemini API calls — NEVER stores prompt or response content."""
    __tablename__ = "llm_call_log"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    purpose: Mapped[str] = mapped_column(String(50), nullable=False)
    model: Mapped[str] = mapped_column(String(50), nullable=False)
    prompt_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cached: Mapped[bool] = mapped_column(Boolean, default=False)
    fallback_used: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class JobRun(Base):
    __tablename__ = "job_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    job_name: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)  # "running" | "success" | "failed"
    started_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
