"""
Makerove — Student Roster CSV Parser & Ingestion
"""
from __future__ import annotations

import csv
import io
from datetime import datetime
from typing import Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import Student, Section


async def parse_and_ingest_students_csv(db: AsyncSession, csv_content: str) -> dict[str, Any]:
    """Parse and insert students."""
    reader = csv.DictReader(io.StringIO(csv_content))
    if not reader.fieldnames:
        raise ValueError("Students CSV is empty.")

    required_fields = {"roll_no", "name", "section_code", "branch", "year", "dob"}
    missing = required_fields - set(reader.fieldnames)
    if missing:
        raise ValueError(f"Missing required columns in Students CSV: {', '.join(missing)}")

    # Sections lookup
    sec_res = await db.execute(select(Section))
    sections = {s.code: s.id for s in sec_res.scalars().all()}

    inserted = 0
    for row in reader:
        roll_no = row["roll_no"].strip().upper()
        name = row["name"].strip()
        sec_code = row["section_code"].strip()
        branch = row["branch"].strip()
        year = int(row["year"].strip())
        raw_dob = row["dob"].strip()
        parsed_dob = datetime.strptime(raw_dob, "%Y-%m-%d").date()
        gender = row.get("gender", "M").strip()

        section_id = sections.get(sec_code)
        if not section_id:
            # Create section if not exists
            new_sec = Section(code=sec_code, semester=year * 2 - 1, strength=60, department=branch)
            db.add(new_sec)
            await db.flush()
            section_id = new_sec.id
            sections[sec_code] = section_id

        # Check existing student
        existing_stmt = select(Student).where(Student.roll_no == roll_no)
        res = await db.execute(existing_stmt)
        existing = res.scalar_one_or_none()

        if existing:
            existing.name = name
            existing.section_id = section_id
            existing.branch = branch
            existing.year = year
            existing.dob = parsed_dob
            existing.gender = gender
        else:
            db.add(Student(
                roll_no=roll_no,
                name=name,
                section_id=section_id,
                branch=branch,
                year=year,
                dob=parsed_dob,
                gender=gender,
            ))
        inserted += 1

    await db.commit()
    return {"status": "SUCCESS", "students_ingested": inserted}
