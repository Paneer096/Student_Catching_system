"""
Makerove — Students API Router
"""
from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.orm import Student, Section
from app.graph.graph_engine import build_coabsence_graph

router = APIRouter(prefix="/students", tags=["Students"])


@router.get("")
async def get_students_roster(
    section: str = Query(default="CS-3B", description="Section code"),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """
    Get full student roster for a section with real computed attendance, cohort cliques, and graph centrality.
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

    # 3. Graph metrics
    graph_res = await build_coabsence_graph(db, actual_section_code)
    node_map = {n["id"]: n for n in graph_res["nodes"]}

    roster = []
    for s in students:
        node = node_map.get(s.id)
        att_pct = node["attendance_pct"] if node else 100.0
        role = node["role"] if node else "Student"
        cohort = node["cohort"] if node else "Independent"
        cohort_color = node.get("cohort_color", "#6366f1") if node else "#6366f1"
        score = node["score"] if node else 0.0
        pr = node.get("pagerank", 0.0) if node else 0.0
        bw = node.get("betweenness", 0.0) if node else 0.0
        is_delinquent = node.get("is_delinquent", False) if node else False
        delinquency_label = node.get("delinquency_label") if node else None

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
            "role": role,
            "cohort": cohort,
            "cohort_color": cohort_color,
            "category": category,
            "influenceScore": score,
            "statusBadge": status_badge,
            "pagerank": round(pr, 4),
            "betweenness": round(bw, 4),
            "is_delinquent": is_delinquent,
            "delinquency_label": delinquency_label,
            "total_classes": node["total_classes"] if node else 0,
            "absences": node["absences"] if node else 0,
        })

    return roster
