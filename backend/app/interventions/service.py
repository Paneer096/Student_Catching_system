"""
Makerove — Interventions Service

Manages ethical teacher interventions, student support cases, and follow-up logging.
Stored in SQLite tables: interventions and intervention_students.
"""
from __future__ import annotations

from typing import Any
from datetime import date, datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import Intervention, InterventionStudent, Student, Teacher


async def list_interventions(db: AsyncSession, section_code: str = "CS-3B") -> list[dict[str, Any]]:
    """List all recorded interventions for students in a section."""
    stmt = (
        select(Intervention, Student.roll_no, Student.name, Teacher.name.label("teacher_name"))
        .join(InterventionStudent, Intervention.id == InterventionStudent.intervention_id)
        .join(Student, InterventionStudent.student_id == Student.id)
        .join(Teacher, Intervention.teacher_id == Teacher.id)
        .order_by(Intervention.date.desc())
    )
    res = await db.execute(stmt)
    rows = res.all()

    interventions_map: dict[str, dict[str, Any]] = {}
    for interv, roll_no, stu_name, teacher_name in rows:
        if interv.id not in interventions_map:
            interventions_map[interv.id] = {
                "id": interv.id,
                "type": interv.type,
                "date": str(interv.date),
                "notes": interv.notes or "No notes logged",
                "follow_up_date": str(interv.follow_up_date) if interv.follow_up_date else None,
                "outcome": interv.outcome or "OPEN",
                "teacher_name": teacher_name,
                "target_students": [],
            }
        interventions_map[interv.id]["target_students"].append({
            "roll_no": roll_no,
            "name": stu_name,
        })

    return list(interventions_map.values())


async def create_intervention(
    db: AsyncSession,
    teacher_id: str,
    intervention_type: str,
    target_roll_nos: list[str],
    notes: str | None = None,
    follow_up_date: date | None = None,
) -> dict[str, Any]:
    """Create a new intervention record with student links."""
    # Find student IDs
    stmt = select(Student).where(Student.roll_no.in_(target_roll_nos))
    res = await db.execute(stmt)
    students = list(res.scalars().all())

    # Create intervention
    interv = Intervention(
        teacher_id=teacher_id,
        type=intervention_type,
        date=date.today(),
        notes=notes,
        follow_up_date=follow_up_date,
        outcome="PENDING",
    )
    db.add(interv)
    await db.flush()

    for s in students:
        db.add(InterventionStudent(intervention_id=interv.id, student_id=s.id))

    await db.commit()

    return {
        "id": interv.id,
        "type": interv.type,
        "date": str(interv.date),
        "notes": interv.notes,
        "target_students": [{"roll_no": s.roll_no, "name": s.name} for s in students],
        "status": "CREATED",
    }
