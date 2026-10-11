"""
Makerove — Dashboard API Router

Returns verifiable live classroom metrics computed directly from SQLite database.
"""
from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.orm import Student, Attendance, Section, Intervention
from app.connection.engine_service import compute_graph
from app.detection.mass_bunk_detector import detect_mass_bunks

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary")
async def get_dashboard_summary(
    section: str = Query(default="CS-3B", description="Section code"),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Get live, real summary metrics for the dashboard.
    Traceable to database records.
    """
    # 1. Fetch section
    if not isinstance(section, str):
        section = "CS-3B"
    stmt_sec = select(Section).where(Section.code == section)
    sec_res = await db.execute(stmt_sec)
    sec = sec_res.scalar_one_or_none()

    if not sec:
        return {
            "total_students": 0,
            "attendance_rate": 0.0,
            "cohorts_count": 0,
            "mass_bunks_count": 0,
            "active_interventions": 0,
            "weekly_activity": [],
            "flagged_cohorts": [],
            "recent_alerts": [],
            "has_data": False,
        }

    # 2. Count real students in section
    stmt_students = select(Student).where(Student.section_id == sec.id)
    students_res = await db.execute(stmt_students)
    students = list(students_res.scalars().all())
    total_students = len(students)

    if total_students == 0:
        return {
            "total_students": 0,
            "attendance_rate": 0.0,
            "cohorts_count": 0,
            "mass_bunks_count": 0,
            "active_interventions": 0,
            "weekly_activity": [],
            "flagged_cohorts": [],
            "recent_alerts": [],
            "has_data": False,
        }

    student_ids = [s.id for s in students]

    # 3. Compute real attendance statistics
    stmt_att = select(Attendance).where(Attendance.student_id.in_(student_ids))
    att_res = await db.execute(stmt_att)
    records = list(att_res.scalars().all())

    total_records = len(records)
    if total_records == 0:
        return {
            "total_students": total_students,
            "attendance_rate": 0.0,
            "cohorts_count": 0,
            "mass_bunks_count": 0,
            "active_interventions": 0,
            "weekly_activity": [],
            "flagged_cohorts": [],
            "recent_alerts": [],
            "has_data": False,
        }

    present_count = sum(1 for r in records if r.status in ("PRESENT", "LATE"))
    attendance_rate = round((present_count / total_records * 100), 1)

    # 4. Validated bunk groups from connection engine
    try:
        _, graph_payload = await compute_graph(db=db, section_code=section)
        bunk_groups = graph_payload.get("groups", [])
    except Exception:
        graph_payload = {}
        bunk_groups = []

    cohorts_count = len(bunk_groups)

    # 6. Mass bunk detection
    mass_bunks = await detect_mass_bunks(db, section)

    # 4. Weekly presence counts
    day_counts = {i: {"total": 0, "present": 0} for i in range(6)}
    for r in records:
        w = r.date.weekday()
        if w in day_counts:
            day_counts[w]["total"] += 1
            if r.status in ("PRESENT", "LATE"):
                day_counts[w]["present"] += 1

    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    weekly_activity = []
    for d, counts in day_counts.items():
        if counts["total"] > 0:
            rate = round((counts["present"] / counts["total"] * 100), 1)
        else:
            rate = 0.0
        # Count mass bunks detected for this day of week
        bunks_on_day = sum(1 for mb in mass_bunks if mb.get("day", "").lower().startswith(day_names[d].lower()))
        weekly_activity.append({
            "day": day_names[d],
            "day_idx": d,
            "rate": rate,
            "attendance": rate,
            "total": counts["total"],
            "present": counts["present"],
            "bunk_count": bunks_on_day,
            "is_peak_risk": (d == 4 and rate < 75.0),
        })

    # 7. Active interventions count
    stmt_interv = (
        select(func.count(Intervention.id))
        .where(Intervention.outcome != "RESOLVED")
    )
    interv_res = await db.execute(stmt_interv)
    active_interventions = interv_res.scalar() or 0

    # 8. Flagged bunk groups table extracted from real connection engine
    flagged_cohorts = []
    for g in bunk_groups:
        gid = g.get("group_id", 1)
        members = g.get("members", [])
        mean_wt = g.get("mean_weight", 0.0)
        n_edges = g.get("n_edges", 0)
        risk_score = round(mean_wt * 100, 1)
        top_student = members[0] if members else ""
        flagged_cohorts.append({
            "id": f"bunk-group-{gid}",
            "name": f"Bunk Group {gid}",
            "cohort_id": f"Group-{gid}",
            "top_peer": top_student,
            "anchor_roll": top_student,
            "anchor_name": top_student,
            "size": len(members),
            "members": members,
            "pattern": f"{n_edges} ties, mean overlap {round(mean_wt, 2)}",
            "risk_score": risk_score,
            "risk": "HIGH" if risk_score >= 40 else "MEDIUM",
            "risk_level": "High" if risk_score >= 40 else "Medium",
        })

    # 9. Recent alerts from real mass bunk detections
    recent_alerts = []
    for mb in mass_bunks[:4]:
        recent_alerts.append({
            "id": mb["id"],
            "title": f"Mass Bunk Alert: {mb['absent_count']} Absent ({mb['absent_percentage']}%)",
            "date": mb["date"],
            "time": f"{mb['day']} {mb['date']}",
            "severity": "HIGH" if mb["risk_score"] >= 65 else "MEDIUM",
            "absentees": mb["absent_count"],
            "reason": mb["reason"],
        })

    return {
        "total_students": total_students,
        "attendance_rate": attendance_rate,
        "cohorts_count": cohorts_count,
        "mass_bunks_count": len(mass_bunks),
        "active_interventions": active_interventions,
        "weekly_activity": weekly_activity,
        "flagged_cohorts": flagged_cohorts,
        "recent_alerts": recent_alerts,
        "has_data": True,
    }
