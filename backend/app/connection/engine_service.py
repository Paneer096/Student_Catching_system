"""
Engine Service — Wiring Makarov Connection Engine v3 into the backend.
Implements §7.2 (Engine job), §7.3 (Graph & diagnostics API logic), §7.5 (Shuffle control).
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import uuid
from datetime import datetime, date, timezone
from typing import Any, Optional

import numpy as np
import pandas as pd
from loguru import logger
from sqlalchemy import select, and_, or_, delete
from sqlalchemy.ext.asyncio import AsyncSession

from makarov_engine.config import EngineConfig
from makarov_engine.engine import EngineResult, run_engine, pair_evidence
from makarov_engine.payload import build_graph_payload
from makarov_engine.diagnostics import shuffle_control
from makarov_engine.statuses import normalize_statuses
from app.models.orm import (
    Student,
    Section,
    Attendance,
    SessionEvent,
    Leave,
    MembershipTie,
    PeerNomination,
    EngineRun,
    DerivedEdge,
    EdgeDismissal,
    TeacherConnection,
    AuditLog,
)

SENSITIVITY = {
    "strict": 0.05,
    "balanced": 0.10,
    "exploratory": 0.20,
}

# In-memory store for previous groups: {section_code: {group_id: set(members)}}
_PREV_GROUPS: dict[str, dict[int, set[str]]] = {}

# In-memory cache for recent graph runs: (section, params_hash, data_version) -> (EngineResult, payload)
_ENGINE_CACHE: dict[str, tuple[EngineResult, dict]] = {}

# Background jobs registry: job_id -> {status, result, error, created_at}
_BACKGROUND_JOBS: dict[str, dict[str, Any]] = {}


async def get_data_version(db: AsyncSession, section_code: str) -> int:
    """Computes data_version as a combined count/version of records for this section."""
    stmt = select(Attendance).join(
        Student, Student.roll_no == Attendance.roll_no
    ).where(
        or_(
            Student.section_code == section_code,
            Student.section_id.in_(
                select(Section.id).where(Section.code == section_code)
            ),
        )
    )
    res = await db.execute(stmt)
    att_count = len(res.scalars().all())

    tc_stmt = select(TeacherConnection.id).where(TeacherConnection.section_code == section_code)
    tc_res = await db.execute(tc_stmt)
    tc_count = len(tc_res.scalars().all())

    return att_count + tc_count * 1000000


async def load_attendance(db: AsyncSession, section_code: str) -> pd.DataFrame:
    """Loads attendance for students in section_code, returning canonical statuses only."""
    # Find students for section
    st_stmt = select(Student).where(
        or_(
            Student.section_code == section_code,
            Student.section_id.in_(
                select(Section.id).where(Section.code == section_code)
            ),
        )
    )
    st_res = await db.execute(st_stmt)
    students = st_res.scalars().all()
    if not students:
        return pd.DataFrame(columns=["date", "roll_no", "period", "subject_code", "status"])

    rolls = [s.roll_no for s in students if s.roll_no]
    st_ids = [s.id for s in students]

    att_stmt = select(Attendance).where(
        or_(
            Attendance.roll_no.in_(rolls),
            Attendance.student_id.in_(st_ids),
        )
    )
    att_res = await db.execute(att_stmt)
    records = att_res.scalars().all()

    # Map student_id back to roll_no if roll_no column is empty
    id_to_roll = {s.id: s.roll_no for s in students}
    rows = []
    for r in records:
        r_roll = r.roll_no or id_to_roll.get(r.student_id)
        if not r_roll:
            continue
        rows.append({
            "roll_no": str(r_roll).strip().upper(),
            "date": r.date,
            "period": int(r.period),
            "subject_code": str(r.subject_code or "").strip().upper(),
            "status": str(r.status or "").strip().upper(),
        })

    if not rows:
        return pd.DataFrame(columns=["date", "roll_no", "period", "subject_code", "status"])

    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"])
    canon, _ = normalize_statuses(df["status"])
    df["status"] = canon
    df = df.dropna(subset=["status"]).reset_index(drop=True)
    return df


async def load_session_events(
    db: AsyncSession, section_code: str, types: set[str] | None = None
) -> Optional[pd.DataFrame]:
    """Loads session events (cancelled/teacher absent) for section_code or college-wide."""
    stmt = select(SessionEvent).where(
        or_(
            SessionEvent.section_code == section_code,
            SessionEvent.section_code.is_(None),
            SessionEvent.section_code == "",
        )
    )
    if types:
        stmt = stmt.where(SessionEvent.event_type.in_(types))

    res = await db.execute(stmt)
    records = res.scalars().all()
    if not records:
        return None

    rows = [{
        "date": r.date,
        "event_type": r.event_type,
        "period": r.period,
        "section_code": r.section_code,
        "note": r.note,
    } for r in records]
    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"])
    return df


async def load_leaves(db: AsyncSession, section_code: str) -> Optional[pd.DataFrame]:
    """Loads approved medical/OD leaves for section's students."""
    st_stmt = select(Student.roll_no).where(
        or_(
            Student.section_code == section_code,
            Student.section_id.in_(
                select(Section.id).where(Section.code == section_code)
            ),
        )
    )
    st_res = await db.execute(st_stmt)
    rolls = [r[0] for r in st_res.all() if r[0]]
    if not rolls:
        return None

    stmt = select(Leave).where(Leave.roll_no.in_(rolls))
    res = await db.execute(stmt)
    records = res.scalars().all()
    if not records:
        return None

    rows = [{
        "roll_no": r.roll_no,
        "from_date": r.from_date,
        "to_date": r.to_date,
        "leave_type": r.leave_type,
    } for r in records]
    df = pd.DataFrame(rows)
    df["from_date"] = pd.to_datetime(df["from_date"])
    df["to_date"] = pd.to_datetime(df["to_date"])
    return df


