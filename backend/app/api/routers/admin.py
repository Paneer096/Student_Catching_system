"""
Makerove — Admin API Router

Audit verification, fairness, jobs, and user management.
Admin-only endpoints.
"""
from __future__ import annotations

from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.db import get_db
from app.models.enums import UserRole
from app.models.schemas import AuditVerifyResponse
from app.security.rbac import AuthContext, require_roles
from app.security.audit_log import verify_audit_chain
from app.config.settings import get_settings, BASE_DIR
from app.ingestion.parsers.students_parser import parse_and_ingest_students_csv
from app.ingestion.parsers.calendar_parser import parse_and_ingest_calendar_csv
from app.ingestion.parsers.timetable_parser import parse_and_ingest_timetable_csv
from app.ingestion.parsers.attendance_parser import parse_and_ingest_attendance_csv


router = APIRouter(prefix="/admin", tags=["Administration"])


def require_dev_env() -> None:
    """Dependency that ensures the endpoint is only callable in development mode."""
    settings = get_settings()
    if settings.ENV.lower() != "development":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Sample data loader is strictly restricted to development environments (ENV=development)."
        )


@router.get(
    "/audit/verify",
    response_model=AuditVerifyResponse,
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
async def verify_audit(db: AsyncSession = Depends(get_db)):
    """Verify the integrity of the hash-chained audit log."""
    result = await verify_audit_chain(db)
    return AuditVerifyResponse(**result)


@router.post(
    "/load-sample-data",
    dependencies=[Depends(require_dev_env)],
)
async def load_sample_data(db: AsyncSession = Depends(get_db)):
    """
    Development-only endpoint to load sample CSVs into the graph store.
    Strictly gated by require_dev_env (ENV=development).
    """
    logger.info("Admin triggered sample data load (DEV only)")

    # Find sample_data directory
    candidate_dirs = [
        BASE_DIR.parent / "sample_data",
        BASE_DIR / "sample_data",
        Path("sample_data").resolve(),
    ]
    sample_dir = None
    for cand in candidate_dirs:
        if cand.exists() and cand.is_dir():
            sample_dir = cand
            break

    if not sample_dir:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="sample_data directory not found on filesystem."
        )

    results = {}

    # 1. Students CSV
    students_file = sample_dir / "students_cs3b.csv"
    if students_file.exists():
        content = students_file.read_text(encoding="utf-8")
        results["students"] = await parse_and_ingest_students_csv(db, content)
    else:
        results["students"] = "File students_cs3b.csv not found"

    # 2. Academic Calendar CSV
    calendar_file = sample_dir / "academic_calendar_2024.csv"
    if calendar_file.exists():
        content = calendar_file.read_text(encoding="utf-8")
        results["calendar"] = await parse_and_ingest_calendar_csv(db, content)
    else:
        results["calendar"] = "File academic_calendar_2024.csv not found"

    # 3. Timetable CSV
    timetable_file = sample_dir / "timetable_cs3b.csv"
    if timetable_file.exists():
        content = timetable_file.read_text(encoding="utf-8")
        results["timetable"] = await parse_and_ingest_timetable_csv(db, content)
    else:
        results["timetable"] = "File timetable_cs3b.csv not found"

    # 4. Attendance CSV
    attendance_file = sample_dir / "attendance_cs3b_oct.csv"
    if attendance_file.exists():
        content = attendance_file.read_text(encoding="utf-8")
        results["attendance"] = await parse_and_ingest_attendance_csv(
            db, content, filename="sample_attendance_cs3b_oct.csv", uploaded_by_username="admin"
        )
    else:
        results["attendance"] = "File attendance_cs3b_oct.csv not found"

    return {
        "status": "SUCCESS",
        "message": "Sample data loaded successfully into Makerove graph database.",
        "results": results,
    }

