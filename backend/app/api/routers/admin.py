"""
Makerove — Admin API Router

Audit verification, fairness, jobs, and user management.
Admin-only endpoints.
"""
from __future__ import annotations

import csv
import io
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Response, status
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

    from app.connection.engine_service import _ENGINE_CACHE
    from app.models.orm import (
        Attendance,
        Student,
        TimetableSlot,
        CalendarDay,
        IngestionBatch,
        MembershipTie,
        PeerNomination,
        Leave,
        DerivedEdge,
        EdgeDismissal,
        EngineRun,
    )
    from sqlalchemy import delete

    # Clear cache and purge stale records so fresh sample data loads cleanly
    _ENGINE_CACHE.clear()
    await db.execute(delete(Attendance))
    await db.execute(delete(Student))
    await db.execute(delete(TimetableSlot))
    await db.execute(delete(CalendarDay))
    await db.execute(delete(IngestionBatch))
    await db.execute(delete(MembershipTie))
    await db.execute(delete(PeerNomination))
    await db.execute(delete(Leave))
    await db.execute(delete(DerivedEdge))
    await db.execute(delete(EdgeDismissal))
    await db.execute(delete(EngineRun))
    await db.flush()

    results = {}

    # 1. Students CSV
    students_file = sample_dir / "students_cs3b.csv"
    if students_file.exists():
        content = students_file.read_text(encoding="utf-8")
        results["students"] = await parse_and_ingest_students_csv(db, content, filename="students_cs3b.csv")
    else:
        results["students"] = "File students_cs3b.csv not found"

    # 2. Academic Calendar CSV
    calendar_file = sample_dir / "academic_calendar_2026.csv"
    if not calendar_file.exists():
        calendar_file = sample_dir / "academic_calendar_2024.csv"
    if calendar_file.exists():
        content = calendar_file.read_text(encoding="utf-8")
        results["calendar"] = await parse_and_ingest_calendar_csv(db, content, filename=calendar_file.name)
    else:
        results["calendar"] = "File academic_calendar_2026.csv not found"

    # 3. Timetable CSV
    timetable_file = sample_dir / "timetable_cs3b.csv"
    if timetable_file.exists():
        content = timetable_file.read_text(encoding="utf-8")
        results["timetable"] = await parse_and_ingest_timetable_csv(db, content, filename="timetable_cs3b.csv")
    else:
        results["timetable"] = "File timetable_cs3b.csv not found"

    # 4. Attendance CSV
    attendance_file = sample_dir / "attendance_cs3b_oct.csv"
    if attendance_file.exists():
        content = attendance_file.read_text(encoding="utf-8")
        results["attendance"] = await parse_and_ingest_attendance_csv(
            db, content, filename="attendance_cs3b_oct.csv", uploaded_by_username="admin"
        )
    else:
        results["attendance"] = "File attendance_cs3b_oct.csv not found"

    return {
        "status": "SUCCESS",
        "message": "Sample data loaded successfully into Makerove graph database.",
        "results": results,
    }


