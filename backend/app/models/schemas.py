"""
Makarov — Pydantic Schemas

Request and response models for the API per §8.
All request models use `extra="forbid"`.
Vocabulary enforced per §5.3 and §10 — no stigmatizing language.
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


# ─── Section Schemas ──────────────────────────────────────────────────────────

class SectionResponse(BaseModel):
    id: str
    code: str
    semester: int
    strength: int
    department: str


class SectionSummaryResponse(BaseModel):
    """GET /api/sections/{id}/summary per §7 screen 2 / §8."""
    id: str
    code: str
    semester: int
    strength: int
    department: str
    attendance_pct: float
    bunk_rate: float
    students_below_min: int
    # weekday × period bunk heatmap data (§7 screen 2)
    bunk_heatmap: list[dict[str, Any]] = []
    # per-subject bunk rate bar chart data (§7 screen 2)
    subject_bunk_rates: list[dict[str, Any]] = []


# ─── Student Schemas ─────────────────────────────────────────────────────────

class StudentBriefResponse(BaseModel):
    """Masked student response — names shown as initials by default (§10, G12)."""
    id: str
    roll_no_masked: str  # Only initials shown
    section_code: str
    branch: str
    year: int
    is_minor: bool
    status: str


class StudentDetailResponse(BaseModel):
    """Full student detail — only available after audited reveal (§10)."""
    id: str
    roll_no: str
    name: str
    section_code: str
    branch: str
    year: int
    dob: date
    is_minor: bool
    status: str


# ─── Academic Session Schemas (§2) ────────────────────────────────────────────

class AcademicSessionResponse(BaseModel):
    """A scheduled class that was actually held (§2). Used in evidence panels."""
    id: str
    section_id: str
    subject_code: str
    teacher_id: str
    date: date
    period: int
    was_held: bool


# ─── Observation & Intervention Schemas (§4) ──────────────────────────────────

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
    """§4: Includes computed bunk_rate_14d_before and bunk_rate_14d_after."""
    id: str
    teacher_id: str
    type: str
    date: date
    notes: str | None
    follow_up_date: date | None
    outcome: str | None
    outcome_date: date | None
    bunk_rate_14d_before: float | None = None
    bunk_rate_14d_after: float | None = None
    student_ids: list[str]
    created_at: datetime


class UpdateOutcomeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    outcome: str  # InterventionOutcome
    outcome_date: date


# ─── Graph Edge Schemas (§3 / §4) ────────────────────────────────────────────

class EdgeResponse(BaseModel):
    """
    Derived edge per §3 / §4.
    Every edge carries derived_from, computed_at, params_hash, and evidence (§13).
    """
    id: str
    src: str
    dst: str
    type: str  # EdgeType
    weight: float
    props: dict | None = None
    # For SKIPS_WITH: {c, lift, expected, a, b, N, jaccard}
    # For NAMED_FRIEND: {kind, mutual}
    derived_from: str
    params_hash: str | None = None
    computed_at: datetime
    evidence: dict | list | None = None
    # For SKIPS_WITH: list of co-bunk session IDs
    # For NAMED_FRIEND: {wave_id, nominator_roll, nominee_roll}
    p_value: float | None = None
    q_value: float | None = None
    window_start: date | None = None
    window_end: date | None = None
    source: str


class PairEvidenceResponse(BaseModel):
    """
    GET /api/pairs/{roll_a}/{roll_b}/evidence per §8.
    Lists co-bunk sessions with a plain-language explanation (§7):
    e.g. "Skipped together 7 times; if independent we'd expect about 2."
    """
    roll_a: str
    roll_b: str
    edge: EdgeResponse | None = None
    co_bunk_sessions: list[AcademicSessionResponse] = []
    explanation: str = ""


# ─── Bunk Graph Schemas (§7 / §8) ────────────────────────────────────────────

class BunkGroupResponse(BaseModel):
    """
    Bunk group from Leiden/Louvain on SKIPS_WITH graph (§5.2).
    Groups are analysis results, never graph nodes (§4).
    """
    id: str
    members: list[str]  # list of roll numbers
    member_count: int
    jaccard_overlap_prev: float | None = None
    friend_overlap: str | None = None
    # e.g. "4 of 5 members are mutual friends" (§5.2)


class BunkGraphNode(BaseModel):
    """Node in the bunk graph visualization (§7)."""
    id: str
    roll_no: str
    label: str  # initials or full name depending on anonymize toggle
    bunk_rate_30d: float = 0.0
    # §7: student size = bunk rate over last 30 days
    p_bunk: float | None = None
    # §7: student color = single-hue sequential scale for predicted bunk probability
    patterns: list[str] = []
    # Active PatternType values — shown as small icon or ring (§7)
    group_id: str | None = None


class BunkGraphEdge(BaseModel):
    """Edge in the bunk graph visualization (§7)."""
    src: str
    dst: str
    type: str  # EdgeType
    weight: float  # jaccard for SKIPS_WITH
    co_bunks: int = 0
    lift: float = 0.0


class BunkGraphResponse(BaseModel):
    """
    GET /api/sections/{id}/bunk-graph per §8.
    Filter params: from, to, subject, period, weekday, overlays.
    §7: Landing view = validated SKIPS_WITH subgraph only.
    Students with no edges are NOT drawn; they appear in no_edge_students (§7).
    """
    section_id: str
    params_hash: str | None = None
    nodes: list[BunkGraphNode] = []
    edges: list[BunkGraphEdge] = []
    groups: list[BunkGroupResponse] = []
    no_edge_students: list[StudentBriefResponse] = []
    computed_at: datetime | None = None


# ─── Student Pattern Schemas (§5.3) ──────────────────────────────────────────

class StudentPatternResponse(BaseModel):
    """
    Rule-based flag per §5.3. Each flag has a computed evidence string.
    There is NO composite 'trouble score' (§5.3).
    The only numeric risk is the prediction probability (§6).
    """
    id: str
    student_id: str
    section_id: str
    pattern_type: str  # PatternType
    evidence: str
    # Human-readable, e.g. "Attendance 68% (below 75% minimum). Can still miss 4 sessions."
    evidence_data: dict | None = None
    is_active: bool
    dismissed: bool = False
    dismissed_reason: str | None = None
    computed_at: datetime


# ─── Analysis Snapshot Schemas (§3) ──────────────────────────────────────────

class AnalysisSnapshotResponse(BaseModel):
    """Versioned analysis snapshot per §3. Stores groups, patterns, predictions."""
    id: str
    section_id: str
    snapshot_type: str  # "groups" | "patterns" | "predictions"
    params_hash: str
    data: dict
    computed_at: datetime


# ─── Today Watchlist / Prediction Schemas (§6 / §8) ──────────────────────────

class WatchlistItem(BaseModel):
    """
    A single row in the Today watchlist (§7 screen 1).
    Per-period ranked with probability bands and top-3 reason chips (§6).
    """
    student_id: str
    roll_no: str
    name_masked: str  # initials by default (§10)
    section_code: str
    session_id: str | None = None
    period: int | None = None
    subject_code: str | None = None
    p_bunk: float
    # Probability of bunk for this (student, upcoming session) — §6
    band: str
    # "high" | "medium" | "low" per prediction.probability_bands thresholds
    reasons: list[str] = []
    # Top-3 reason chips (coefficients or SHAP) — §6
    last_bunk_date: date | None = None
    confidence: str = "normal"
    # "low" if cold-start (< 4 weeks data) — §6


class TodayWatchlistResponse(BaseModel):
    """
    GET /api/today per §8.
    The home screen (§1): ranked watchlist of students likely to bunk.
    """
    date: date
    period: int | None = None
    items: list[WatchlistItem] = []
    model_type: str = "baseline"
    # "baseline" | "logistic" | "lightgbm" — which model produced these (§6)


# ─── Student Timeline Schemas (§7 screen 4 / §8) ────────────────────────────

class TimelineEntry(BaseModel):
    """A single entry in a student's timeline (§7 screen 4)."""
    date: date
    period: int | None = None
    type: str
    # "attendance" | "pattern" | "observation" | "intervention" | "prediction"
    summary: str
    detail: dict | None = None


