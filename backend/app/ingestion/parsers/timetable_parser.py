"""
Makerove — Timetable CSV Parser & Ingestion
"""
from __future__ import annotations

import csv
import io
from typing import Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import TimetableSlot, Section, Subject, Teacher


async def parse_and_ingest_timetable_csv(db: AsyncSession, csv_content: str) -> dict[str, Any]:
    """Parse and insert timetable slots."""
    reader = csv.DictReader(io.StringIO(csv_content))
    if not reader.fieldnames:
        raise ValueError("Timetable CSV is empty.")

    required_fields = {"section_code", "day", "period", "subject_code", "teacher_id"}
    missing = required_fields - set(reader.fieldnames)
    if missing:
        raise ValueError(f"Missing required columns in Timetable CSV: {', '.join(missing)}")

    # Sections lookup
    sec_res = await db.execute(select(Section))
    sections = {s.code: s.id for s in sec_res.scalars().all()}

    inserted = 0
    for row in reader:
        sec_code = row["section_code"].strip()
        day = row["day"].strip()
        period = int(row["period"].strip())
        subj_code = row["subject_code"].strip().upper()
        teacher_id = row["teacher_id"].strip()
        is_lab = row.get("is_lab", "").strip().lower() in ("true", "1", "yes")
        room = row.get("room", "Room 201").strip()

        section_id = sections.get(sec_code)
        if not section_id:
            continue

        existing_stmt = select(TimetableSlot).where(
            TimetableSlot.section_id == section_id,
            TimetableSlot.day == day,
            TimetableSlot.period == period,
        )
        res = await db.execute(existing_stmt)
        existing = res.scalar_one_or_none()

        if existing:
            existing.subject_code = subj_code
            existing.teacher_id = teacher_id
            existing.is_lab = is_lab
            existing.room = room
        else:
            db.add(TimetableSlot(
                section_id=section_id,
                day=day,
                period=period,
                subject_code=subj_code,
                teacher_id=teacher_id,
                is_lab=is_lab,
                room=room,
            ))
        inserted += 1

    await db.commit()
    return {"status": "SUCCESS", "slots_ingested": inserted}
