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
from app.graph.graph_engine import build_coabsence_graph
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

    # 4. Graph analysis for Louvain cohorts & anchors
    graph_res = await build_coabsence_graph(db, section)
    cohorts_count = graph_res["summary"]["cohorts_count"]

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

    # Group cohort members from graph nodes
    cohort_members = {}
    for node in graph_res["nodes"]:
        c = node.get("cohort", "General")
        if c not in cohort_members:
            cohort_members[c] = []
        cohort_members[c].append(node["name"])

    # 8. Flagged cohorts table extracted from real graph
    flagged_cohorts = []
    for node in graph_res["nodes"]:
        if node["type"] == "anchor" and node["absences"] > 0:
            c_name = str(node.get("cohort", "Cohort-1"))
            members_list = cohort_members.get(node.get("cohort"), [node["name"]])
            flagged_cohorts.append({
                "id": f"cohort-{c_name}",
                "name": f"Cohort #{c_name}" if not c_name.startswith("Cohort") else c_name,
                "cohort_id": c_name,
                "top_peer": f"{node['name']} ({node['roll_no']})",
                "anchor_roll": node["roll_no"],
                "anchor_name": node["name"],
                "size": len(members_list),
                "members": members_list,
                "pattern": f"Absent in {node['absences']} sessions",
                "risk_score": node["score"],
                "risk": "HIGH" if node["score"] >= 65 else "MEDIUM",
                "risk_level": "High" if node["score"] >= 65 else "Medium",
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