async def load_membership_ties(db: AsyncSession, section_code: str) -> Optional[pd.DataFrame]:
    """Loads membership ties for section's students."""
    st_stmt = select(Student.roll_no).where(
        or_(
            Student.section_code == section_code,
            Student.section_id.in_(
                select(Section.id).where(Section.code == section_code)
            ),
        )
    )
    st_res = await db.execute(st_stmt)
    rolls = [r[0] for r in st_res.all() if r[0]]
    if not rolls:
        return None

    stmt = select(MembershipTie).where(MembershipTie.roll_no.in_(rolls))
    res = await db.execute(stmt)
    records = res.scalars().all()
    if not records:
        return None

    rows = [{
        "roll_no": r.roll_no,
        "tie_type": r.tie_type,
        "key": r.key,
        "valid_from": r.valid_from,
        "valid_to": r.valid_to,
    } for r in records]
    df = pd.DataFrame(rows)
    df["valid_from"] = pd.to_datetime(df["valid_from"])
    df["valid_to"] = pd.to_datetime(df["valid_to"])
    return df


async def load_peer_nominations(db: AsyncSession, section_code: str) -> Optional[pd.DataFrame]:
    """Loads peer survey nominations for section's students."""
    st_stmt = select(Student.roll_no).where(
        or_(
            Student.section_code == section_code,
            Student.section_id.in_(
                select(Section.id).where(Section.code == section_code)
            ),
        )
    )
    st_res = await db.execute(st_stmt)
    rolls = [r[0] for r in st_res.all() if r[0]]
    if not rolls:
        return None

    stmt = select(PeerNomination).where(
        or_(
            PeerNomination.respondent.in_(rolls),
            PeerNomination.nominee.in_(rolls),
        )
    )
    res = await db.execute(stmt)
    records = res.scalars().all()
    if not records:
        return None

    rows = [{
        "respondent": r.respondent,
        "nominee": r.nominee,
        "tie_type": r.tie_type,
        "mutual": bool(r.mutual),
        "survey_date": r.survey_date,
    } for r in records]
    df = pd.DataFrame(rows)
    df["survey_date"] = pd.to_datetime(df["survey_date"])
    return df


async def load_student_names(db: AsyncSession, section_code: str) -> dict[str, str]:
    """Returns {roll_no: name} mapping for the section."""
    stmt = select(Student).where(
        or_(
            Student.section_code == section_code,
            Student.section_id.in_(
                select(Section.id).where(Section.code == section_code)
            ),
        )
    )
    res = await db.execute(stmt)
    students = res.scalars().all()
    return {s.roll_no: s.name for s in students if s.roll_no}


async def load_dismissals(db: AsyncSession, section_code: str) -> set[frozenset[str]]:
    """Loads dismissed pair edges for section_code."""
    stmt = select(EdgeDismissal).where(EdgeDismissal.section_code == section_code)
    res = await db.execute(stmt)
    records = res.scalars().all()
    return {frozenset((r.student_a, r.student_b)) for r in records}


