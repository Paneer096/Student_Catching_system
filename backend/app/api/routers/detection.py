"""
Makerove — Detection API Router

Serves detected mass bunks and coordinated absence episodes.
"""
from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.detection.mass_bunk_detector import detect_mass_bunks

router = APIRouter(prefix="/detection", tags=["Detection"])


@router.get("/mass-bunks")
async def get_detected_mass_bunks(
    section: str = Query(default="CS-3B", description="Section code"),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """
    Get detected mass bunk events computed from real attendance data.
    """
    if not isinstance(section, str):
        section = "CS-3B"
    return await detect_mass_bunks(db, section)
