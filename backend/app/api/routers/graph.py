"""
Makerove — Graph API Router

Serves live NetworkX social co-absence graph nodes, edges, and student dossiers.
"""
from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.graph.graph_engine import build_coabsence_graph, get_student_dossier

router = APIRouter(prefix="/graph", tags=["Social Graph"])


@router.get("/nodes")
async def get_graph_nodes(
    section: str = Query(default="CS-3B", description="Section code"),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Get live computed social graph nodes and edges for the given section.
    Computed directly from database attendance records using NetworkX.
    """
    if not isinstance(section, str):
        section = "CS-3B"
    return await build_coabsence_graph(db, section)


@router.get("/student/{roll_no}")
async def get_student_profile(
    roll_no: str,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Get comprehensive, traceable student profile dossier.
    """
    profile = await get_student_dossier(db, roll_no)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Student with roll number '{roll_no}' not found.")
    return profile
