"""
Makarov — SQLAlchemy ORM Models

Data model per §3 (Architecture) and §4 (Graph Schema).
- Facts live in PostgreSQL (SQLite for MVP): students, teachers, sections, subjects,
  sessions, attendance, survey_nominations, observations, interventions, ingestion_runs.
- Derived data lives in an `edges` table (src, dst, type, weight, props jsonb,
  derived_from, params_hash, computed_at, evidence) plus versioned `analysis_snapshots`.

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
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, synonym


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
    auth_sessions = relationship("AuthSession", back_populates="user", cascade="all, delete-orphan")


class AuthSession(Base):
    """Browser/API auth session. NOT an academic session (see AcademicSession)."""
    __tablename__ = "auth_sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    csrf_token: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    last_activity: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)

    user = relationship("User", back_populates="auth_sessions")


class LoginAttempt(Base):
    __tablename__ = "login_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    ip_address: Mapped[str] = mapped_column(String(45), nullable=False)
    attempted_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    success: Mapped[bool] = mapped_column(Boolean, default=False)


# ─── Core Academic Entities (§3 Facts) ────────────────────────────────────────

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
    gender: Mapped[str | None] = mapped_column(String(10), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    section = relationship("Section", back_populates="students")
    user = relationship("User", back_populates="student", uselist=False)
    attendance_records = relationship("Attendance", back_populates="student")
    observations_received = relationship("Observation", back_populates="student")

    @property
    def is_minor(self) -> bool:
        """Derived from date of birth — under 18. Relevant for DPDP Act §10."""
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
    """
    Maps Teacher → Subject → Section.
    Corresponds to the TEACHES edge (§4): Teacher → Section with prop subject_code.
    """
    __tablename__ = "teacher_subject_sections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    teacher_id: Mapped[str] = mapped_column(String(36), ForeignKey("teachers.id"), nullable=False)
    subject_code: Mapped[str] = mapped_column(String(20), ForeignKey("subjects.code"), nullable=False)
    section_id: Mapped[str] = mapped_column(String(36), ForeignKey("sections.id"), nullable=False)

    teacher = relationship("Teacher", back_populates="teacher_subjects")

    __table_args__ = (
        UniqueConstraint("teacher_id", "subject_code", "section_id", name="uq_teacher_subject_section"),
    )


# ─── Academic Session (§2 / §3) ──────────────────────────────────────────────

class AcademicSession(Base):
    """
    A scheduled class that was actually held (§2).
    - Classes not held (holiday, teacher absent) are excluded.
    - This is the atomic unit for bunk detection.
    - Session is a real entity but too numerous to draw (§4); used for filters
      and evidence panels.
    """
    __tablename__ = "academic_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    section_id: Mapped[str] = mapped_column(String(36), ForeignKey("sections.id"), nullable=False, index=True)
    subject_code: Mapped[str] = mapped_column(String(20), ForeignKey("subjects.code"), nullable=False)
    teacher_id: Mapped[str] = mapped_column(String(36), ForeignKey("teachers.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    period: Mapped[int] = mapped_column(Integer, nullable=False)
    was_held: Mapped[bool] = mapped_column(Boolean, default=True)
    # True = session actually took place; False = cancelled/holiday/teacher absent

    __table_args__ = (
        UniqueConstraint("section_id", "date", "period", name="uq_academic_session"),
        Index("ix_session_section_date", "section_id", "date"),
    )


# ─── Attendance (§2 / §3) ────────────────────────────────────────────────────

class Attendance(Base):
    """
    Attendance record: (student, session, status) per §2.
    Status is one of PRESENT | ABSENT | LATE | OD | ML.
    """
    __tablename__ = "attendance"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id"), nullable=False, index=True)
    session_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("academic_sessions.id"), nullable=True
    )  # nullable for backward compat during migration
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    period: Mapped[int] = mapped_column(Integer, nullable=False)
    subject_code: Mapped[str] = mapped_column(String(20), ForeignKey("subjects.code"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)  # AttendanceStatus
    ingestion_run_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("ingestion_runs.id"), nullable=True
    )

    student = relationship("Student", back_populates="attendance_records")

    __table_args__ = (
        # §9: Idempotent upsert on (roll_no, date, period) — enforced via student_id
        UniqueConstraint("student_id", "date", "period", name="uq_attendance_student_date_period"),
        Index("ix_attendance_section_date", "date"),
    )


# ─── Calendar ────────────────────────────────────────────────────────────────

class CalendarDay(Base):
    """Academic calendar. Used for holiday-adjacent detection in prediction (§6)."""
    __tablename__ = "calendar_days"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    date: Mapped[date] = mapped_column(Date, unique=True, nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_holiday: Mapped[bool] = mapped_column(Boolean, default=False)


# ─── Peer Survey (§4: NAMED_FRIEND edge source) ──────────────────────────────

class SurveyWave(Base):
    __tablename__ = "survey_waves"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    wave_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class SurveyNomination(Base):
    """
    Raw survey nomination (§3 / §4).
    Becomes NAMED_FRIEND edge with mutual flag and kind property.
    STUDIES_WITH / HANGS_OUT_WITH become a property `kind`, not separate edge types.
    """
    __tablename__ = "survey_nominations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    wave_id: Mapped[str] = mapped_column(String(36), ForeignKey("survey_waves.id"), nullable=False)
    nominator_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id"), nullable=False)
    nominee_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id"), nullable=False)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)  # FriendKind: SITS_WITH, STUDIES_WITH, HANGS_OUT_WITH

    __table_args__ = (
        UniqueConstraint("wave_id", "nominator_id", "nominee_id", "kind", name="uq_survey_nomination"),
    )

    student_id = synonym("nominator_id")
    target_id = synonym("nominee_id")
    relation = synonym("kind")


# Backward compatibility alias
SurveyResponse = SurveyNomination


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


# ─── Observations & Interventions (§4: nodes, not just edges) ─────────────────

class Observation(Base):
    """
    §4: Observation is a graph NODE: Teacher → Observation → Student.
    Teacher-logged event with type, note, timestamp.
    """
    __tablename__ = "observations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    teacher_id: Mapped[str] = mapped_column(String(36), ForeignKey("teachers.id"), nullable=False)
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id"), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(30), nullable=False)  # ObservationCategory
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    teacher = relationship("Teacher", back_populates="observations")
    student = relationship("Student", back_populates="observations_received")


class Intervention(Base):
    """
    §4: Intervention is a graph NODE: Teacher → Intervention → Student.
    Computed props: bunk_rate_14d_before, bunk_rate_14d_after.
    """
    __tablename__ = "interventions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    teacher_id: Mapped[str] = mapped_column(String(36), ForeignKey("teachers.id"), nullable=False)
    type: Mapped[str] = mapped_column(String(30), nullable=False)  # InterventionType
    date: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    follow_up_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    outcome: Mapped[str | None] = mapped_column(String(20), nullable=True)  # InterventionOutcome
    outcome_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # §4: computed props for intervention effectiveness
    bunk_rate_14d_before: Mapped[float | None] = mapped_column(Float, nullable=True)
    bunk_rate_14d_after: Mapped[float | None] = mapped_column(Float, nullable=True)
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


# ─── Derived Data: Graph Edges (§3 / §4) ─────────────────────────────────────

class Edge(Base):
    """
    Derived edges table per §3.
    Every edge carries derived_from, computed_at, params_hash, and evidence.

    For SKIPS_WITH (§5.1):
      - weight = jaccard similarity
      - props stores {c, lift, expected, a, b, N}
      - evidence stores list of co-bunk session IDs
      - p_value = raw hypergeometric p-value
      - q_value = BH-FDR adjusted q-value
      - params_hash = hash of filter params used for this derivation

    Edge is created IFF: c >= min_co_bunks (4) AND lift >= min_lift (2.0) AND q <= fdr_alpha (0.05)
    """
    __tablename__ = "edges"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    src: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    dst: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(20), nullable=False)  # EdgeType
    weight: Mapped[float] = mapped_column(Float, default=1.0)

    # §3 required fields
    props: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # For SKIPS_WITH: {c, lift, expected, a, b, N, jaccard}
    # For NAMED_FRIEND: {kind, mutual}

    derived_from: Mapped[str] = mapped_column(String(50), nullable=False, default="attendance")
    # e.g. "attendance", "survey", "manual"

    params_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Hash of filter params (date range, subject, period, weekday) for cache invalidation.
    # Filtered runs re-derive on filtered sessions and are cached by params_hash.

    computed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    evidence: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # For SKIPS_WITH: list of co-bunk session IDs
    # For NAMED_FRIEND: {wave_id, nominator_roll, nominee_roll}

    # Statistical validation fields (§5.1)
    p_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    q_value: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Filter context
    window_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    window_end: Mapped[date | None] = mapped_column(Date, nullable=True)

    source: Mapped[str] = mapped_column(String(10), default="derived")  # EdgeSource

    __table_args__ = (
        Index("ix_edge_src_dst_type", "src", "dst", "type"),
    )


# ─── Derived Data: Analysis Snapshots (§3) ───────────────────────────────────

class AnalysisSnapshot(Base):
    """
    Versioned analysis snapshots per §3.
    Stores groups, patterns, and predictions for a section at a point in time.
    Used for stable group IDs (§5.2) and drift tracking (§6).
    """
    __tablename__ = "analysis_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    section_id: Mapped[str] = mapped_column(String(36), ForeignKey("sections.id"), nullable=False, index=True)
    snapshot_type: Mapped[str] = mapped_column(String(30), nullable=False)
    # "groups" | "patterns" | "predictions"

    params_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    data: Mapped[dict] = mapped_column(JSON, nullable=False)
    # For groups: {groups: [{id, members: [roll_no], jaccard_overlap_prev, friend_overlap}]}
    # For patterns: {patterns: [{student_roll, type: PatternType, evidence: str, ...}]}
    # For predictions: {predictions: [{student_roll, session_id, p_bunk, reasons, ...}]}

    computed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    superseded_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    # Points to the next snapshot that replaced this one


# ─── Derived Data: Student Patterns (§5.3) ───────────────────────────────────

class StudentPattern(Base):
    """
    Rule-based flags per §5.3. Each flag has a computed evidence string.
    There is NO composite 'trouble score' (§5.3).
    """
    __tablename__ = "student_patterns"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.id"), nullable=False, index=True)
    section_id: Mapped[str] = mapped_column(String(36), ForeignKey("sections.id"), nullable=False)
    pattern_type: Mapped[str] = mapped_column(String(30), nullable=False)  # PatternType
    evidence: Mapped[str] = mapped_column(Text, nullable=False)
    # Human-readable evidence string, e.g. "Attendance 68% (below 75% minimum). Can still miss 4 sessions."
    evidence_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # Machine-readable evidence, e.g. {current_pct: 68, threshold: 75, sessions_remaining: 4}
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    dismissed: Mapped[bool] = mapped_column(Boolean, default=False)
    dismissed_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    snapshot_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("analysis_snapshots.id"), nullable=True)
    computed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


# ─── Security & Audit (§10) ──────────────────────────────────────────────────

class ConsentRecord(Base):
    """§10: DPDP Act 2023 — consent for survey data, verifiable parental consent for under-18."""
    __tablename__ = "consent_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    notice_version: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)  # ConsentStatus
    purpose: Mapped[str] = mapped_column(String(50), default="general")
    recorded_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class ContestRequest(Base):
    """§10: Student contest/correction/erasure request."""
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
    Hash-chained audit log (§10).
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


# ─── Ingestion (§9) ──────────────────────────────────────────────────────────

class IngestionRun(Base):
    """
    §3 / §9: ingestion_runs table.
    Async job, dry-run mode, idempotent.
    After ingest, recompute SKIPS_WITH, groups, patterns and predictions
    for the affected sections in under 5 seconds.
    """
    __tablename__ = "ingestion_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    file_type: Mapped[str] = mapped_column(String(20), nullable=False)  # IngestionFileType
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    uploaded_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # IngestionRunStatus
    rows_ok: Mapped[int] = mapped_column(Integer, default=0)
    rows_rejected: Mapped[int] = mapped_column(Integer, default=0)
    errors: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # §9: Unknown roll numbers go into error report, never silently dropped.
    is_dry_run: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


# Backward-compatibility alias
IngestionBatch = IngestionRun


# ─── Prediction Model Registry (§6) ──────────────────────────────────────────

class ModelRegistry(Base):
    """
    §6: Track prediction models.
    Retrain weekly and log drift. Report PR-AUC, precision@10, Brier score,
    lift over baseline in docs/MODEL_CARD.md.
    """
    __tablename__ = "model_registry"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    model_type: Mapped[str] = mapped_column(String(30), nullable=False)
    # "baseline" | "logistic" | "lightgbm"
    training_window_start: Mapped[date] = mapped_column(Date, nullable=False)
    training_window_end: Mapped[date] = mapped_column(Date, nullable=False)
    metrics: Mapped[dict] = mapped_column(JSON, nullable=False)
    # {pr_auc, precision_at_10, brier_score, calibration, lift_over_baseline}
    features_used: Mapped[dict] = mapped_column(JSON, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


# ─── Job Tracking ────────────────────────────────────────────────────────────

class JobRun(Base):
    __tablename__ = "job_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    job_name: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)  # "running" | "success" | "failed"
    started_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
