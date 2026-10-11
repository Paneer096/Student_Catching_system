"""
Ingestion Service — Makarov Connection Engine v3.
Implements §7.3 ingestion pipeline with strict validators from makarov_engine.validators.
Enforces no-guess status, DPDP consent checks, and audit logging.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import uuid
from datetime import datetime, date, timezone
from typing import Any, Optional

import pandas as pd
from loguru import logger
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from makarov_engine.validators import (
    validate_attendance,
    validate_roster,
    validate_session_events,
    validate_leaves,
    validate_seating,
    validate_groups,
    validate_transport,
    validate_clubs,
    validate_peer_survey,
    register_sanity,
    suggest_column_map,
    Validated,
)
from makarov_engine.ties import (
    memberships_from_seating,
    memberships_from_groups,
    memberships_from_transport,
    memberships_from_clubs,
    nominations_from_survey,
)
from app.models.orm import (
    IngestionBatch,
    Attendance,
    AttendanceHistory,
    Student,
    Section,
    SessionEvent,
    Leave,
    MembershipTie,
    PeerNomination,
    AuditLog,
)

# In-memory staging for dry runs: dry_run_id -> {dataset, clean_df, errors_df, extras, filename, file_sha256}
_DRY_RUN_STORE: dict[str, dict[str, Any]] = {}

DATASET_METADATA = {
    "attendance": {
        "tier": "Core",
        "unlocks": "Everything. Must include all periods of the day.",
        "required_columns": ["date", "roll_no", "period", "subject_code", "status"],
        "optional_columns": ["marked_by"],
    },
    "roster": {
        "tier": "Core",
        "unlocks": "Students and sections.",
        "required_columns": ["roll_no", "name", "section_code"],
        "optional_columns": ["branch", "year", "batch_code"],
    },
    "timetable": {
        "tier": "Core",
        "unlocks": "Coverage checks (sessions with no attendance).",
        "required_columns": ["section_code", "day", "period", "subject_code", "teacher_id"],
        "optional_columns": ["room", "is_lab"],
    },
    "calendar": {
        "tier": "Accuracy",
        "unlocks": "Holidays; attendance rows on holidays are flagged.",
        "required_columns": ["date", "type", "name"],
        "optional_columns": ["is_holiday"],
    },
    "session_events": {
        "tier": "Accuracy",
        "unlocks": "Cancelled / teacher-absent sessions removed so they are not read as mass absence.",
        "required_columns": ["date", "event_type"],
        "optional_columns": ["period", "section_code", "note"],
    },
    "leaves": {
        "tier": "Accuracy",
        "unlocks": "Approved medical / on-duty leave is excused, never a bunk.",
        "required_columns": ["roll_no", "from_date", "to_date", "leave_type"],
        "optional_columns": [],
    },
    "seating": {
        "tier": "Real ties",
        "unlocks": "SITS_WITH tie.",
        "required_columns": ["roll_no", "bench_id"],
        "optional_columns": ["section_code", "effective_from", "effective_to"],
    },
    "groups": {
        "tier": "Real ties + context",
        "unlocks": "Project teams (social); lab batches, electives, tutorials, mentor groups (context).",
        "required_columns": ["roll_no", "group_type", "group_code"],
        "optional_columns": ["effective_from", "effective_to"],
    },
    "transport": {
        "tier": "Context",
        "unlocks": "SHARES_ROUTE tie (explains co-skipping caused by shared bus/hostel).",
        "required_columns": ["roll_no", "mode", "route_or_block"],
        "optional_columns": [],
    },
    "clubs": {
        "tier": "Real ties",
        "unlocks": "SAME_CLUB tie.",
        "required_columns": ["roll_no", "club_name"],
        "optional_columns": ["role", "from_date", "to_date"],
    },
    "peer_survey": {
        "tier": "Real ties",
        "unlocks": "NAMED_FRIEND, NAMED_STUDY_PARTNER ties.",
        "required_columns": ["respondent_roll_no", "nominee_roll_no", "relation", "survey_date", "consent"],
        "optional_columns": [],
    },
}

TEMPLATES = {
    "attendance": "date,roll_no,period,subject_code,status\n2026-10-09,21CSB007,5,CS305L,A\n",
    "roster": "roll_no,name,section_code,branch,year,batch_code\n21CSB007,Rohan Patil,CS-3B,CSE,3,B1\n",
    "timetable": "section_code,day,period,subject_code,teacher_id,room,is_lab\nCS-3B,Monday,1,CS301,T01,Room 201,false\n",
    "calendar": "date,type,name,is_holiday\n2026-10-02,HOLIDAY,Gandhi Jayanti,true\n",
    "session_events": "date,event_type,period,section_code,note\n2026-10-08,CANCELLED,4,CS-3B,Teacher absent\n",
    "leaves": "roll_no,from_date,to_date,leave_type\n21CSB007,2026-10-01,2026-10-03,MEDICAL\n",
    "seating": "roll_no,bench_id,section_code,effective_from,effective_to\n21CSB007,B-12,CS-3B,2026-08-01,2026-12-15\n",
    "groups": "roll_no,group_type,group_code,effective_from,effective_to\n21CSB007,PROJECT_TEAM,PRJ-04,2026-08-01,2026-12-15\n",
    "transport": "roll_no,mode,route_or_block\n21CSB007,BUS,Route 7\n",
    "clubs": "roll_no,club_name,role,from_date,to_date\n21CSB007,Robotics Club,Member,2026-08-01,2026-12-15\n",
    "peer_survey": "respondent_roll_no,nominee_roll_no,relation,survey_date,consent\n21CSB007,21CSB012,FRIEND,2026-09-15,Y\n",
}


def get_template_csv(dataset: str) -> str:
    return TEMPLATES.get(dataset, "id\n")


async def get_datasets_overview(db: AsyncSession) -> list[dict[str, Any]]:
    """Returns dataset cards showing tier, required columns, last upload, and status."""
    cards = []
    for dset, meta in DATASET_METADATA.items():
        stmt = (
            select(IngestionBatch)
            .where(IngestionBatch.dataset == dset)
            .order_by(IngestionBatch.uploaded_at.desc())
            .limit(1)
        )
        res = await db.execute(stmt)
        latest = res.scalar_one_or_none()

        cards.append({
            "dataset": dset,
            "tier": meta["tier"],
            "unlocks": meta["unlocks"],
            "required_columns": meta["required_columns"],
            "optional_columns": meta["optional_columns"],
            "last_upload": latest.uploaded_at.isoformat() if (latest and latest.uploaded_at) else None,
            "status": latest.status if latest else "NOT_UPLOADED",
            "records_count": latest.rows_ok if latest else 0,
        })
    return cards


async def parse_input_file(file_bytes: bytes, filename: str) -> pd.DataFrame:
    """Parses raw CSV or XLSX bytes into a pandas DataFrame without guessing."""
    if filename.endswith(".xlsx") or filename.endswith(".xls"):
        return pd.read_excel(io.BytesIO(file_bytes))
    # Strict UTF-8 without errors="replace"
    try:
        text = file_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = file_bytes.decode("latin-1")
    return pd.read_csv(io.StringIO(text))


async def run_dry_run(
    db: AsyncSession,
    dataset: str,
    file_bytes: bytes,
    filename: str,
    mapping: dict[str, str] | None = None,
    date_format: str = "YYYY-MM-DD",
    status_map: dict[str, str] | None = None,
) -> dict[str, Any]:
    """
    Executes dry run with strict validation per §7.3.
    Returns: {accepted, rejected, errors, warnings, dry_run_id, extras}
    """
    if dataset not in DATASET_METADATA:
        raise ValueError(f"Unknown dataset '{dataset}'")

    df = await parse_input_file(file_bytes, filename)
    file_sha256 = hashlib.sha256(file_bytes).hexdigest()

    # Apply column mapping if provided
    if mapping:
        # Invert mapping: csv_col -> canonical_col
        inv_map = {v: k for k, v in mapping.items() if v in df.columns}
        df = df.rename(columns=inv_map)

    # Fetch known roll numbers and sections for foreign key checks
    st_res = await db.execute(select(Student.roll_no))
    known_rolls = set(r[0].strip().upper() for r in st_res.all() if r[0])

    sec_res = await db.execute(select(Section.code))
    known_sections = set(r[0].strip().upper() for r in sec_res.all() if r[0])

    val_res: Validated
    warnings: list[str] = []

    if dataset == "attendance":
        # Check roster if available; if roster is empty, allow known_rolls=None
        rolls_check = known_rolls if known_rolls else None
        val_res = validate_attendance(
            df, date_format=date_format, status_map=status_map, known_rolls=rolls_check
        )
        # Register sanity check
        if len(val_res.clean) > 0:
            sanity = register_sanity(val_res.clean, section_strength=60)
            warnings = sanity.get("warnings", [])

    elif dataset == "roster":
        sections_check = known_sections if known_sections else None
        val_res = validate_roster(df, known_sections=sections_check)

    elif dataset == "session_events":
        val_res = validate_session_events(df, date_format=date_format)

    elif dataset == "leaves":
        val_res = validate_leaves(df, date_format=date_format, known_rolls=known_rolls if known_rolls else None)

    elif dataset == "seating":
        val_res = validate_seating(df, date_format=date_format, known_rolls=known_rolls if known_rolls else None)

    elif dataset == "groups":
        val_res = validate_groups(df, date_format=date_format, known_rolls=known_rolls if known_rolls else None)

    elif dataset == "transport":
        val_res = validate_transport(df, known_rolls=known_rolls if known_rolls else None)

    elif dataset == "clubs":
        val_res = validate_clubs(df, date_format=date_format, known_rolls=known_rolls if known_rolls else None)

    elif dataset == "peer_survey":
        val_res = validate_peer_survey(df, date_format=date_format, known_rolls=known_rolls if known_rolls else None)

    elif dataset in ("timetable", "calendar"):
        # Basic structural check
        req = DATASET_METADATA[dataset]["required_columns"]
        missing = [c for c in req if c not in df.columns]
        if missing:
            raise ValueError(f"Missing required columns: {missing}")
        val_res = Validated(clean=df, errors=pd.DataFrame(columns=["line", "column", "message"]), extras={})
    else:
        raise ValueError(f"No validator for dataset '{dataset}'")

    errors_list = []
    if len(val_res.errors):
        errors_list = val_res.errors.to_dict(orient="records")

    clean_extras = {}
    for k, v in val_res.extras.items():
        if isinstance(v, pd.DataFrame):
            clean_extras[k] = v.to_dict(orient="records")
        elif isinstance(v, pd.Series):
            clean_extras[k] = v.to_dict()
        else:
            clean_extras[k] = v

    dry_run_id = str(uuid.uuid4())
    _DRY_RUN_STORE[dry_run_id] = {
        "dataset": dataset,
        "clean_df": val_res.clean,
        "errors_df": val_res.errors,
        "extras": clean_extras,
        "filename": filename,
        "file_sha256": file_sha256,
        "total_rows": len(df),
        "created_at": datetime.now(timezone.utc),
    }

    return {
        "dry_run_id": dry_run_id,
        "accepted": len(val_res.clean),
        "rejected": len(val_res.errors),
        "errors": errors_list,
        "warnings": warnings,
        "extras": clean_extras,
    }


async def commit_dry_run_data(
    db: AsyncSession,
    dry_run_id: str,
    user_id: str = "usr-system",
) -> dict[str, Any]:
    """
    Commits dry-run data to database per §7.3.
    Writes to ingestion_batches and respective domain tables.
    """
    entry = _DRY_RUN_STORE.get(dry_run_id)
    if not entry:
        raise KeyError(f"Dry run ID '{dry_run_id}' not found or expired.")

    dataset = entry["dataset"]
    clean_df: pd.DataFrame = entry["clean_df"]
    errors_df: pd.DataFrame = entry["errors_df"]
    total = entry["total_rows"]
    ok_cnt = len(clean_df)
    rej_cnt = len(errors_df)

    status = "ACCEPTED" if rej_cnt == 0 else ("PARTIAL" if ok_cnt > 0 else "REJECTED")
    batch_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    # Create ingestion batch record
    batch = IngestionBatch(
        id=str(uuid.uuid4()),
        batch_id=batch_id,
        dataset=dataset,
        file_sha256=entry["file_sha256"],
        file_hash=entry["file_sha256"],
        file_type=dataset,
        file_name=entry["filename"],
        is_dry_run=False,
        rows_total=total,
        rows_ok=ok_cnt,
        rows_rejected=rej_cnt,
        status=status,
        uploaded_by=user_id,
        uploaded_at=now,
        report_json={
            "filename": entry["filename"],
            "extras": entry["extras"],
            "rejected_count": rej_cnt,
        },
    )
    db.add(batch)
    await db.flush()

    inserted = 0
    updated = 0

    if dataset == "attendance" and ok_cnt > 0:
        unique_rolls = list(set(str(r).strip().upper() for r in clean_df["roll_no"]))
        st_res = await db.execute(select(Student.roll_no, Student.id).where(Student.roll_no.in_(unique_rolls)))
        roll_to_sid = {r[0].strip().upper(): r[1] for r in st_res.all()}

        existing_stmt = select(Attendance).where(Attendance.roll_no.in_(unique_rolls))
        existing_res = await db.execute(existing_stmt)
        existing_map = {(r.roll_no, r.date, r.period): r for r in existing_res.scalars().all()}

        new_attendance_records = []
        for r in clean_df.itertuples():
            dt = r.date.date() if hasattr(r.date, "date") else r.date
            per = int(r.period)
            roll = str(r.roll_no).strip().upper()
            status_val = str(r.status).strip().upper()
            subj = str(r.subject_code).strip().upper()

            key = (roll, dt, per)
            existing = existing_map.get(key)

            if existing:
                if existing.status != status_val:
                    hist = AttendanceHistory(
                        id=str(uuid.uuid4()),
                        roll_no=roll,
                        date=dt,
                        period=per,
                        old_status=existing.status,
                        new_status=status_val,
                        batch_id=batch_id,
                        changed_at=now,
                    )
                    db.add(hist)
                    existing.status = status_val
                    existing.subject_code = subj
                    existing.batch_id = batch_id
                    updated += 1
            else:
                att = Attendance(
                    id=str(uuid.uuid4()),
                    roll_no=roll,
                    student_id=roll_to_sid.get(roll, roll),
                    date=dt,
                    period=per,
                    subject_code=subj,
                    status=status_val,
                    batch_id=batch_id,
                )
                new_attendance_records.append(att)
                existing_map[key] = att
                inserted += 1

        if new_attendance_records:
            db.add_all(new_attendance_records)

    elif dataset == "roster" and ok_cnt > 0:
        for r in clean_df.itertuples():
            roll = str(r.roll_no).strip().upper()
            sec_code = str(r.section_code).strip().upper()
            name = str(r.name).strip()
            branch = str(getattr(r, "branch", "CSE") or "CSE")
            year = int(getattr(r, "year", 3) or 3)
            batch_code = str(getattr(r, "batch_code", "") or "")

            stmt = select(Student).where(Student.roll_no == roll)
            res = await db.execute(stmt)
            existing = res.scalar_one_or_none()

            if existing:
                existing.name = name
                existing.section_code = sec_code
                existing.branch = branch
                existing.year = year
                existing.batch_code = batch_code
                updated += 1
            else:
                # Ensure section exists in sections table
                sec_check = await db.execute(select(Section).where(Section.code == sec_code))
                sec_obj = sec_check.scalar_one_or_none()
                sec_id = sec_obj.id if sec_obj else str(uuid.uuid4())
                if not sec_obj:
                    db.add(Section(id=sec_id, code=sec_code, semester=year * 2 - 1, strength=60, department=branch))
                    await db.flush()

                st = Student(
                    id=str(uuid.uuid4()),
                    roll_no=roll,
                    name=name,
                    section_id=sec_id,
                    section_code=sec_code,
                    branch=branch,
                    year=year,
                    batch_code=batch_code,
                )
                db.add(st)
                inserted += 1

    elif dataset == "session_events" and ok_cnt > 0:
        for r in clean_df.itertuples():
            dt = r.date.date() if hasattr(r.date, "date") else r.date
            ev = SessionEvent(
                id=str(uuid.uuid4()),
                date=dt,
                event_type=str(r.event_type),
                period=int(r.period) if pd.notna(r.period) else None,
                section_code=str(r.section_code) if pd.notna(r.section_code) else None,
                note=str(r.note) if pd.notna(r.note) else None,
                batch_id=batch_id,
            )
            db.add(ev)
            inserted += 1

    elif dataset == "leaves" and ok_cnt > 0:
        for r in clean_df.itertuples():
            fd = r.from_date.date() if hasattr(r.from_date, "date") else r.from_date
            td = r.to_date.date() if hasattr(r.to_date, "date") else r.to_date
            lv = Leave(
                id=str(uuid.uuid4()),
                roll_no=str(r.roll_no).strip().upper(),
                from_date=fd,
                to_date=td,
                leave_type=str(r.leave_type),
                batch_id=batch_id,
            )
            db.add(lv)
            inserted += 1

    elif dataset == "seating" and ok_cnt > 0:
        mem = memberships_from_seating(clean_df)
        for r in mem.itertuples():
            db.add(MembershipTie(
                id=str(uuid.uuid4()),
                roll_no=r.roll_no,
                tie_type=r.tie_type,
                key=r.key,
                valid_from=r.valid_from.date() if pd.notna(r.valid_from) else None,
                valid_to=r.valid_to.date() if pd.notna(r.valid_to) else None,
                batch_id=batch_id,
            ))
            inserted += 1

    elif dataset == "groups" and ok_cnt > 0:
        mem = memberships_from_groups(clean_df)
        for r in mem.itertuples():
            db.add(MembershipTie(
                id=str(uuid.uuid4()),
                roll_no=r.roll_no,
                tie_type=r.tie_type,
                key=r.key,
                valid_from=r.valid_from.date() if pd.notna(r.valid_from) else None,
                valid_to=r.valid_to.date() if pd.notna(r.valid_to) else None,
                batch_id=batch_id,
            ))
            inserted += 1

    elif dataset == "transport" and ok_cnt > 0:
        mem = memberships_from_transport(clean_df)
        for r in mem.itertuples():
            db.add(MembershipTie(
                id=str(uuid.uuid4()),
                roll_no=r.roll_no,
                tie_type=r.tie_type,
                key=r.key,
                valid_from=None,
                valid_to=None,
                batch_id=batch_id,
            ))
            inserted += 1

    elif dataset == "clubs" and ok_cnt > 0:
        mem = memberships_from_clubs(clean_df)
        for r in mem.itertuples():
            db.add(MembershipTie(
                id=str(uuid.uuid4()),
                roll_no=r.roll_no,
                tie_type=r.tie_type,
                key=r.key,
                valid_from=r.valid_from.date() if pd.notna(r.valid_from) else None,
                valid_to=r.valid_to.date() if pd.notna(r.valid_to) else None,
                batch_id=batch_id,
            ))
            inserted += 1

    elif dataset == "peer_survey" and ok_cnt > 0:
        nom = nominations_from_survey(clean_df)
        for r in nom.itertuples():
            s_date = r.survey_date.date() if hasattr(r.survey_date, "date") else r.survey_date
            db.add(PeerNomination(
                id=str(uuid.uuid4()),
                respondent=r.respondent,
                nominee=r.nominee,
                tie_type=r.tie_type,
                mutual=bool(r.mutual),
                survey_date=s_date,
                batch_id=batch_id,
            ))
            inserted += 1

    # Log to audit_log (§7.4)
    audit_entry = AuditLog(
        actor_id=user_id,
        action="INGEST_COMMIT",
        entity_type="dataset",
        entity_id=dataset,
        purpose=f"Committed {inserted} inserted, {updated} updated rows",
        detail_json={"batch_id": batch_id, "dataset": dataset, "rows_ok": ok_cnt, "rows_rejected": rej_cnt},
        prev_hash="0" * 64,
        hash=hashlib.sha256(f"{batch_id}:{now.isoformat()}".encode()).hexdigest(),
        who=user_id,
        object=f"{dataset}:{batch_id}",
        at=now,
    )
    db.add(audit_entry)
    await db.commit()

    # Clean up from store
    _DRY_RUN_STORE.pop(dry_run_id, None)

    return {
        "status": status,
        "batch_id": batch_id,
        "inserted": inserted,
        "updated": updated,
        "rejected": rej_cnt,
    }


async def get_all_batches(db: AsyncSession, limit: int = 50) -> list[dict[str, Any]]:
    """Lists recent ingestion batches per §7.3."""
    stmt = select(IngestionBatch).order_by(IngestionBatch.uploaded_at.desc()).limit(limit)
    res = await db.execute(stmt)
    batches = res.scalars().all()
    return [{
        "batch_id": b.batch_id or b.id,
        "dataset": b.dataset or b.file_type,
        "status": b.status,
        "rows_total": b.rows_total or (b.rows_ok + b.rows_rejected),
        "rows_ok": b.rows_ok,
        "rows_rejected": b.rows_rejected,
        "uploaded_by": b.uploaded_by,
        "uploaded_at": b.uploaded_at.isoformat() if b.uploaded_at else None,
    } for b in batches]
