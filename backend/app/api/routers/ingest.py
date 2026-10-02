"""
Makerove — Ingestion API Router

Handles real CSV file uploads for attendance registers, calendars, timetables, and student rosters.
"""
from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.orm import IngestionBatch
from app.ingestion.parsers.attendance_parser import parse_and_ingest_attendance_csv
from app.ingestion.parsers.calendar_parser import parse_and_ingest_calendar_csv
from app.ingestion.parsers.students_parser import parse_and_ingest_students_csv
from app.ingestion.parsers.timetable_parser import parse_and_ingest_timetable_csv

router = APIRouter(prefix="/ingest", tags=["Ingestion"])


@router.post("/attendance")
async def ingest_attendance(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Upload and ingest attendance register CSV."""
    if not file.filename.endswith((".csv", ".txt")):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")
    
    content = (await file.read()).decode("utf-8-sig", errors="replace")
    try:
        res = await parse_and_ingest_attendance_csv(db, content, filename=file.filename)
        return {"status": "SUCCESS", "filename": file.filename, **res}
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse attendance CSV: {str(e)}")


@router.post("/calendar")
async def ingest_calendar(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Upload and ingest academic calendar CSV."""
    content = (await file.read()).decode("utf-8-sig", errors="replace")
    try:
        res = await parse_and_ingest_calendar_csv(db, content)
        return {"filename": file.filename, **res}
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse calendar CSV: {str(e)}")


@router.post("/students")
async def ingest_students(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Upload and ingest student roster CSV."""
    content = (await file.read()).decode("utf-8-sig", errors="replace")
    try:
        res = await parse_and_ingest_students_csv(db, content)
        return {"filename": file.filename, **res}
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse students CSV: {str(e)}")


@router.post("/timetable")
async def ingest_timetable(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Upload and ingest timetable CSV."""
    content = (await file.read()).decode("utf-8-sig", errors="replace")
    try:
        res = await parse_and_ingest_timetable_csv(db, content)
        return {"filename": file.filename, **res}
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse timetable CSV: {str(e)}")


@router.get("/history")
async def get_ingestion_history(
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """Get list of past ingestion batches with status and records count."""
    stmt = select(IngestionBatch).order_by(IngestionBatch.created_at.desc()).limit(15)
    res = await db.execute(stmt)
    batches = list(res.scalars().all())

    return [
        {
            "id": b.id,
            "filename": b.file_name,
            "data_type": b.file_type,
            "status": "SUCCESS" if b.rows_ok > 0 else ("REJECTED" if b.rows_rejected > 0 else "PENDING"),
            "row_count": b.rows_ok + b.rows_rejected,
            "success_count": b.rows_ok,
            "error_count": b.rows_rejected,
            "created_at": b.created_at.strftime("%Y-%m-%d %H:%M:%S") if b.created_at else None,
        }
        for b in batches
    ]