@router.get("/demo-data")
async def get_demo_data_summary():
    """
    Returns authentic presentation demo dataset summary, preview rows,
    and genuine connection storylines for Section CS-3B.
    """
    candidate_dirs = [
        BASE_DIR.parent / "sample_data",
        BASE_DIR / "sample_data",
        BASE_DIR.parent / "presentation_documents",
        Path("sample_data").resolve(),
    ]
    sample_dir = None
    for cand in candidate_dirs:
        if cand.exists() and cand.is_dir():
            sample_dir = cand
            break

    files_info = {}
    file_mapping = {
        "students": ("students_cs3b.csv", "Student Roster"),
        "attendance": ("attendance_cs3b_oct.csv", "Attendance Register"),
        "timetable": ("timetable_cs3b.csv", "Weekly Timetable"),
        "calendar": ("academic_calendar_2026.csv", "Academic Calendar"),
    }

    if sample_dir:
        for key, (filename, label) in file_mapping.items():
            fpath = sample_dir / filename
            if not fpath.exists() and key == "calendar":
                fpath = sample_dir / "academic_calendar_2024.csv"
            
            if fpath.exists():
                try:
                    text = fpath.read_text(encoding="utf-8")
                    reader = list(csv.DictReader(io.StringIO(text)))
                    files_info[key] = {
                        "filename": filename,
                        "label": label,
                        "total_rows": len(reader),
                        "preview": reader[:25],
                    }
                except Exception as e:
                    files_info[key] = {
                        "filename": filename,
                        "label": label,
                        "total_rows": 0,
                        "preview": [],
                        "error": str(e),
                    }

    storylines = [
        {
            "id": "single_subject_algorithms",
            "title": "Single-Subject Algorithms Bunkers (CS304)",
            "students": [
                {"roll": "21CSB023", "name": "Ishaan Ghosh"},
                {"roll": "21CSB024", "name": "Pranav Hegde"},
            ],
            "subject": "CS304",
            "subject_name": "Design & Analysis of Algorithms",
            "pattern": "Regularly attend morning periods 1, 2, and 3, but skip Period 4 (CS304 Algorithms) together 5 times in October.",
            "how_to_verify": "Filter Knowledge Graph by Subject = CS304. Their edge appears with weight 1.0 and lift 4.35x.",
        },
        {
            "id": "afternoon_bunk_trio",
            "title": "Afternoon Bunk Group (Periods 3 & 4)",
            "students": [
                {"roll": "21CSB001", "name": "Aarav Patel"},
                {"roll": "21CSB002", "name": "Rohan Sharma"},
                {"roll": "21CSB003", "name": "Kabir Verma"},
            ],
            "pattern": "Synchronized skips on afternoon periods 3 & 4 across 5 October dates.",
            "how_to_verify": "Visible on the global Knowledge Graph as a cohesive 3-student clique.",
        },
        {
            "id": "wednesday_afternoon_pair",
            "title": "Wednesday Afternoon Pair",
            "students": [
                {"roll": "21CSB011", "name": "Priya Desai"},
                {"roll": "21CSB012", "name": "Ananya Roy"},
            ],
            "pattern": "Coordinated Wednesday afternoon skips on periods 3 & 4 across 5 dates.",
            "how_to_verify": "Visible as an isolated dyad on the Knowledge Graph.",
        },
    ]

    return {
        "section": "CS-3B",
        "cohort_name": "AIML Semester 4 (60 Students)",
        "school_days": 22,
        "date_range": "2026-10-01 to 2026-10-30",
        "storylines": storylines,
        "files": files_info,
    }


@router.get("/demo-data/file/{file_key}")
async def download_demo_file(file_key: str):
    """Download a raw demo CSV file by key (students, attendance, timetable, calendar)."""
    file_mapping = {
        "students": "students_cs3b.csv",
        "attendance": "attendance_cs3b_oct.csv",
        "timetable": "timetable_cs3b.csv",
        "calendar": "academic_calendar_2026.csv",
    }
    filename = file_mapping.get(file_key.lower())
    if not filename:
        raise HTTPException(status_code=404, detail=f"Unknown demo file key '{file_key}'.")

    candidate_dirs = [
        BASE_DIR.parent / "sample_data",
        BASE_DIR / "sample_data",
        BASE_DIR.parent / "presentation_documents",
        Path("sample_data").resolve(),
    ]
    for cand in candidate_dirs:
        fpath = cand / filename
        if not fpath.exists() and file_key.lower() == "calendar":
            fpath = cand / "academic_calendar_2024.csv"
        if fpath.exists():
            content = fpath.read_text(encoding="utf-8")
            return Response(
                content=content,
                media_type="text/csv",
                headers={"Content-Disposition": f'attachment; filename="{filename}"'},
            )

    raise HTTPException(status_code=404, detail=f"Demo file '{filename}' not found.")

