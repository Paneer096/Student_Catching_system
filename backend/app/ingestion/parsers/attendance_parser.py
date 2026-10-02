"""
Makerove — Attendance CSV Parser & Ingestion

Parses, validates, and persists student attendance records into SQLite.
Logs ingestion batches with cryptographic audit traceability.
"""
from __future__ import annotations

import csv
import io
import hashlib
from datetime import datetime, date
from typing import Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import Attendance, Student, IngestionBatch, User


async def parse_and_ingest_attendance_csv(
    db: AsyncSession,
    csv_content: str,
    filename: str = "uploaded_attendance.csv",
    uploaded_by_username: str = "admin",
) -> dict[str, Any]:
    """
    Parse an attendance CSV with columns:
    date, roll_no, period, subject_code, status
    """
    reader = csv.DictReader(io.StringIO(csv_content))
    if not reader.fieldnames:
        raise ValueError("CSV file is empty or missing headers.")

    required_fields = {"date", "roll_no", "period", "subject_code", "status"}
    missing = required_fields - set(reader.fieldnames)
    if missing:
        raise ValueError(f"Missing required columns in CSV: {', '.join(missing)}")

    # Fetch admin user ID for ForeignKey
    user_res = await db.execute(select(User).limit(1))
    first_user = user_res.scalar_one_or_none()
    user_id = first_user.id if first_user else "usr-admin"

    # Compute SHA-256 of file content
    file_hash = hashlib.sha256(csv_content.encode("utf-8")).hexdigest()

    # Fetch existing students lookup: roll_no -> student_id
    students_res = await db.execute(select(Student))
    students = list(students_res.scalars().all())
    student_lookup = {s.roll_no.strip().upper(): s.id for s in students}

    # Create ingestion batch record
    batch = IngestionBatch(
        file_hash=file_hash,
        file_type="attendance",
        file_name=filename,
        uploaded_by=user_id,
        rows_ok=0,
        rows_rejected=0,
    )
    db.add(batch)
    await db.flush()

    inserted_count = 0
    errors = []

    for row_idx, row in enumerate(reader, start=2):
        try:
            raw_date = row["date"].strip()
            parsed_date = datetime.strptime(raw_date, "%Y-%m-%d").date()
            roll_no = row["roll_no"].strip().upper()
            period = int(row["period"].strip())
            subject_code = row["subject_code"].strip().upper()
            status = row["status"].strip().upper()

            if status not in ("PRESENT", "ABSENT", "LATE", "MEDICAL_LEAVE", "ON_DUTY"):
                status = "ABSENT" if "ABS" in status else "PRESENT"

            student_id = student_lookup.get(roll_no)
            if not student_id:
                err_msg = f"Row {row_idx}: Roll number '{roll_no}' not found in enrolled students."
                errors.append(err_msg)
                batch.rows_rejected += 1
                continue

            # Check if attendance record already exists
            existing_stmt = select(Attendance).where(
                Attendance.student_id == student_id,
                Attendance.date == parsed_date,
                Attendance.period == period,
            )
            existing_res = await db.execute(existing_stmt)
            existing_record = existing_res.scalar_one_or_none()

            if existing_record:
                existing_record.status = status
                existing_record.subject_code = subject_code
                existing_record.batch_id = batch.id
            else:
                att = Attendance(
                    student_id=student_id,
                    date=parsed_date,
                    period=period,
                    subject_code=subject_code,
                    status=status,
                    batch_id=batch.id,
                )
                db.add(att)

            inserted_count += 1
            batch.rows_ok += 1

        except Exception as e:
            err_msg = f"Row {row_idx}: Parsing error: {str(e)}"
            errors.append(err_msg)
            batch.rows_rejected += 1

    await db.commit()

    return {
        "batch_id": batch.id,
        "total_rows": batch.rows_ok + batch.rows_rejected,
        "records_inserted": inserted_count,
        "errors_count": len(errors),
        "errors": errors[:5],
    }