async def load_teacher_connections(db: AsyncSession, section_code: str) -> list[TeacherConnection]:
    """Loads all teacher manual connections for section_code."""
    stmt = select(TeacherConnection).where(TeacherConnection.section_code == section_code)
    res = await db.execute(stmt)
    return list(res.scalars().all())


async def create_teacher_connection(
    db: AsyncSession,
    section_code: str,
    student_a: str,
    student_b: str,
    connection_type: str = "STUDIES_WITH",
    weight: float = 1.0,
    notes: str | None = None,
    created_by: str = "teacher",
) -> TeacherConnection:
    """Creates or updates a teacher manual student connection."""
    a, b = sorted([student_a.strip().upper(), student_b.strip().upper()])
    stmt = select(TeacherConnection).where(
        TeacherConnection.section_code == section_code,
        TeacherConnection.student_a == a,
        TeacherConnection.student_b == b,
        TeacherConnection.connection_type == connection_type,
    )
    res = await db.execute(stmt)
    existing = res.scalar_one_or_none()
    now = datetime.now(timezone.utc)

    if existing:
        existing.weight = weight
        existing.notes = notes
        existing.created_by = created_by
        existing.updated_at = now
        conn = existing
    else:
        conn = TeacherConnection(
            id=str(uuid.uuid4()),
            section_code=section_code,
            student_a=a,
            student_b=b,
            connection_type=connection_type,
            weight=weight,
            notes=notes,
            created_by=created_by,
            created_at=now,
            updated_at=now,
        )
        db.add(conn)

    await db.commit()
    await db.refresh(conn)

    # Invalidate engine cache completely
    _ENGINE_CACHE.clear()

    return conn


async def delete_teacher_connection(
    db: AsyncSession,
    connection_id: str,
    section_code: str,
) -> bool:
    """Deletes a teacher manual connection."""
    stmt = select(TeacherConnection).where(
        TeacherConnection.id == connection_id,
        TeacherConnection.section_code == section_code,
    )
    res = await db.execute(stmt)
    conn = res.scalar_one_or_none()
    if not conn:
        return False

    await db.delete(conn)
    await db.commit()

    # Invalidate engine cache completely
    _ENGINE_CACHE.clear()

    return True


async def compute_graph(
    db: AsyncSession,
    section_code: str,
    sensitivity: str = "strict",
    filters: dict | None = None,
    overlays: tuple = (),
    include_dismissed: bool = False,
) -> tuple[EngineResult, dict]:
    """
    Computes bunk-graph payload per §7.2.
    Cache key: (section, params_hash, filters, sensitivity, data_version).
    """
    filters = filters or {}
    alpha = SENSITIVITY.get(sensitivity, 0.05)
    cfg = EngineConfig(fdr_alpha=alpha)
    data_ver = await get_data_version(db, section_code)

    # Compute cache key
    raw_key = f"{section_code}:{sensitivity}:{json.dumps(filters, sort_keys=True)}:{overlays}:{include_dismissed}:{data_ver}"
    cache_key = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

    if cache_key in _ENGINE_CACHE:
        return _ENGINE_CACHE[cache_key]

    att = await load_attendance(db, section_code)
    cancelled = await load_session_events(db, section_code, types={"CANCELLED", "TEACHER_ABSENT"})
    leaves = await load_leaves(db, section_code)
    mem = await load_membership_ties(db, section_code)
    nom = await load_peer_nominations(db, section_code)
    names = await load_student_names(db, section_code)
    dismissed = await load_dismissals(db, section_code)
    teacher_conns = await load_teacher_connections(db, section_code)

    prev = _PREV_GROUPS.get(section_code) if not filters else None

    # Run connection engine
    res = run_engine(att, cfg, cancelled=cancelled, leaves=leaves, prev_groups=prev, **filters)

    # Only the unfiltered Strict run updates stored group IDs (§7.2)
    if not filters and sensitivity == "strict" and res.status == "OK":
        _PREV_GROUPS[section_code] = {g["group_id"]: set(g["members"]) for g in res.groups}

    # Build drawing payload
    payload = build_graph_payload(
        res,
        names=names,
        memberships=mem,
        nominations=nom,
        overlays=overlays,
        dismissed=dismissed,
        include_dismissed=include_dismissed,
        manual_connections=teacher_conns,
    )

    # Persist engine run and edges to database if status is OK
    try:
        run_record = EngineRun(
            run_id=str(uuid.uuid4()),
            section_code=section_code,
            params_hash=res.params_hash,
            filters_json=filters,
            data_version=data_ver,
            status=res.status,
            quality_json=res.quality,
            computed_at=datetime.now(timezone.utc),
        )
        db.add(run_record)
        await db.flush()

        if len(res.edges):
            for row in res.edges.itertuples():
                edge_obj = DerivedEdge(
                    id=str(uuid.uuid4()),
                    run_id=run_record.run_id,
                    student_a=row.student_a,
                    student_b=row.student_b,
                    c_cells=int(row.c_cells),
                    co_dates=int(row.co_dates),
                    expected=float(row.expected),
                    lift=float(row.lift),
                    p_value=float(row.p_value),
                    q_value=float(row.q_value),
                    weight=float(row.weight),
                    source_type=row.source_type,
                    derived_from=row.derived_from,
                    evidence_json={"jaccard": float(row.jaccard)},
                )
                db.add(edge_obj)
        await db.commit()
    except Exception as e:
        logger.warning(f"Failed to persist engine run to DB: {e}")
        await db.rollback()

    _ENGINE_CACHE[cache_key] = (res, payload)
    return res, payload


