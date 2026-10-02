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

from app.models.orm import CalendarDay


async def parse_and_ingest_calendar_csv(db: AsyncSession, csv_content: str) -> dict[str, Any]:
    """Parse and insert calendar days."""
    reader = csv.DictReader(io.StringIO(csv_content))
    if not reader.fieldnames:
        raise ValueError("Calendar CSV is empty.")

    required_fields = {"date", "name", "type", "is_holiday"}
    missing = required_fields - set(reader.fieldnames)
    if missing:
        raise ValueError(f"Missing required columns in Calendar CSV: {', '.join(missing)}")

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

    await db.commit()
    return {"status": "SUCCESS", "events_ingested": inserted}
