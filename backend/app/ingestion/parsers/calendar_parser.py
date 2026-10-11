"""
Makerove — Calendar CSV Parser & Ingestion
"""
from __future__ import annotations

import csv
import io
from datetime import datetime
from typing import Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import hashlib
from app.models.orm import CalendarDay, IngestionBatch, User


async def parse_and_ingest_calendar_csv(
    db: AsyncSession,
    csv_content: str,
    filename: str = "calendar.csv",
) -> dict[str, Any]:
    """Parse and insert calendar days, logging an IngestionBatch."""
    reader = csv.DictReader(io.StringIO(csv_content))
    if not reader.fieldnames:
        raise ValueError("Calendar CSV is empty.")

    required_fields = {"date", "name", "type", "is_holiday"}
    missing = required_fields - set(reader.fieldnames)
    if missing:
        raise ValueError(f"Missing required columns in Calendar CSV: {', '.join(missing)}")

    file_hash = hashlib.sha256(csv_content.encode("utf-8")).hexdigest()
    user_res = await db.execute(select(User).limit(1))
    first_user = user_res.scalar_one_or_none()
    user_id = first_user.id if first_user else "usr-admin"

    batch = IngestionBatch(
        file_hash=file_hash,
        file_sha256=file_hash,
        file_type="calendar",
        file_name=filename,
        dataset="calendar",
        uploaded_by=user_id,
        rows_ok=0,
        rows_rejected=0,
        status="ACCEPTED",
    )
    db.add(batch)
    await db.flush()

    inserted = 0
    for row in reader:
        raw_date = row["date"].strip()
        parsed_date = datetime.strptime(raw_date, "%Y-%m-%d").date()
        name = row["name"].strip()
        day_type = row["type"].strip().upper()
        is_holiday = row["is_holiday"].strip().lower() in ("true", "1", "yes")

        existing_stmt = select(CalendarDay).where(CalendarDay.date == parsed_date)
        res = await db.execute(existing_stmt)
        existing = res.scalar_one_or_none()

        if existing:
            existing.name = name
            existing.type = day_type
            existing.is_holiday = is_holiday
        else:
            db.add(CalendarDay(date=parsed_date, name=name, type=day_type, is_holiday=is_holiday))
        inserted += 1

    batch.rows_ok = inserted
    batch.rows_total = inserted
    await db.commit()
    return {"status": "SUCCESS", "events_ingested": inserted, "batch_id": batch.id}
