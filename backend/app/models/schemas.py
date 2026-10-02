"""
Makerove — Pydantic Schemas

Request and response models for the API. All request models use `extra="forbid"`.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field, ConfigDict


# ─── Auth Schemas ─────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=1, max_length=128)


class ChangePasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)


class UserResponse(BaseModel):
    id: str
    username: str
    role: str
    must_change_password: bool
    is_active: bool
    teacher_id: str | None = None
    student_id: str | None = None


class AuthMeResponse(BaseModel):
    user: UserResponse
    csrf_token: str
    scope: ScopeResponse | None = None
    consent_accepted: bool = False


class ScopeResponse(BaseModel):
    section_ids: list[str] = []
    department: str | None = None
    student_id: str | None = None
    teacher_id: str | None = None


# ─── Consent Schemas ──────────────────────────────────────────────────────────

class ConsentNoticeResponse(BaseModel):
    version: str
    text: str
    accepted: bool


class ConsentAcceptRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    purpose: str = "general"


# ─── Health Check ─────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    app_name: str
    database: str
    scheduler: str
    last_job: dict | None = None
    llm: dict | None = None


# ─── Section & Student Schemas ────────────────────────────────────────────────

class SectionResponse(BaseModel):
    id: str
    code: str
    semester: int
    strength: int
    department: str


class StudentBriefResponse(BaseModel):
    """Masked student response — names shown as initials by default (G12)."""
    id: str
    roll_no_masked: str  # Only initials shown
    section_code: str
    branch: str
    year: int
    is_minor: bool
    status: str


class StudentDetailResponse(BaseModel):
    """Full student detail — only available after audited reveal."""
    id: str
    roll_no: str
    name: str
    section_code: str
    branch: str
    year: int
    dob: date
    is_minor: bool
    status: str
    support_program: bool


# ─── Observation & Intervention Schemas ───────────────────────────────────────

class CreateObservationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    student_id: str
    category: str  # ObservationCategory
    note: str | None = None
    date: date


class ObservationResponse(BaseModel):
    id: str
    teacher_id: str
    student_id: str
    category: str
    note: str | None
    date: date
    created_at: datetime


class CreateInterventionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    student_ids: list[str]
    type: str  # InterventionType
    date: date
    notes: str | None = None
    follow_up_date: date | None = None


class InterventionResponse(BaseModel):
    id: str
    teacher_id: str
    type: str
    date: date
    notes: str | None
    follow_up_date: date | None
    outcome: str | None
    outcome_date: date | None
    student_ids: list[str]
    created_at: datetime


class UpdateOutcomeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    outcome: str  # InterventionOutcome
    outcome_date: date


# ─── Group Absence Schemas ────────────────────────────────────────────────────

class GroupAbsenceEventResponse(BaseModel):
    id: str
    section_id: str
    date: date
    period: int
    subject_code: str
    absent_count: int
    baseline_share: float
    cohesion: float
    score: float
    band: str
    status: str
    explanation: dict | None = None
    created_at: datetime


class DismissRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: str = Field(..., min_length=1, max_length=500)


# ─── Scoring Schemas ─────────────────────────────────────────────────────────

class ScoreResponse(BaseModel):
    student_id: str
    score_type: str
    score: float
    band: str
    components: dict
    is_recovering: bool = False
    excluded_medical: bool = False
    window_start: date
    window_end: date


# ─── Calendar Risk Schemas ────────────────────────────────────────────────────

class CalendarRiskResponse(BaseModel):
    section_id: str
    date: date
    period: int
    predicted_absent_share: float
    baseline_share: float
    band: str
    drivers: dict | None = None
    model_used: str


# ─── Ingestion Schemas ────────────────────────────────────────────────────────

class IngestionReportResponse(BaseModel):
    batch_id: str
    file_type: str
    file_name: str
    rows_ok: int
    rows_rejected: int
    is_dry_run: bool
    report: dict | None = None
    created_at: datetime


# ─── Contest / Erasure ────────────────────────────────────────────────────────

class ContestRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: str  # "contest" | "correction" | "erasure"
    description: str = Field(..., min_length=10, max_length=2000)


class ContestResponse(BaseModel):
    id: str
    student_id: str
    type: str
    description: str
    status: str
    created_at: datetime
    resolved_at: datetime | None = None


# ─── Audit Schemas ────────────────────────────────────────────────────────────

class AuditVerifyResponse(BaseModel):
    valid: bool
    total_entries: int
    first_broken_seq: int | None
    message: str


class AccessLogEntry(BaseModel):
    ts: datetime
    action: str
    entity_type: str
    purpose: str


# Fix forward reference
AuthMeResponse.model_rebuild()
