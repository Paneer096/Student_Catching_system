"""
Makerove — Students API Router
"""
from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.orm import Student, Section, Attendance
from app.connection.engine_service import compute_graph

router = APIRouter(prefix="/students", tags=["Students"])


@router.get("")
async def get_students_roster(
    section: str = Query(default="CS-3B", description="Section code"),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """
    Get full student roster for a section with real computed attendance and connection engine groups.
    Traceable to real records in students and attendance tables.
    """
    if not isinstance(section, str):
        section = "CS-3B"

    # 1. Fetch section (support code or AIML alias)
    stmt_sec = select(Section).where(Section.code == section)
    sec_res = await db.execute(stmt_sec)
    sec = sec_res.scalar_one_or_none()

    if not sec:
        # Fallback to default active section if alias used
        if "AIML" in section.upper() or "3B" in section.upper():
            stmt_fallback = select(Section).where(Section.code == "CS-3B")
            sec_res = await db.execute(stmt_fallback)
            sec = sec_res.scalar_one_or_none()

    if not sec:
        return []

    actual_section_code = sec.code

    # 2. Fetch students
    stmt_students = select(Student).where(Student.section_id == sec.id).order_by(Student.roll_no.asc())
    students_res = await db.execute(stmt_students)
    students = list(students_res.scalars().all())
    if not students:
        return []

    # 3. Direct attendance stats and bunk group facts
    att_stmt = (
        select(
            Attendance.student_id,
            func.count(Attendance.id).label("total_classes"),
            func.sum(case((Attendance.status.in_(["ABSENT", "A"]), 1), else_=0)).label("absences"),
            func.sum(case((Attendance.status.in_(["PRESENT", "LATE"]), 1), else_=0)).label("presents"),
        )
        .where(Attendance.student_id.in_([s.id for s in students]))
        .group_by(Attendance.student_id)
    )
    att_res = await db.execute(att_stmt)
    att_map = {r.student_id: (r.total_classes, r.absences or 0, r.presents or 0) for r in att_res.all()}

    try:
        _, graph_payload = await compute_graph(db=db, section_code=actual_section_code)
        node_facts = {n["roll_no"]: n for n in graph_payload.get("nodes", [])}
    except Exception:
        node_facts = {}

    roster = []
    for s in students:
        tot, abs_cnt, pres_cnt = att_map.get(s.id, (0, 0, 0))
        att_pct = round((pres_cnt / tot * 100), 1) if tot > 0 else 100.0

        node = node_facts.get(s.roll_no)
        group_id = node.get("group_id") if node else None
        cohort = f"Bunk Group {group_id}" if group_id else "Independent"
        cohort_color = "#f97316" if group_id else "#64748b"

        if att_pct < 75.0:
            category = "priority"
            status_badge = "Reach Out Soon"
        elif att_pct < 85.0:
            category = "watch"
            status_badge = "Keep an Eye"
        else:
            category = "mentor"
            status_badge = "On Track"

        roster.append({
            "id": s.id,
            "roll_no": s.roll_no,
            "name": s.name,
            "branch": s.branch or "AIML",
            "year": s.year or 2,
            "attendance": att_pct,
            "attendance_pct": att_pct,
            "role": "Student",
            "cohort": cohort,
            "cohort_color": cohort_color,
            "category": category,
            "influenceScore": round((node.get("bunk_rate", 0.0) * 100), 1) if node else 0.0,
            "statusBadge": status_badge,
            "pagerank": 0.0,
            "betweenness": 0.0,
            "is_delinquent": (att_pct < 75.0),
            "delinquency_label": "High Risk" if att_pct < 75.0 else None,
            "total_classes": tot,
            "absences": abs_cnt,
        })

    return roster


@router.get("/{roll_no}/profile")
async def get_student_profile(
    roll_no: str,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    from fastapi import HTTPException
    stmt = select(Student).where(Student.roll_no == roll_no)
    res = await db.execute(stmt)
    s = res.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail=f"Student {roll_no} not found")

    att_stmt = select(Attendance).where(Attendance.student_id == s.id).order_by(Attendance.date.desc())
    att_res = await db.execute(att_stmt)
    records = list(att_res.scalars().all())

    tot = len(records)
    abs_cnt = sum(1 for r in records if r.status in ("ABSENT", "A"))
    pres_cnt = sum(1 for r in records if r.status in ("PRESENT", "LATE"))
    att_pct = round((pres_cnt / tot * 100), 1) if tot > 0 else 100.0

    recent = [
        {
            "date": str(r.date),
            "period": r.period or 1,
            "status": r.status,
            "subject_code": r.subject_code or "CS",
        }
        for r in records[:15]
    ]

    sec_code = s.section_code or "CS-3B"
    try:
        _, graph_payload = await compute_graph(db=db, section_code=sec_code)
        node_facts = {n["roll_no"]: n for n in graph_payload.get("nodes", [])}
        node = node_facts.get(s.roll_no)
        partners = []
        for e in graph_payload.get("edges", []):
            if e["student_a"] == s.roll_no or e["student_b"] == s.roll_no:
                other = e["student_b"] if e["student_a"] == s.roll_no else e["student_a"]
                partners.append({
                    "roll_no": other,
                    "name": other,
                    "mutual_absences": e.get("co_cells", 0),
                    "cohort": f"Weight: {round(e.get('weight', 0), 2)}",
                })
    except Exception:
        node = None
        partners = []

    group_id = node.get("group_id") if node else None
    cohort = f"Bunk Group {group_id}" if group_id else "Independent"

    return {
        "id": s.id,
        "roll_no": s.roll_no,
        "name": s.name,
        "branch": s.branch or "AIML",
        "year": s.year or 2,
        "section": sec_code,
        "attendance_pct": att_pct,
        "total_classes": tot,
        "absences": abs_cnt,
        "role": "Student",
        "cohort": cohort,
        "cohort_color": "#f97316" if group_id else "#64748b",
        "is_delinquent": (att_pct < 75.0),
        "delinquency_label": "High Risk" if att_pct < 75.0 else None,
        "pagerank": 0.0,
        "betweenness": 0.0,
        "peers": partners,
        "recent_attendance": recent,
    }
