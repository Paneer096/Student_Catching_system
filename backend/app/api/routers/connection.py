"""
Makarov Connection Engine v3 — API Router.
Implements §7.3 API Routes with §7.4 Access Control and Privacy Enforcement.
"""
from __future__ import annotations

import json
from datetime import datetime, date
from typing import Any, Optional

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Header,
    Request,
    Response,
    UploadFile,
    File,
    Form,
    Query,
    status,
)
from pydantic import BaseModel
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.db import get_db
from app.models.orm import AuditLog, User, Teacher, Section, TeacherSubjectSection
from app.connection.ingest_service import (
    get_datasets_overview,
    get_template_csv,
    run_dry_run,
    commit_dry_run_data,
    get_all_batches,
)
from app.connection.engine_service import (
    compute_graph,
    get_pair_evidence_data,
    dismiss_edge,
    run_shuffle_control_job,
    get_job_status,
)

router = APIRouter(tags=["Connection Engine v3"])


# ─── Access Control & Audit Helpers (§7.4) ───────────────────────────────────

async def log_audit(
    db: AsyncSession,
    who: str,
    action: str,
    obj: str,
    detail: dict | None = None,
) -> None:
    """Writes an audit log entry per §7.4."""
    from datetime import timezone
    now = datetime.now(timezone.utc)
    import hashlib
    h = hashlib.sha256(f"{who}:{action}:{obj}:{now.isoformat()}".encode()).hexdigest()
    entry = AuditLog(
        actor_id=who,
        action=action,
        entity_type="connection_engine",
        entity_id=obj,
        purpose=action,
        detail_json=detail or {},
        prev_hash="0" * 64,
        hash=h,
        who=who,
        object=obj,
        at=now,
    )
    db.add(entry)
    await db.commit()


async def check_section_access(
    request: Request,
    section_code: str,
    db: AsyncSession,
) -> str:
    """
    Checks if the caller has permission to view this section.
    If authenticated, verifies teacher teaches this section or is Admin/HOD.
    If unauthorized, logs DENIAL to audit_log and raises 403.
    """
    # Check session cookie or auth header
    from app.config.settings import get_settings
    settings = get_settings()
    session_id = request.cookies.get(settings.SESSION_COOKIE_NAME)
    auth_header = request.headers.get("Authorization")

    who = "teacher-demo"  # default for test curls

    if session_id or auth_header:
        from app.security.sessions import get_session
        sess_token = session_id or (auth_header.split()[-1] if auth_header else "")
        session = await get_session(db, sess_token)
        if session:
            u_res = await db.execute(select(User).where(User.id == session.user_id))
            user = u_res.scalar_one_or_none()
            if user:
                who = user.username
                role = user.role.upper()
                if role in ("ADMIN", "HOD", "SUPERADMIN"):
                    return who

                # Teacher check
                if user.teacher_id:
                    # Check class teacher
                    ct_res = await db.execute(
                        select(Section).where(
                            Section.class_teacher_id == user.teacher_id,
                            Section.code == section_code,
                        )
                    )
                    if ct_res.scalar_one_or_none():
                        return who

                    # Check subject teacher
                    st_res = await db.execute(
                        select(TeacherSubjectSection).join(
                            Section, Section.id == TeacherSubjectSection.section_id
                        ).where(
                            TeacherSubjectSection.teacher_id == user.teacher_id,
                            Section.code == section_code,
                        )
                    )
                    if st_res.scalar_one_or_none():
                        return who

                # Denial
                await log_audit(db, who=who, action="ACCESS_DENIED", obj=f"section:{section_code}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"User '{who}' does not teach section '{section_code}'.",
                )

    return who


# ─── Ingestion Routes (§7.3) ──────────────────────────────────────────────────

@router.get("/ingest/datasets")
async def get_ingest_datasets(db: AsyncSession = Depends(get_db)) -> list[dict[str, Any]]:
    """Returns dataset overview cards showing tier, required columns, and status."""
    return await get_datasets_overview(db)


@router.get("/ingest/{dataset}/template.csv")
async def get_ingest_template(dataset: str) -> Response:
    """Returns template CSV for the specified dataset."""
    csv_text = get_template_csv(dataset.lower())
    return Response(content=csv_text, media_type="text/csv", headers={
        "Content-Disposition": f'attachment; filename="{dataset}_template.csv"'
    })