async def get_pair_evidence_data(
    db: AsyncSession, section_code: str, student_a: str, student_b: str
) -> dict:
    """Returns pair evidence payload for student_a and student_b."""
    res, _ = await compute_graph(db, section_code, sensitivity="strict")
    if res.status != "OK":
        raise ValueError(f"Engine status not OK: {res.message}")
    return pair_evidence(res, student_a, student_b)


async def dismiss_edge(
    db: AsyncSession,
    section_code: str,
    student_a: str,
    student_b: str,
    reason: str,
    dismissed_by: str,
) -> dict:
    """Records an edge dismissal per §7.3."""
    a, b = sorted([student_a.strip().upper(), student_b.strip().upper()])
    stmt = select(EdgeDismissal).where(
        EdgeDismissal.section_code == section_code,
        EdgeDismissal.student_a == a,
        EdgeDismissal.student_b == b,
    )
    res = await db.execute(stmt)
    existing = res.scalar_one_or_none()
    now = datetime.now(timezone.utc)

    if existing:
        existing.reason = reason
        existing.dismissed_by = dismissed_by
        existing.dismissed_at = now
    else:
        new_d = EdgeDismissal(
            id=str(uuid.uuid4()),
            section_code=section_code,
            student_a=a,
            student_b=b,
            reason=reason,
            dismissed_by=dismissed_by,
            dismissed_at=now,
        )
        db.add(new_d)

    await db.commit()
    # Invalidate cached graph
    keys_to_del = [k for k in _ENGINE_CACHE if k.startswith(section_code)]
    for k in keys_to_del:
        _ENGINE_CACHE.pop(k, None)

    return {"dismissed": True, "updated_at": now.isoformat()}


async def run_shuffle_control_job(section_code: str, n_runs: int = 20) -> str:
    """Launches async shuffle_control job and returns job_id."""
    job_id = str(uuid.uuid4())
    _BACKGROUND_JOBS[job_id] = {
        "status": "RUNNING",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "result": None,
        "error": None,
    }

    async def _runner():
        from app.db import async_session_factory
        async with async_session_factory() as db:
            try:
                att = await load_attendance(db, section_code)
                cancelled = await load_session_events(db, section_code, types={"CANCELLED", "TEACHER_ABSENT"})
                leaves = await load_leaves(db, section_code)
                # Run CPU diagnostic
                res = shuffle_control(att, cfg=EngineConfig(), n_runs=n_runs, cancelled=cancelled, leaves=leaves)
                _BACKGROUND_JOBS[job_id]["status"] = "SUCCESS"
                _BACKGROUND_JOBS[job_id]["result"] = res
            except Exception as e:
                logger.error(f"Shuffle control job failed: {e}")
                _BACKGROUND_JOBS[job_id]["status"] = "FAILED"
                _BACKGROUND_JOBS[job_id]["error"] = str(e)

    asyncio.create_task(_runner())
    return job_id


def get_job_status(job_id: str) -> dict[str, Any] | None:
    return _BACKGROUND_JOBS.get(job_id)