class StudentTimelineResponse(BaseModel):
    """
    GET /api/students/{roll}/timeline per §8.
    §7 screen 4: timeline, patterns, partners, observations, interventions.
    """
    student_id: str
    roll_no: str
    entries: list[TimelineEntry] = []
    patterns: list[StudentPatternResponse] = []
    bunk_partners: list[str] = []
    # roll numbers of SKIPS_WITH partners


# ─── Flag Dismiss Schemas (§8) ───────────────────────────────────────────────

class DismissFlagRequest(BaseModel):
    """POST /api/flags/{id}/dismiss — false-positive feedback (§8)."""
    model_config = ConfigDict(extra="forbid")
    reason: str = Field(..., min_length=1, max_length=500)


class DismissFlagResponse(BaseModel):
    id: str
    dismissed: bool
    dismissed_reason: str
    dismissed_at: datetime


# ─── Ingestion Schemas (§9) ──────────────────────────────────────────────────

class IngestionReportResponse(BaseModel):
    """
    GET /api/ingest/{run_id} per §8.
    §9: Unknown roll numbers go into error report, never silently dropped.
    """
    run_id: str
    file_type: str
    file_name: str
    status: str  # IngestionRunStatus
    rows_ok: int
    rows_rejected: int
    is_dry_run: bool
    errors: dict | None = None
    created_at: datetime


# ─── Contest / Erasure (§10) ──────────────────────────────────────────────────

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


# ─── Audit Schemas (§10) ─────────────────────────────────────────────────────

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


# ─── General Dismiss (backward compat) ───────────────────────────────────────

class DismissRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: str = Field(..., min_length=1, max_length=500)


# Fix forward reference
AuthMeResponse.model_rebuild()