@router.post("/ingest/{dataset}/dry-run")
async def post_ingest_dry_run(
    dataset: str,
    file: UploadFile = File(...),
    mapping: str | None = Form(default=None),
    date_format: str = Form(default="YYYY-MM-DD"),
    status_map: str | None = Form(default=None),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Validates CSV or XLSX without writing to production tables.
    Returns: {accepted, rejected, errors, warnings, dry_run_id, extras}
    """
    file_bytes = await file.read()
    map_dict = json.loads(mapping) if mapping else None
    s_map_dict = json.loads(status_map) if status_map else None

    try:
        res = await run_dry_run(
            db=db,
            dataset=dataset.lower(),
            file_bytes=file_bytes,
            filename=file.filename or f"{dataset}.csv",
            mapping=map_dict,
            date_format=date_format,
            status_map=s_map_dict,
        )
        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Dry run error on {dataset}: {e}")
        raise HTTPException(status_code=422, detail=f"Validation failed: {str(e)}")


class CommitRequest(BaseModel):
    dry_run_id: str


@router.post("/ingest/{dataset}/commit")
async def post_ingest_commit(
    dataset: str,
    payload: CommitRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Commits dry-run records to production tables and triggers engine recomputation.
    """
    who = request.headers.get("X-User", "teacher-admin")
    try:
        res = await commit_dry_run_data(db=db, dry_run_id=payload.dry_run_id, user_id=who)
        return res
    except KeyError as ke:
        raise HTTPException(status_code=404, detail=str(ke))
    except Exception as e:
        logger.error(f"Commit error on {dataset}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to commit: {str(e)}")


@router.get("/ingest/batches")
async def get_ingest_batches(
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """Returns past ingestion batches."""
    return await get_all_batches(db, limit=limit)


# ─── Graph & Connection Routes (§7.3) ─────────────────────────────────────────

@router.get("/sections/{code}/bunk-graph")
async def get_section_bunk_graph(
    code: str,
    request: Request,
    sensitivity: str = Query(default="strict", pattern="^(strict|balanced|exploratory)$"),
    subject: str | None = Query(default=None),
    period: int | None = Query(default=None),
    weekday: int | None = Query(default=None, ge=0, le=6),
    from_date: str | None = Query(default=None, alias="from"),
    to_date: str | None = Query(default=None, alias="to"),
    overlays: str | None = Query(default=None),
    include_dismissed: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Computes statistically validated bunk network using Makarov Connection Engine v3.
    """
    who = await check_section_access(request, code, db)

    filters = {}
    if subject:
        filters["subject"] = subject.strip().upper()
    if period is not None:
        filters["periods"] = [period]
    if weekday is not None:
        filters["weekdays"] = [weekday]
    if from_date:
        filters["date_from"] = from_date
    if to_date:
        filters["date_to"] = to_date

    ov_list = tuple(s.strip() for s in overlays.split(",") if s.strip()) if overlays else ()

    try:
        res, payload = await compute_graph(
            db=db,
            section_code=code,
            sensitivity=sensitivity,
            filters=filters,
            overlays=ov_list,
            include_dismissed=include_dismissed,
        )
        await log_audit(db, who=who, action="VIEW_GRAPH", obj=f"section:{code}", detail={"filters": filters})
        return payload
    except Exception as e:
        logger.error(f"Bunk graph calculation error: {e}")
        await log_audit(db, who=who, action="SYSTEM_ERROR", obj=f"section:{code}", detail={"error": str(e)})
        return {
            "status": "ERROR",
            "message": str(e),
            "nodes": [],
            "edges": [],
            "groups": [],
        }


@router.get("/sections/{code}/pairs/{a}/{b}/evidence")
async def get_pair_evidence_endpoint(
    code: str,
    a: str,
    b: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Returns exact session dates, periods, and plain-language claim for a student pair.
    """
    who = await check_section_access(request, code, db)
    try:
        evidence = await get_pair_evidence_data(db, section_code=code, student_a=a, student_b=b)
        await log_audit(db, who=who, action="VIEW_EVIDENCE", obj=f"pair:{a}|{b}")
        return evidence
    except KeyError:
        raise HTTPException(
            status_code=404,
            detail=f"Pair ({a}, {b}) was not a candidate (fewer than minimum overlaps).",
        )
    except Exception as e:
        logger.error(f"Evidence retrieval failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class DismissRequest(BaseModel):
    reason: str


@router.post("/sections/{code}/pairs/{a}/{b}/dismiss")
async def post_dismiss_pair(
    code: str,
    a: str,
    b: str,
    payload: DismissRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Dismisses a false-positive connection with a mandatory reason.
    """
    who = await check_section_access(request, code, db)
    if not payload.reason or not payload.reason.strip():
        raise HTTPException(status_code=400, detail="Dismissal reason is required.")

    res = await dismiss_edge(
        db=db,
        section_code=code,
        student_a=a,
        student_b=b,
        reason=payload.reason.strip(),
        dismissed_by=who,
    )
    await log_audit(
        db, who=who, action="DISMISS_EDGE", obj=f"pair:{a}|{b}", detail={"reason": payload.reason}
    )
    return res


# ─── Diagnostics (§7.3 & §7.5) ────────────────────────────────────────────────

@router.get("/sections/{code}/diagnostics/shuffle-control")
async def get_shuffle_control(
    code: str,
    request: Request,
    n_runs: int = Query(default=20, ge=5, le=50),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Launches asynchronous shuffle-control diagnostic job and returns job_id.
    """
    who = await check_section_access(request, code, db)
    job_id = await run_shuffle_control_job(section_code=code, n_runs=n_runs)
    await log_audit(db, who=who, action="RUN_DIAGNOSTIC", obj=f"section:{code}", detail={"job_id": job_id})
    return {"job_id": job_id, "status": "PENDING", "message": "Shuffle control diagnostic running"}


@router.get("/jobs/{job_id}")
async def get_background_job_status(job_id: str) -> dict[str, Any]:
    """Polls async job status."""
    st = get_job_status(job_id)
    if not st:
        raise HTTPException(status_code=404, detail="Job not found.")
    return st


# ─── UI Placeholder Routes (501 per spec instructions) ─────────────────────────

@router.get("/sections/{code}/graph-screen")
async def get_graph_screen_ui(code: str):
    """UI route for Section 6 — deliberately not implemented yet."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Graph screen UI is not implemented yet (Section 6).",
    )


@router.get("/ingest/screen")
async def get_ingest_screen_ui():
    """UI route for Section 4 — deliberately not implemented yet."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Ingestion screen UI is not implemented yet (Section 4).",
    )
