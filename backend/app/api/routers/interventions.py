"""
Makerove — Interventions API Router
"""
from __future__ import annotations

from typing import Any
from datetime import date
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.interventions.service import list_interventions, create_intervention

router = APIRouter(prefix="/interventions", tags=["Interventions"])


class CreateInterventionRequest(BaseModel):
    teacher_id: str = Field(default="tch-001", description="ID of the teacher logging the intervention")
    type: str = Field(default="PEER_STUDY_GROUP", description="Intervention playbook type")
    target_roll_nos: list[str] = Field(..., min_length=1, description="Roll numbers of targeted students")
    notes: str | None = Field(default=None, description="Teacher observation and guidance notes")
    follow_up_date: date | None = Field(default=None, description="Scheduled follow-up date")


@router.get("")
async def get_interventions(
    section: str = Query(default="CS-3B", description="Section code"),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """Get all logged interventions."""
    if not isinstance(section, str):
        section = "CS-3B"
    return await list_interventions(db, section)


@router.post("")
async def log_intervention(
    payload: CreateInterventionRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Log a new proactive intervention."""
    try:
        return await create_intervention(
            db=db,
            teacher_id=payload.teacher_id,
            intervention_type=payload.type,
            target_roll_nos=payload.target_roll_nos,
            notes=payload.notes,
            follow_up_date=payload.follow_up_date,
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to log intervention: {str(e)}")
